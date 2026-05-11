import { Fragment, useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useUserProfile } from "../hooks/useUserProfile";
import { usePersistedPreferences } from "../hooks/usePersistedPreferences";
import { useSetupProgress } from "../hooks/useSetupProgress";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Slider } from "../components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ArrowLeft, Calendar, XCircle, BookOpen, GraduationCap, SlidersHorizontal, Search, X } from "lucide-react";
import logoImg from "../../assets/watchtower-logo.svg";
import { API_BASE } from "../../lib/api";
import { type ElectiveCourse } from "../hooks/usePersistedPreferences";

// TODO: hardcoded - replace with DAYS constant from a shared constants file (also in ViewSchedules.tsx)
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// TODO: hardcoded - replace with TIME_SLOTS constant from a shared constants file (also in ViewSchedules.tsx)
const TIME_SLOTS = [
  "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM",
  "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM",
];

// TODO: hardcoded - replace with departments list fetched from backend
const DEPARTMENTS = [
  "Anthropology", "Art", "Biology", "Chemistry", "Computer Science",
  "Economics", "English", "History", "Mathematics", "Philosophy",
  "Physics", "Political Science", "Psychology", "Sociology", "Statistics"
];

function getUpcomingSemesters(count = 2): { value: string; label: string }[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Spring=Jan(0), Summer=Jun(5), Fall=Sep(8)
  const schedule = [
    { name: "Spring", startMonth: 0 },
    { name: "Summer", startMonth: 5 },
    { name: "Fall",   startMonth: 8 },
  ];

  const results: { value: string; label: string }[] = [];
  let y = year;

  while (results.length < count) {
    for (const sem of schedule) {
      if (results.length >= count) break;
      if (y > year || sem.startMonth > month) {
        results.push({ value: `${sem.name.toLowerCase()}-${y}`, label: `${sem.name} ${y}` });
      }
    }
    y++;
  }

  return results;
}

export function SetPreferences() {
  const navigate = useNavigate();
  const { email: userEmail } = useUserProfile();
  const { markPreferencesSet } = useSetupProgress();
  const upcomingSemesters = getUpcomingSemesters(2);
  const {
    semester, setSemester,
    creditRange, setCreditRange,
    blockedTimes, setBlockedTimes,
    preferences, setPreferences,
    preferredDepartments, setPreferredDepartments,
    specificCourses, setSpecificCourses,
    electiveCourses, setElectiveCourses,
  } = usePersistedPreferences();

  const [electiveSearch, setElectiveSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ElectiveCourse[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const q = electiveSearch.trim();
    if (!q) { setSearchResults([]); setIsSearching(false); return; }

    setIsSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/courses/search?q=${encodeURIComponent(q)}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json() as { courses: { course_id: string; course_code: string; course_name: string }[] };
          setSearchResults(data.courses.map((c) => ({ id: c.course_id, code: c.course_code, name: c.course_name })));
        }
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [electiveSearch]);

  const selectedIds = new Set(electiveCourses.map((c) => c.id));
  const filteredResults = searchResults.filter((c) => !selectedIds.has(c.id));

  const toggleTimeSlot = (day: string, slot: string) => {
    setBlockedTimes((prev: Record<string, Set<string>>) => {
      const existingSet = prev[day] ?? new Set<string>();
      const newSet = new Set(existingSet);
      if (newSet.has(slot)) {
        newSet.delete(slot);
      } else {
        newSet.add(slot);
      }
      return { ...prev, [day]: newSet };
    });
  };

  const updatePreference = (key: keyof typeof preferences, value: boolean) => {
    setPreferences((prev: typeof preferences) => ({ ...prev, [key]: value }));
  };

  const toggleDepartment = (dept: string) => {
    setPreferredDepartments((prev: string[]) =>
      prev.includes(dept) ? prev.filter((d: string) => d !== dept) : [...prev, dept]
    );
  };

  const isSlotBlocked = (day: string, slot: string) => {
    return blockedTimes[day]?.has(slot) || false;
  };

  const handleGenerateSchedules = () => {
    const label = upcomingSemesters.find((s) => s.value === semester)?.label ?? semester;
    markPreferencesSet(label);
    navigate("/schedules");
  };

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
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="mb-4 hover:bg-white/60 text-gray-600 hover:text-gray-800 transition-all">
          <ArrowLeft className="size-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Set Your Preferences</h2>
          <p className="text-sm text-gray-600">
            Tell us about your availability and preferences to generate optimized schedules
          </p>
        </div>

        <div className="space-y-6">

          <div className="flex gap-4">
            <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm w-[30%] shrink-0">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="size-5 text-blue-600" />
                  <CardTitle className="text-lg">Semester</CardTitle>
                </div>
                <CardDescription className="text-sm mt-1">Select the semester you're planning for</CardDescription>
              </CardHeader>
              <CardContent className="pt-2 pb-4">
                <Select value={semester} onValueChange={setSemester}>
                  <SelectTrigger className="w-full h-10 px-4 py-2 rounded-full border-2 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-semibold text-sm shadow-sm transition-colors focus-visible:ring-indigo-400 focus-visible:border-indigo-400 [&>svg]:text-indigo-500 [&>svg]:size-4">
                    <SelectValue placeholder="Choose a semester" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-lg border-0 overflow-hidden">
                    {upcomingSemesters.map((sem) => (
                      <SelectItem key={sem.value} value={sem.value} className="text-sm py-2 px-4 font-medium cursor-pointer">
                        {sem.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm flex-1">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="size-5 text-blue-600" />
                  <CardTitle className="text-lg">Target Credit Load</CardTitle>
                </div>
                <CardDescription className="text-sm mt-1">Set your minimum and maximum credits per semester</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <div className="text-center">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Min</span>
                      <div className="text-2xl font-bold text-blue-600 mt-0.5">{creditRange[0]}</div>
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Max</span>
                      <div className="text-2xl font-bold text-blue-600 mt-0.5">{creditRange[1]}</div>
                    </div>
                  </div>
                  <div className="px-2">
                    {/* TODO: hardcoded - replace min/max credit bounds with values from app config */}
                    <Slider
                      value={creditRange}
                      onValueChange={setCreditRange}
                      min={3}
                      max={18}
                      step={3}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-2 font-medium">
                      <span>3 credits</span>
                      <span>18 credits</span>
                    </div>
                  </div>
                  <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-200">
                    <p className="text-sm text-blue-800 text-center font-medium">
                      {creditRange[0]}–{creditRange[1]} credits this semester
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Required Constraints */}
          <div className="mb-6">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Required Constraints</h3>
              <div className="w-12 h-1 bg-gradient-to-r from-red-500 to-red-400 rounded-full mb-3" />
              <p className="text-sm text-red-600 font-medium">
                These are hard requirements — schedules that don't meet these will not be shown
              </p>
            </div>

            {/* Unavailable Times */}
            <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <XCircle className="size-5 text-red-600" />
                  <CardTitle className="text-lg">Unavailable Times (Required)</CardTitle>
                </div>
                <CardDescription className="text-sm mt-1">Block times when you are absolutely NOT available for classes</CardDescription>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="overflow-x-auto">
                  <div className="min-w-[700px] border border-gray-200 rounded-xl overflow-hidden bg-white shadow-inner">
                    <div className="grid grid-cols-7 gap-0">
                      <div className="text-xs font-bold text-gray-700 p-2 bg-gradient-to-r from-gray-100 to-gray-50 border-b border-gray-200 flex items-center justify-center">
                        TIME
                      </div>
                      {DAYS.map((day) => (
                        <div key={day} className="text-center font-bold text-xs py-2 px-1 bg-gradient-to-r from-gray-100 to-gray-50 border-b border-l border-gray-200">
                          {day.slice(0, 3)}
                        </div>
                      ))}
                      {TIME_SLOTS.map((slot, slotIndex) => (
                        <Fragment key={slot}>
                          <div className={`text-xs text-gray-700 flex items-center justify-center px-2 py-1.5 font-medium border-b border-gray-200 ${slotIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                            {slot}
                          </div>
                          {DAYS.map((day) => (
                            <button
                              key={`${day}-${slot}`}
                              onClick={() => toggleTimeSlot(day, slot)}
                              className={`h-8 transition-all duration-200 border-b border-l border-gray-200 hover:shadow-inner ${
                                isSlotBlocked(day, slot)
                                  ? "bg-red-100 hover:bg-red-200 border-red-200"
                                  : "bg-white hover:bg-green-50"
                              }`}
                            />
                          ))}
                        </Fragment>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="size-4 bg-white border border-gray-300 rounded" />
                    <span className="text-sm text-gray-600 font-medium">Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="size-4 bg-red-100 border border-red-200 rounded" />
                    <span className="text-sm text-gray-600 font-medium">Unavailable (Blocked)</span>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                  <p className="text-sm text-blue-800 leading-relaxed">
                    <strong>Enhanced Calendar Blocking:</strong> Use hourly precision across 7 days (Monday–Saturday)
                    for the most accurate schedule optimization. Click any time slot to block it completely.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Schedule Preferences */}
          <div className="mb-6">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Schedule Preferences</h3>
              <div className="w-12 h-1 bg-gradient-to-r from-blue-500 to-indigo-400 rounded-full mb-3" />
              <p className="text-sm text-gray-600">
                These are your preferences — we'll try to optimize for them when possible
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Class Timing */}
              <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Class Timing Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {[
                    { id: "backToBack", label: "Prefer back-to-back classes", key: "backToBack" },
                    // TODO: hardcoded - replace time boundary strings with values from shared time-slot constants
                    { id: "morningClasses", label: "Prefer morning classes (7:00–10:50 AM)", key: "morningClasses" },
                    { id: "midDayClasses", label: "Prefer mid-day classes (11:00 AM–3:50 PM)", key: "midDayClasses" },
                    { id: "eveningClasses", label: "Prefer evening classes (4:00–9:50 PM)", key: "eveningClasses" },
                  ].map(({ id, label, key }) => (
                    <div key={id} className="flex items-center space-x-3 p-2.5 rounded-lg hover:bg-blue-50 transition-colors">
                      <Checkbox
                        id={id}
                        checked={preferences[key as keyof typeof preferences]}
                        onCheckedChange={(checked) => updatePreference(key as keyof typeof preferences, checked as boolean)}
                        className="text-blue-600"
                      />
                      <Label htmlFor={id} className="text-sm cursor-pointer font-medium">{label}</Label>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Schedule & Format */}
              <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Schedule & Format Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {[
                    { id: "minimizeDays", label: "Minimize days on campus", key: "minimizeDays" },
                    { id: "preferInPerson", label: "Prefer in-person sections", key: "preferInPerson" },
                    { id: "preferRemote", label: "Prefer remote sections", key: "preferRemote" },
                  ].map(({ id, label, key }) => (
                    <div key={id} className="flex items-center space-x-3 p-2.5 rounded-lg hover:bg-blue-50 transition-colors">
                      <Checkbox
                        id={id}
                        checked={preferences[key as keyof typeof preferences]}
                        onCheckedChange={(checked) => updatePreference(key as keyof typeof preferences, checked as boolean)}
                        className="text-blue-600"
                      />
                      <Label htmlFor={id} className="text-sm cursor-pointer font-medium">{label}</Label>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Major Electives */}
            <Card className="mt-4 shadow-lg border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="size-5 text-indigo-600" />
                  <CardTitle className="text-lg">Major Electives</CardTitle>
                </div>
                <CardDescription className="text-sm mt-1">
                  Search and select up to 4 elective courses to include in your schedule
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-3">
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <XCircle className="size-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    Selected electives will be directly included in your generated schedule.
                  </p>
                </div>

                <div className="relative">
                  <div className={`flex items-center gap-2 border rounded-xl px-3 h-10 bg-white shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 ${electiveCourses.length >= 4 ? "border-gray-200 bg-gray-50" : "border-gray-300"}`}>
                    <Search className="size-4 text-gray-400 flex-shrink-0" />
                    <input
                      type="text"
                      value={electiveSearch}
                      onChange={(e) => setElectiveSearch(e.target.value)}
                      placeholder={electiveCourses.length >= 4 ? "Maximum of 4 courses selected" : "Search by course code or name..."}
                      disabled={electiveCourses.length >= 4}
                      className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400 disabled:cursor-not-allowed"
                    />
                    {isSearching && <span className="text-xs text-gray-400 whitespace-nowrap">Searching...</span>}
                  </div>

                  {electiveSearch.trim() && filteredResults.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {filteredResults.map((course) => (
                        <li
                          key={course.id}
                          onClick={() => { setElectiveCourses([...electiveCourses, course]); setElectiveSearch(""); }}
                          className="flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
                        >
                          <span className="font-semibold text-sm text-gray-900">{course.code}</span>
                          <span className="text-xs text-gray-500 truncate ml-4">{course.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {electiveSearch.trim() && !isSearching && filteredResults.length === 0 && searchResults.length === 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-2.5 text-sm text-gray-500">
                      No courses found
                    </div>
                  )}
                </div>

                {electiveCourses.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {electiveCourses.map((course) => (
                      <div key={course.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-full text-sm font-medium text-indigo-800">
                        <span>{course.code} — {course.name}</span>
                        <button
                          type="button"
                          onClick={() => setElectiveCourses(electiveCourses.filter((c) => c.id !== course.id))}
                          className="text-indigo-400 hover:text-indigo-700 transition-colors ml-0.5"
                          aria-label={`Remove ${course.code}`}
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-gray-400">{electiveCourses.length}/4 electives selected</p>
              </CardContent>
            </Card>

            {/* Course & Department Preferences */}
            <Card className="mt-4 shadow-lg border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="size-5 text-blue-600" />
                  <CardTitle className="text-lg">Course & Department Preferences</CardTitle>
                </div>
                <CardDescription className="text-sm mt-1">
                  Specify classes or departments you'd like to prioritize when fulfilling requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-3">
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-3 block">
                    Preferred Departments (Select all that apply)
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {DEPARTMENTS.map((dept) => (
                      <div key={dept} className="flex items-center space-x-2 p-2.5 rounded-lg hover:bg-blue-50 transition-colors border border-gray-200">
                        <Checkbox
                          id={dept}
                          checked={preferredDepartments.includes(dept)}
                          onCheckedChange={() => toggleDepartment(dept)}
                          className="text-blue-600"
                        />
                        <Label htmlFor={dept} className="text-sm cursor-pointer font-medium">{dept}</Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-3 italic">
                    When fulfilling requirements, we'll prioritize classes from these departments
                  </p>
                </div>

                <div>
                  <Label htmlFor="specificCourses" className="text-sm font-semibold text-gray-700 mb-2 block">
                    Specific Courses (Optional)
                  </Label>
                  <textarea
                    id="specificCourses"
                    value={specificCourses}
                    onChange={(e) => setSpecificCourses(e.target.value)}
                    placeholder="Enter specific course codes you'd like to take (e.g., PSYC 101, SOCI 200, HIST 150)"
                    className="w-full p-3 border border-gray-300 rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow shadow-sm"
                    rows={3}
                  />
                  <p className="text-sm text-gray-500 mt-2 italic">
                    List specific courses you want to include in your schedule, separated by commas
                  </p>
                </div>

                {preferredDepartments.length > 0 && (
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                    <p className="text-sm text-blue-800 font-medium">
                      <GraduationCap className="inline size-4 mr-1.5" />
                      <strong>Selected departments:</strong> {preferredDepartments.join(", ")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-4 pt-2">
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="flex-1 h-10 text-sm font-semibold border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors">
              Back
            </Button>
            <Button onClick={handleGenerateSchedules} className="flex-1 h-10 text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200">
              Generate Schedules
            </Button>
          </div>

        </div>
      </main>
    </div>
  );
}
