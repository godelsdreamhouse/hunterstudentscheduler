import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useUserProfile } from "../hooks/useUserProfile";
import { useSetupProgress } from "../hooks/useSetupProgress";
import { readAuditData } from "../hooks/useAuditData";
import { readPersistedPreferences } from "../hooks/usePersistedPreferences";
import {
  buildUiPayload,
  parseSemester,
  minutesToTimeString,
  normalizeMajorName,
  type ScheduleResponse,
  type ScheduleSection,
  type ScheduleRequest,
} from "../../lib/schedulePayload";
import { SCHEDULER_BASE } from "../../lib/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Calendar, Clock, MapPin, User, CheckCircle, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import logoImg from "../../assets/watchtower-logo.svg";

const GRID_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
const DAY_LABEL: Record<string, string> = {
  MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu", FRIDAY: "Fri", SATURDAY: "Sat",
};
const TIME_ROWS = Array.from({ length: 15 }, (_, i) => 420 + i * 60); // 7 AM – 9 PM
const GRID_START = 420; // 7 AM in minutes
const ROW_HEIGHT = 60;  // px per hour

const SECTION_COLORS = [
  "bg-purple-100 border-purple-300 text-purple-900",
  "bg-blue-100 border-blue-300 text-blue-900",
  "bg-green-100 border-green-300 text-green-900",
  "bg-amber-100 border-amber-300 text-amber-900",
  "bg-rose-100 border-rose-300 text-rose-900",
  "bg-cyan-100 border-cyan-300 text-cyan-900",
];

const SCHEDULER_ERROR_MESSAGES: Record<string, string> = {
  NO_CANDIDATE_SECTIONS: "No matching classes were found for your current requirements and term.",
  ALL_CANDIDATES_FAIL_PREREQS: "We found classes, but prerequisites are not satisfied for all of them.",
  ALL_CANDIDATES_IN_BLOCKED_TIME: "All matching classes conflict with your unavailable time settings.",
  NO_ELIGIBLE_CANDIDATES: "No classes remain after applying your eligibility and time filters.",
  UNSAT_HARD_CONSTRAINTS: "No valid schedule satisfies all required constraints. Try relaxing filters.",
  NO_CANDIDATES_FOUND: "No candidate sections were found for the requested schedule.",
  UNSATISFIABLE_CONSTRAINTS: "The requested schedule constraints cannot be satisfied.",
  DATABASE_CONNECTION_FAILED: "The scheduler could not connect to its database. Please try again shortly.",
  INVALID_PAYLOAD: "The schedule request was malformed. Please re-upload your audit and try again.",
  SOLVER_FAILED: "The scheduler encountered an internal error. Please try again.",
  SOLVER_TIMEOUT: "Schedule generation took too long. Try relaxing your constraints or removing a pinned course.",
  SPECIFIC_COURSE_NO_ELIGIBLE_SECTIONS: "One or more pinned courses has no eligible sections for this term.",
};

const OPTIMIZATION_LABELS: Record<string, string> = {
  PREF_MORNING_ACTIVE: "Preferred morning classes when available",
  PREF_AFTERNOON_ACTIVE: "Preferred afternoon classes when available",
  PREF_EVENING_ACTIVE: "Preferred evening classes when available",
  PREF_INPERSON_ACTIVE: "Preferred in-person sections when available",
  PREF_REMOTE_ACTIVE: "Preferred remote sections when available",
  OPT_MINIMIZE_DAYS_ACTIVE: "Minimize days on campus active",
  OPT_MINIMIZE_GAPS_ACTIVE: "Minimize same-day gaps active",
  OPT_MULTI_REQUIREMENT_TAG_PRIORITY: "Multi-requirement course priority active",
  MAXSAT_RC2_OPTIMIZED: "Global optimization executed",
};

const PROGRESS_MESSAGES = [
  "Analyzing your requirements…",
  "Finding candidate courses for your term…",
  "Applying prerequisite and availability filters…",
  "Solving scheduling constraints…",
  "Optimizing your schedule…",
  "Almost there — finalizing your schedule…",
];

function isScheduleResponse(data: unknown): data is ScheduleResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    Array.isArray((data as Partial<ScheduleResponse>).sections) &&
    Array.isArray((data as Partial<ScheduleResponse>).optimization_codes)
  );
}

function extractUnexpectedResponseMessage(data: unknown): string {
  if (typeof data === "object" && data !== null) {
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((item) => {
      if (typeof item === "object" && item !== null && "msg" in item) {
        return String((item as { msg: unknown }).msg);
      }
      return String(item);
    }).join("; ");

    const message = (data as { message?: unknown; error?: unknown }).message ?? (data as { error?: unknown }).error;
    if (typeof message === "string") return message;
  }
  return "Schedule response had an unexpected shape. Check the scheduler logs for the matching request.";
}

function formatMeetingDays(section: ScheduleSection): string {
  const days = [...new Set(section.meetings.map((m) => DAY_LABEL[m.day] ?? m.day))];
  return days.join(", ");
}

function formatMeetingTime(section: ScheduleSection): string {
  if (section.meetings.length === 0) return "TBA";
  const m = section.meetings[0];
  return `${minutesToTimeString(m.start_time)} – ${minutesToTimeString(m.end_time)}`;
}

export function ViewSchedules() {
  const navigate = useNavigate();
  const { email: userEmail, emplid, isLoading: authLoading } = useUserProfile();
  const { progress } = useSetupProgress();
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!fetchLoading) return;
    const id = setInterval(
      () => setLoadingMsgIdx((i) => Math.min(i + 1, PROGRESS_MESSAGES.length - 1)),
      6_000,
    );
    return () => clearInterval(id);
  }, [fetchLoading]);

  useEffect(() => {
    if (authLoading) return;

    const auditData = readAuditData();
    if (!auditData?.parserPayload) {
      setError("No audit data found. Please upload your DegreeWorks audit first.");
      setFetchLoading(false);
      return;
    }

    if (!emplid) {
      setError("Could not load your profile. Please log in again.");
      setFetchLoading(false);
      return;
    }

    const prefs = readPersistedPreferences();
    const { season, year } = parseSemester(prefs.semester);
    const normalizedParserPayload = {
      ...auditData.parserPayload,
      majors: auditData.parserPayload.majors.map(normalizeMajorName),
    };
    const request: ScheduleRequest = {
      parser_payload: normalizedParserPayload,
      ui_payload: buildUiPayload(
        emplid,
        prefs.creditRange,
        prefs.blockedTimes,
        prefs.preferences,
        prefs.electiveCourses,
        prefs.specificCoursesList,
        prefs.preferredDepartments,
      ),
      term_season: season,
      term_year: year,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90_000);

    fetch(`${SCHEDULER_BASE}/api/schedule/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    })
      .then(async (res) => {
        let text = "";
        try {
          text = await res.text();
        } catch (e) {
          clearTimeout(timeoutId);
          throw new Error("Failed to read response body — the scheduler may have closed the connection.");
        }
        clearTimeout(timeoutId);
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("Schedule response could not be parsed. The scheduler may have returned an unexpected format.");
        }
        if (!isScheduleResponse(data)) {
          throw new Error(extractUnexpectedResponseMessage(data));
        }
        if (!res.ok) {
          const code = data.error_code ?? undefined;
          const msg = data.error_message ?? undefined;
          throw new Error(
            (code && SCHEDULER_ERROR_MESSAGES[code]) ?? msg ?? `Server returned ${res.status}`,
          );
        }
        return data;
      })
      .then((data) => {
        // Scheduler-level error: HTTP 200 but sections is empty with an error_code
        if (data.sections.length === 0 && data.error_code) {
          setError(
            SCHEDULER_ERROR_MESSAGES[data.error_code] ?? data.error_message ?? "No schedule could be generated.",
          );
        } else {
          setSchedule(data);
        }
        setFetchLoading(false);
      })
      .catch((err: Error) => {
        clearTimeout(timeoutId);
        if (err.name === "AbortError") {
          setError("Schedule generation timed out. The scheduler may be busy — please try again.");
        } else {
          setError(err.message);
        }
        setFetchLoading(false);
      });
  }, [emplid, authLoading]);

  const colorFor = (classNum: number, sections: ScheduleSection[]) => {
    const idx = sections.findIndex((s) => s.class_num === classNum);
    return SECTION_COLORS[idx % SECTION_COLORS.length];
  };

  const uniqueDays = schedule
    ? new Set(schedule.sections.flatMap((s) => s.meetings.map((m) => m.day)))
    : new Set<string>();
  const unscheduledSections = schedule
    ? schedule.sections.filter((section) => section.meetings.length === 0)
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-3 flex items-center justify-between">
          <button onClick={() => navigate("/dashboard")} className="cursor-pointer">
            <img src={logoImg} alt="Watchtower Logo" className="h-10 w-auto" />
          </button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 font-medium">{userEmail}</span>
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors text-sm px-4 py-2">
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/preferences")} className="mb-4 hover:bg-white/60 text-gray-600 hover:text-gray-800 transition-all">
          <ArrowLeft className="size-4 mr-2" />
          Back to Preferences
        </Button>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="size-5 text-green-600" />
            <h2 className="text-2xl font-bold text-gray-900">Your Generated Schedule</h2>
          </div>
          <p className="text-sm text-gray-600">
            Optimized for your preferences{progress.semester ? ` · ${progress.semester}` : ""}
          </p>
        </div>

        {(fetchLoading || authLoading) && (
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="size-10 text-indigo-500 animate-spin" />
              <p className="text-sm text-gray-700 font-semibold">{PROGRESS_MESSAGES[loadingMsgIdx]}</p>
              <p className="text-xs text-gray-400">This can take up to a minute</p>
            </CardContent>
          </Card>
        )}

        {!fetchLoading && !authLoading && error && (
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <AlertCircle className="size-10 text-amber-500" />
              <p className="text-sm text-gray-700 font-medium text-center max-w-md">{error}</p>
              <div className="flex gap-3">
                <Button size="sm" onClick={() => navigate("/upload")} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                  Upload Audit
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate("/preferences")}>
                  Back to Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!fetchLoading && !authLoading && schedule && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 mb-2">
              <Card className="shadow-md border-0 bg-white/90">
                <CardHeader className="pb-1">
                  <CardDescription className="text-xs font-medium text-gray-600">Total Credits</CardDescription>
                  <CardTitle className="text-2xl font-bold text-indigo-600">{schedule.credits}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="shadow-md border-0 bg-white/90">
                <CardHeader className="pb-1">
                  <CardDescription className="text-xs font-medium text-gray-600">Courses</CardDescription>
                  <CardTitle className="text-2xl font-bold text-indigo-600">{schedule.sections.length}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="shadow-md border-0 bg-white/90">
                <CardHeader className="pb-1">
                  <CardDescription className="text-xs font-medium text-gray-600">Class Meeting Days</CardDescription>
                  <CardTitle className="text-2xl font-bold text-indigo-600">{uniqueDays.size}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            {schedule.optimization_codes.length > 0 && (
              <Card className="shadow-md border-0 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-green-900">Why this schedule?</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-1.5">
                    {schedule.optimization_codes.map((code) => {
                      const label = OPTIMIZATION_LABELS[code];
                      if (!label) return null;
                      return (
                        <li key={code} className="flex items-center gap-2 text-sm text-green-800">
                          <CheckCircle className="size-4 flex-shrink-0 text-green-600" />
                          {label}
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Schedule Details</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      {progress.semester} · Optimization score: {schedule.score}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs px-2 py-1">
                    Score: {schedule.score}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="list" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="list" className="text-sm">Course List</TabsTrigger>
                    <TabsTrigger value="calendar" className="text-sm">Calendar View</TabsTrigger>
                  </TabsList>

                  <TabsContent value="list" className="space-y-3 mt-4">
                    {schedule.sections.map((section, idx) => (
                      <Card key={section.class_num} className="shadow-sm border border-gray-200">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-bold text-base">
                                {section.course.subject_area} {section.course.catalog_number} — {section.course.course_title}
                              </h4>
                              <p className="text-sm text-gray-600 mt-0.5">
                                Section {section.section_code} · Class #{section.class_num}
                                {section.major_elective && <span className="ml-2 text-purple-600 font-medium">· Elective</span>}
                              </p>
                            </div>
                            <div className="flex gap-2 items-start">
                              <Badge className={`text-xs px-2 py-0.5 ${SECTION_COLORS[idx % SECTION_COLORS.length].split(" ")[0].replace("bg-", "bg-")} border`}>
                                {section.course.credits} cr
                              </Badge>
                              <Badge variant="outline" className="text-xs px-2 py-0.5 capitalize">
                                {section.instruction_modality.toLowerCase()}
                              </Badge>
                            </div>
                          </div>

                          <div className="grid md:grid-cols-2 gap-3 text-sm">
                            <div className="flex items-center gap-2 text-gray-700">
                              <User className="size-4 flex-shrink-0" />
                              <span>{section.instructor === "NULL" ? "TBA" : section.instructor}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-700">
                              <Calendar className="size-4 flex-shrink-0" />
                              <span>{formatMeetingDays(section)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-700">
                              <Clock className="size-4 flex-shrink-0" />
                              <span>{formatMeetingTime(section)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-700">
                              <MapPin className="size-4 flex-shrink-0" />
                              <span>{section.enrollment_total}/{section.class_capacity} enrolled</span>
                            </div>
                          </div>

                          {section.attributes.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {section.attributes.map((attr) => (
                                <Badge key={attr} variant="secondary" className="text-xs px-1.5 py-0">{attr}</Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="calendar" className="mt-4">
                    <div className="text-xs text-gray-500 mb-2 flex items-center gap-1.5">
                      <Calendar className="size-3.5" />
                      Classes span their actual meeting times · hover for details
                    </div>
                    {unscheduledSections.length > 0 && (
                      <div className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                        <p className="mb-2 text-xs font-semibold text-indigo-800">Online / TBA Courses</p>
                        <div className="space-y-2">
                          {unscheduledSections.map((section) => (
                            <div key={section.class_num} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                              <span className="font-medium text-gray-900">
                                {section.course.subject_area} {section.course.catalog_number} - {section.course.course_title}
                              </span>
                              <Badge variant="outline" className="text-xs capitalize">
                                {section.instruction_modality.toLowerCase()} · TBA
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="rounded-xl border border-gray-200 shadow-sm bg-white">
                      {/* Header */}
                      <div className="grid grid-cols-7 border-b border-gray-200 rounded-t-xl overflow-hidden">
                        <div className="p-3 bg-gray-50 border-r border-gray-200 text-xs font-semibold text-gray-600">TIME</div>
                        {GRID_DAYS.map((day) => (
                          <div key={day} className="p-3 bg-gray-50 border-r border-gray-200 last:border-r-0 text-center font-semibold text-sm">
                            {DAY_LABEL[day]}
                          </div>
                        ))}
                      </div>
                      {/* Body */}
                      <div className="grid grid-cols-7" style={{ height: `${TIME_ROWS.length * ROW_HEIGHT}px` }}>
                        {/* Time label column */}
                        <div className="bg-gray-50 border-r border-gray-200 relative">
                          {TIME_ROWS.map((minutes) => (
                            <div
                              key={minutes}
                              className="absolute w-full border-t border-gray-200 px-2 text-xs text-gray-600 font-medium flex items-start pt-0.5"
                              style={{ top: ((minutes - GRID_START) / 60) * ROW_HEIGHT, height: ROW_HEIGHT }}
                            >
                              {minutesToTimeString(minutes)}
                            </div>
                          ))}
                        </div>
                        {/* Day columns */}
                        {GRID_DAYS.map((day, dayIdx) => (
                          <div key={day} className="border-r border-gray-200 last:border-r-0 relative">
                            {/* Hourly grid lines */}
                            {TIME_ROWS.map((minutes) => (
                              <div
                                key={minutes}
                                className="absolute w-full border-t border-gray-100"
                                style={{ top: ((minutes - GRID_START) / 60) * ROW_HEIGHT }}
                              />
                            ))}
                            {/* Section blocks */}
                            {schedule.sections.flatMap((section) =>
                              section.meetings
                                .filter((m) => m.day === day)
                                .map((meeting, mi) => {
                                  const top = ((meeting.start_time - GRID_START) / 60) * ROW_HEIGHT;
                                  const height = Math.max(
                                    ((meeting.end_time - meeting.start_time) / 60) * ROW_HEIGHT,
                                    20,
                                  );
                                  const colorClass = colorFor(section.class_num, schedule.sections);
                                  const tooltipSide = dayIdx < 4 ? "left-full ml-2" : "right-full mr-2";
                                  return (
                                    <div
                                      key={`${section.class_num}-${mi}`}
                                      className={`absolute left-0.5 right-0.5 ${colorClass} border rounded-md shadow-sm group cursor-default z-10 hover:z-20`}
                                      style={{ top, height }}
                                    >
                                      <div className="p-1 h-full overflow-hidden flex flex-col items-center justify-center text-center">
                                        <p className="font-semibold text-xs truncate leading-tight w-full">
                                          {section.course.subject_area} {section.course.catalog_number}
                                        </p>
                                        {height >= 36 && (
                                          <p className="text-[10px] opacity-75 truncate leading-tight w-full">
                                            {section.course.course_title}
                                          </p>
                                        )}
                                      </div>
                                      {/* Hover tooltip */}
                                      <div
                                        className={`hidden group-hover:block absolute z-50 top-0 ${tooltipSide} w-52 bg-gray-900 text-white text-xs rounded-lg shadow-xl p-3 pointer-events-none`}
                                      >
                                        <p className="font-semibold text-sm leading-tight mb-1">
                                          {section.course.course_title}
                                        </p>
                                        <p className="opacity-75 mb-1">
                                          {section.course.subject_area} {section.course.catalog_number} · §{section.section_code}
                                        </p>
                                        <p className="opacity-75">
                                          {section.instructor === "NULL" ? "TBA" : section.instructor}
                                        </p>
                                        <p className="opacity-75 mt-0.5">
                                          {minutesToTimeString(meeting.start_time)} – {minutesToTimeString(meeting.end_time)}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Next Steps</CardTitle>
                <CardDescription className="text-sm mt-1">Ready to register for these courses?</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full h-10 text-sm font-semibold border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors"
                    onClick={() => window.open("https://cunyfirst.cuny.edu", "_blank", "noopener,noreferrer")}
                  >
                    Open CUNYfirst to Register
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-9 text-sm font-semibold border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors"
                    onClick={() => navigate("/preferences")}
                  >
                    Adjust Preferences
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
