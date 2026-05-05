import { useState, Fragment } from "react";
import { useNavigate } from "react-router";
import { useUserProfile } from "../hooks/useUserProfile";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Slider } from "../components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ArrowLeft, Calendar, XCircle, BookOpen, GraduationCap, SlidersHorizontal } from "lucide-react";
import logoImg from "../../assets/watchtower-logo.svg";
import { useSetupProgress } from "../hooks/useSetupProgress";

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

export function SetPreferences() {
  const navigate = useNavigate();
  const { email: userEmail } = useUserProfile();
  // TODO: hardcoded - replace with default credit range from app config
  const [creditRange, setCreditRange] = useState([12, 15]);
  // TODO: hardcoded - replace with upcoming semester derived from current date
  const [semester, setSemester] = useState("fall-2026");
  const [blockedTimes, setBlockedTimes] = useState<Record<string, Set<string>>>({});
  const [preferences, setPreferences] = useState({
    backToBack: false,
    morningClasses: false,
    midDayClasses: false,
    eveningClasses: false,
    minimizeDays: false,
    preferInPerson: false,
    preferRemote: false,
  });
  const [preferredDepartments, setPreferredDepartments] = useState<string[]>([]);
  const [specificCourses, setSpecificCourses] = useState<string>("");

  const toggleTimeSlot = (day: string, slot: string) => {
    setBlockedTimes((prev) => {
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
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const toggleDepartment = (dept: string) => {
    setPreferredDepartments(prev =>
      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
    );
  };

  const isSlotBlocked = (day: string, slot: string) => {
    return blockedTimes[day]?.has(slot) || false;
  };

  const { markPreferencesSet } = useSetupProgress();

  const handleGenerateSchedules = () => {
    markPreferencesSet();
    navigate("/schedules");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-5 flex items-center justify-between">
          <img src={logoImg} alt="Watchtower Logo" className="h-16 w-auto" />
          <div className="flex items-center gap-6">
            <span className="text-lg text-gray-600 font-medium">{userEmail}</span>
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors text-base px-4 py-2">
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-10">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="mb-8 hover:bg-white/60 text-gray-600 hover:text-gray-800 transition-all">
          <ArrowLeft className="size-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-10">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Set Your Preferences</h2>
          <p className="text-xl text-gray-600 leading-relaxed">
            Tell us about your availability and preferences to generate optimized schedules
          </p>
        </div>

        <div className="space-y-10">

  
          <div className="flex gap-6">
            <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm w-[30%] shrink-0">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Calendar className="size-6 text-blue-600" />
                  <CardTitle className="text-2xl">Semester</CardTitle>
                </div>
                <CardDescription className="text-base mt-1">Select the semester you're planning for</CardDescription>
              </CardHeader>
              <CardContent className="pt-2 pb-5">
                <Select value={semester} onValueChange={setSemester}>
                  <SelectTrigger className="w-full h-14 px-6 py-4 rounded-full border-2 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-semibold text-lg shadow-sm transition-colors focus-visible:ring-indigo-400 focus-visible:border-indigo-400 [&>svg]:text-indigo-500 [&>svg]:size-5">
                    <SelectValue placeholder="Choose a semester" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-lg border-0 overflow-hidden">
                    <SelectItem value="fall-2026" className="text-base py-3 px-4 font-medium cursor-pointer">Fall 2026</SelectItem>
                    <SelectItem value="spring-2027" className="text-base py-3 px-4 font-medium cursor-pointer">Spring 2027</SelectItem>
                    <SelectItem value="summer-2027" className="text-base py-3 px-4 font-medium cursor-pointer">Summer 2027</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Right: Target Credit Load */}
            <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm flex-1">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <SlidersHorizontal className="size-6 text-blue-600" />
                  <CardTitle className="text-2xl">Target Credit Load</CardTitle>
                </div>
                <CardDescription className="text-lg mt-2">Set your minimum and maximum credits per semester</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <div className="text-center">
                      <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Min</span>
                      <div className="text-4xl font-bold text-blue-600 mt-1">{creditRange[0]}</div>
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Max</span>
                      <div className="text-4xl font-bold text-blue-600 mt-1">{creditRange[1]}</div>
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
                    <div className="flex justify-between text-sm text-gray-500 mt-3 font-medium">
                      <span>3 credits</span>
                      <span>18 credits</span>
                    </div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                    <p className="text-base text-blue-800 text-center font-medium">
                      {creditRange[0]}–{creditRange[1]} credits this semester
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Required Constraints */}
          <div className="mb-12">
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Required Constraints</h3>
              <div className="w-16 h-1 bg-gradient-to-r from-red-500 to-red-400 rounded-full mb-4" />
              <p className="text-lg text-red-600 font-medium">
                These are hard requirements — schedules that don't meet these will not be shown
              </p>
            </div>

            {/* Unavailable Times */}
            <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <XCircle className="size-6 text-red-600" />
                  <CardTitle className="text-2xl">Unavailable Times (Required)</CardTitle>
                </div>
                <CardDescription className="text-lg mt-2">Block times when you are absolutely NOT available for classes</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="overflow-x-auto">
                  <div className="min-w-[700px] border border-gray-200 rounded-xl overflow-hidden bg-white shadow-inner">
                    <div className="grid grid-cols-7 gap-0">
                      <div className="text-xs font-bold text-gray-700 p-3 bg-gradient-to-r from-gray-100 to-gray-50 border-b border-gray-200 flex items-center justify-center">
                        TIME
                      </div>
                      {DAYS.map((day) => (
                        <div key={day} className="text-center font-bold text-sm py-3 px-1 bg-gradient-to-r from-gray-100 to-gray-50 border-b border-l border-gray-200">
                          {day.slice(0, 3)}
                        </div>
                      ))}
                      {TIME_SLOTS.map((slot, slotIndex) => (
                        <Fragment key={slot}>
                          <div className={`text-xs text-gray-700 flex items-center justify-center px-2 py-2 font-medium border-b border-gray-200 ${slotIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                            {slot}
                          </div>
                          {DAYS.map((day) => (
                            <button
                              key={`${day}-${slot}`}
                              onClick={() => toggleTimeSlot(day, slot)}
                              className={`h-10 transition-all duration-200 border-b border-l border-gray-200 hover:shadow-inner ${
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
                <div className="mt-6 flex items-center gap-8">
                  <div className="flex items-center gap-3">
                    <div className="size-5 bg-white border border-gray-300 rounded" />
                    <span className="text-base text-gray-600 font-medium">Available</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="size-5 bg-red-100 border border-red-200 rounded" />
                    <span className="text-base text-gray-600 font-medium">Unavailable (Blocked)</span>
                  </div>
                </div>
                <div className="mt-6 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                  <p className="text-base text-blue-800 leading-relaxed">
                    <strong>Enhanced Calendar Blocking:</strong> Use hourly precision across 7 days (Monday–Saturday)
                    for the most accurate schedule optimization. Click any time slot to block it completely.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Schedule Preferences */}
          <div className="mb-12">
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Schedule Preferences</h3>
              <div className="w-16 h-1 bg-gradient-to-r from-blue-500 to-indigo-400 rounded-full mb-4" />
              <p className="text-lg text-gray-600 leading-relaxed">
                These are your preferences — we'll try to optimize for them when possible
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Class Timing */}
              <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl font-semibold">Class Timing Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { id: "backToBack", label: "Prefer back-to-back classes", key: "backToBack" },
                    // TODO: hardcoded - replace time boundary strings with values from shared time-slot constants
                    { id: "morningClasses", label: "Prefer morning classes (7:00–10:50 AM)", key: "morningClasses" },
                    { id: "midDayClasses", label: "Prefer mid-day classes (11:00 AM–3:50 PM)", key: "midDayClasses" },
                    { id: "eveningClasses", label: "Prefer evening classes (4:00–9:50 PM)", key: "eveningClasses" },
                  ].map(({ id, label, key }) => (
                    <div key={id} className="flex items-center space-x-3 p-4 rounded-lg hover:bg-blue-50 transition-colors">
                      <Checkbox
                        id={id}
                        checked={preferences[key as keyof typeof preferences]}
                        onCheckedChange={(checked) => updatePreference(key as keyof typeof preferences, checked as boolean)}
                        className="text-blue-600"
                      />
                      <Label htmlFor={id} className="text-lg cursor-pointer font-medium">{label}</Label>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Schedule & Format */}
              <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl font-semibold">Schedule & Format Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { id: "minimizeDays", label: "Minimize days on campus", key: "minimizeDays" },
                    { id: "preferInPerson", label: "Prefer in-person sections", key: "preferInPerson" },
                    { id: "preferRemote", label: "Prefer remote sections", key: "preferRemote" },
                  ].map(({ id, label, key }) => (
                    <div key={id} className="flex items-center space-x-3 p-4 rounded-lg hover:bg-blue-50 transition-colors">
                      <Checkbox
                        id={id}
                        checked={preferences[key as keyof typeof preferences]}
                        onCheckedChange={(checked) => updatePreference(key as keyof typeof preferences, checked as boolean)}
                        className="text-blue-600"
                      />
                      <Label htmlFor={id} className="text-lg cursor-pointer font-medium">{label}</Label>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Course & Department Preferences */}
            <Card className="mt-8 shadow-lg border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <BookOpen className="size-6 text-blue-600" />
                  <CardTitle className="text-2xl">Course & Department Preferences</CardTitle>
                </div>
                <CardDescription className="text-lg mt-2">
                  Specify classes or departments you'd like to prioritize when fulfilling requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8 pt-4">
                <div>
                  <Label className="text-lg font-semibold text-gray-700 mb-4 block">
                    Preferred Departments (Select all that apply)
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {DEPARTMENTS.map((dept) => (
                      <div key={dept} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-50 transition-colors border border-gray-200">
                        <Checkbox
                          id={dept}
                          checked={preferredDepartments.includes(dept)}
                          onCheckedChange={() => toggleDepartment(dept)}
                          className="text-blue-600"
                        />
                        <Label htmlFor={dept} className="text-base cursor-pointer font-medium">{dept}</Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-base text-gray-500 mt-4 italic">
                    When fulfilling requirements, we'll prioritize classes from these departments
                  </p>
                </div>

                <div>
                  <Label htmlFor="specificCourses" className="text-lg font-semibold text-gray-700 mb-3 block">
                    Specific Courses (Optional)
                  </Label>
                  <textarea
                    id="specificCourses"
                    value={specificCourses}
                    onChange={(e) => setSpecificCourses(e.target.value)}
                    placeholder="Enter specific course codes you'd like to take (e.g., PSYC 101, SOCI 200, HIST 150)"
                    className="w-full p-4 border border-gray-300 rounded-xl text-base resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow shadow-sm"
                    rows={4}
                  />
                  <p className="text-base text-gray-500 mt-3 italic">
                    List specific courses you want to include in your schedule, separated by commas
                  </p>
                </div>

                {preferredDepartments.length > 0 && (
                  <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                    <p className="text-base text-blue-800 font-medium">
                      <GraduationCap className="inline size-5 mr-2" />
                      <strong>Selected departments:</strong> {preferredDepartments.join(", ")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-6 pt-4">
            <Button variant="outline" size="lg" onClick={() => navigate("/dashboard")} className="flex-1 h-14 text-lg font-semibold border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors">
              Back
            </Button>
            <Button size="lg" onClick={handleGenerateSchedules} className="flex-1 h-14 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200">
              Generate Schedules
            </Button>
          </div>

        </div>
      </main>
    </div>
  );
}
