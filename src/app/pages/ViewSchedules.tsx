import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Download, Calendar, Clock, MapPin, User, Star, CheckCircle, ArrowLeft } from "lucide-react";
import logoImg from "../../assets/9b3d587c8bb8091232b3d2c8640647d3ca857481.png";

const SCHEDULE_OPTIONS = [
  {
    id: 1,
    name: "Optimized Schedule",
    matchScore: 95,
    courses: [
      {
        code: "CSCI 335",
        title: "Data Structures & Algorithms",
        section: "01",
        instructor: "Dr. Sarah Johnson",
        days: "MW",
        time: "10:00 AM - 11:30 AM",
        location: "North 1001",
        credits: 4,
      },
      {
        code: "CSCI 360",
        title: "Computer Architecture",
        section: "02",
        instructor: "Prof. Michael Chen",
        days: "TuTh",
        time: "2:00 PM - 3:30 PM",
        location: "North 1007",
        credits: 3,
      },
      {
        code: "MATH 260",
        title: "Linear Algebra",
        section: "03",
        instructor: "Dr. Emily Rodriguez",
        days: "MW",
        time: "12:00 PM - 1:30 PM",
        location: "Hunter West 620",
        credits: 4,
      },
      {
        code: "ENGL 220",
        title: "Writing Intensive Core",
        section: "05",
        instructor: "Prof. David Kim",
        days: "TuTh",
        time: "10:00 AM - 11:30 AM",
        location: "Hunter West 405",
        credits: 3,
      },
    ],
    totalCredits: 14,
    daysOnCampus: 4,
    highlights: [
      "No early morning classes",
      "Lunch break every day",
      "High-rated professors",
    ],
  },
  {
    id: 2,
    name: "Compact Schedule",
    matchScore: 88,
    courses: [
      {
        code: "CSCI 335",
        title: "Data Structures & Algorithms",
        section: "03",
        instructor: "Dr. James Wilson",
        days: "TuTh",
        time: "9:00 AM - 10:30 AM",
        location: "North 1001",
        credits: 4,
      },
      {
        code: "CSCI 360",
        title: "Computer Architecture",
        section: "01",
        instructor: "Dr. Lisa Brown",
        days: "TuTh",
        time: "11:00 AM - 12:30 PM",
        location: "North 1005",
        credits: 3,
      },
      {
        code: "MATH 260",
        title: "Linear Algebra",
        section: "01",
        instructor: "Prof. Robert Taylor",
        days: "TuTh",
        time: "2:00 PM - 3:30 PM",
        location: "Hunter West 618",
        credits: 4,
      },
      {
        code: "ENGL 220",
        title: "Writing Intensive Core",
        section: "08",
        instructor: "Dr. Amanda Lee",
        days: "MW",
        time: "1:00 PM - 2:30 PM",
        location: "Hunter West 412",
        credits: 3,
      },
    ],
    totalCredits: 14,
    daysOnCampus: 4,
    highlights: [
      "Only 2 days per week",
      "Back-to-back classes",
      "Free Mondays and Wednesdays",
    ],
  },
  {
    id: 3,
    name: "Balanced Schedule",
    matchScore: 82,
    courses: [
      {
        code: "CSCI 335",
        title: "Data Structures & Algorithms",
        section: "02",
        instructor: "Prof. Jennifer Martinez",
        days: "MW",
        time: "3:00 PM - 4:30 PM",
        location: "North 1003",
        credits: 4,
      },
      {
        code: "CSCI 360",
        title: "Computer Architecture",
        section: "03",
        instructor: "Dr. Kevin Wang",
        days: "TuTh",
        time: "12:30 PM - 2:00 PM",
        location: "North 1009",
        credits: 3,
      },
      {
        code: "MATH 260",
        title: "Linear Algebra",
        section: "02",
        instructor: "Dr. Patricia Garcia",
        days: "MW",
        time: "11:00 AM - 12:30 PM",
        location: "Hunter West 622",
        credits: 4,
      },
      {
        code: "ENGL 220",
        title: "Writing Intensive Core",
        section: "06",
        instructor: "Prof. Christopher Davis",
        days: "TuTh",
        time: "3:00 PM - 4:30 PM",
        location: "Hunter West 408",
        credits: 3,
      },
    ],
    totalCredits: 14,
    daysOnCampus: 4,
    highlights: [
      "Spread across the week",
      "Moderate start times",
      "Consistent daily schedule",
    ],
  },
];

export function ViewSchedules() {
  const navigate = useNavigate();
  const [selectedSchedule, setSelectedSchedule] = useState(SCHEDULE_OPTIONS[0]);

  const handleExportSchedule = () => {
    console.log("Export schedule:", selectedSchedule.name);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="Watchtower Logo" className="h-32 w-auto" />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">student@hunter.cuny.edu</span>
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/preferences")}
          className="mb-6"
        >
          <ArrowLeft className="size-4 mr-2" />
          Back to Preferences
        </Button>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="size-8 text-green-600" />
            <h2 className="text-3xl font-bold text-gray-900">Your Generated Schedules</h2>
          </div>
          <p className="text-gray-600">
            We found {SCHEDULE_OPTIONS.length} conflict-free schedules that match your preferences and requirements
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Schedule Options List */}
          <div className="lg:col-span-1 space-y-4">
            {SCHEDULE_OPTIONS.map((schedule) => (
              <Card
                key={schedule.id}
                className={`cursor-pointer transition-all ${
                  selectedSchedule.id === schedule.id
                    ? "border-purple-500 shadow-md"
                    : "hover:border-gray-400"
                }`}
                onClick={() => setSelectedSchedule(schedule)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{schedule.name}</CardTitle>
                    <Badge
                      variant={schedule.id === 1 ? "default" : "secondary"}
                      className={schedule.id === 1 ? "bg-green-600" : ""}
                    >
                      {schedule.matchScore}% Match
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Credits</span>
                      <span className="font-medium">{schedule.totalCredits}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Days on Campus</span>
                      <span className="font-medium">{schedule.daysOnCampus}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Courses</span>
                      <span className="font-medium">{schedule.courses.length}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <ul className="space-y-1">
                      {schedule.highlights.slice(0, 2).map((highlight, idx) => (
                        <li key={idx} className="text-xs text-gray-600 flex items-center gap-1">
                          <span className="text-purple-600">•</span>
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Schedule Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">{selectedSchedule.name}</CardTitle>
                    <CardDescription className="mt-1">
                      Fall 2026 • {selectedSchedule.totalCredits} credits
                    </CardDescription>
                  </div>
                  <Button onClick={handleExportSchedule}>
                    <Download className="size-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <h4 className="font-medium text-green-900 mb-2">
                    Why this schedule works:
                  </h4>
                  <ul className="space-y-1">
                    {selectedSchedule.highlights.map((highlight, idx) => (
                      <li key={idx} className="text-sm text-green-800 flex items-center gap-2">
                        <CheckCircle className="size-4" />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>

                <Tabs defaultValue="list" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="list">Course List</TabsTrigger>
                    <TabsTrigger value="calendar">Calendar View</TabsTrigger>
                  </TabsList>

                  <TabsContent value="list" className="space-y-4 mt-6">
                    {selectedSchedule.courses.map((course) => (
                      <Card key={`${course.code}-${course.section}`}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-bold text-lg">
                                {course.code} - {course.title}
                              </h4>
                              <p className="text-sm text-gray-600">Section {course.section}</p>
                            </div>
                            <Badge>{course.credits} credits</Badge>
                          </div>
                          
                          <div className="grid md:grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center gap-2 text-gray-700">
                              <User className="size-4" />
                              <span>{course.instructor}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-700">
                              <Calendar className="size-4" />
                              <span>{course.days}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-700">
                              <Clock className="size-4" />
                              <span>{course.time}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-700">
                              <MapPin className="size-4" />
                              <span>{course.location}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="calendar" className="mt-6">
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="grid grid-cols-6 border-b border-gray-200">
                        <div className="p-3 bg-gray-50 border-r border-gray-200"></div>
                        {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => (
                          <div key={day} className="p-3 bg-gray-50 border-r border-gray-200 last:border-r-0 text-center font-medium text-sm">
                            {day.slice(0, 3)}
                          </div>
                        ))}
                      </div>
                      
                      {["8:00 AM", "10:00 AM", "12:00 PM", "2:00 PM", "4:00 PM"].map((time) => (
                        <div key={time} className="grid grid-cols-6 border-b border-gray-200 last:border-b-0 min-h-[80px]">
                          <div className="p-3 bg-gray-50 border-r border-gray-200 text-sm text-gray-600">
                            {time}
                          </div>
                          {["M", "Tu", "W", "Th", "F"].map((day) => {
                            const course = selectedSchedule.courses.find(
                              (c) => c.days.includes(day) && c.time.startsWith(time)
                            );
                            return (
                              <div key={day} className="p-2 border-r border-gray-200 last:border-r-0">
                                {course && (
                                  <div className="bg-purple-100 border border-purple-300 rounded p-2 h-full">
                                    <p className="font-medium text-xs text-purple-900">
                                      {course.code}
                                    </p>
                                    <p className="text-xs text-purple-700 mt-1">
                                      {course.location}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Next Steps</CardTitle>
                <CardDescription>Ready to register for these courses?</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button className="w-full" size="lg">
                    <Calendar className="size-4 mr-2" />
                    Export to Calendar
                  </Button>
                  <Button variant="outline" className="w-full" size="lg">
                    Open CUNYfirst to Register
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate("/preferences")}
                  >
                    Adjust Preferences
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}