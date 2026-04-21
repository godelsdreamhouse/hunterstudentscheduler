import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Slider } from "../components/ui/slider";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { ArrowLeft, Calendar, Clock, Target, XCircle } from "lucide-react";
import { Fragment } from "react";
import logoImg from "../../assets/9b3d587c8bb8091232b3d2c8640647d3ca857481.png";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const TIME_SLOTS = [
  "8:00 AM - 10:00 AM",
  "10:00 AM - 12:00 PM",
  "12:00 PM - 2:00 PM",
  "2:00 PM - 4:00 PM",
  "4:00 PM - 6:00 PM",
  "6:00 PM - 8:00 PM",
];

export function SetPreferences() {
  const navigate = useNavigate();
  const [creditLoad, setCreditLoad] = useState([12]);
  const [blockedTimes, setBlockedTimes] = useState<Record<string, Set<string>>>({});

  const toggleTimeSlot = (day: string, slot: string) => {
    setBlockedTimes((prev) => {
      const newBlockedTimes = { ...prev };
      if (!newBlockedTimes[day]) {
        newBlockedTimes[day] = new Set();
      }
      if (newBlockedTimes[day].has(slot)) {
        newBlockedTimes[day].delete(slot);
      } else {
        newBlockedTimes[day].add(slot);
      }
      return newBlockedTimes;
    });
  };

  const isSlotBlocked = (day: string, slot: string) => {
    return blockedTimes[day]?.has(slot) || false;
  };

  const handleGenerateSchedules = () => {
    navigate("/schedules");
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
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="size-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Set Your Preferences</h2>
          <p className="text-gray-600">
            Tell us about your availability and preferences to generate optimized schedules
          </p>
        </div>

        <div className="space-y-6">
          {/* Semester Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="size-5 text-purple-600" />
                <CardTitle>Semester</CardTitle>
              </div>
              <CardDescription>Select the semester you're planning for</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup defaultValue="fall-2026">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fall-2026" id="fall-2026" />
                  <Label htmlFor="fall-2026" className="cursor-pointer">Fall 2026</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="spring-2027" id="spring-2027" />
                  <Label htmlFor="spring-2027" className="cursor-pointer">Spring 2027</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="summer-2027" id="summer-2027" />
                  <Label htmlFor="summer-2027" className="cursor-pointer">Summer 2027</Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Credit Load */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Target className="size-5 text-purple-600" />
                <CardTitle>Target Credit Load</CardTitle>
              </div>
              <CardDescription>How many credits do you want to take?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Credits per semester</span>
                  <span className="text-2xl font-bold text-purple-600">{creditLoad[0]}</span>
                </div>
                <Slider
                  value={creditLoad}
                  onValueChange={setCreditLoad}
                  min={3}
                  max={18}
                  step={3}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>3 credits</span>
                  <span>18 credits</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time Unavailability */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <XCircle className="size-5 text-purple-600" />
                <CardTitle>Block Unavailable Times</CardTitle>
              </div>
              <CardDescription>Select times when you are NOT available for classes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                  <div className="grid grid-cols-6 gap-2">
                    {/* Header */}
                    <div></div>
                    {DAYS.map((day) => (
                      <div key={day} className="text-center font-medium text-sm py-2">
                        {day.slice(0, 3)}
                      </div>
                    ))}

                    {/* Time Slots */}
                    {TIME_SLOTS.map((slot) => (
                      <Fragment key={slot}>
                        <div className="text-xs text-gray-600 flex items-center pr-2">
                          {slot.split(" - ")[0]}
                        </div>
                        {DAYS.map((day) => (
                          <button
                            key={`${day}-${slot}`}
                            onClick={() => toggleTimeSlot(day, slot)}
                            className={`h-12 rounded border-2 transition-colors ${
                              isSlotBlocked(day, slot)
                                ? "bg-red-100 border-red-400"
                                : "bg-green-50 border-green-300 hover:border-green-400"
                            }`}
                          />
                        ))}
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="size-4 rounded bg-green-50 border-2 border-green-300"></div>
                  <span className="text-gray-600">Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-4 rounded bg-red-100 border-2 border-red-400"></div>
                  <span className="text-gray-600">Not Available (Blocked)</span>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Click on time slots to block when you're NOT available. All unblocked times are considered available.
              </p>
            </CardContent>
          </Card>

          {/* Additional Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Preferences</CardTitle>
              <CardDescription>Optional settings to customize your schedule</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox id="minimize-days" />
                  <Label htmlFor="minimize-days" className="cursor-pointer">
                    Minimize number of days on campus
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="avoid-early" />
                  <Label htmlFor="avoid-early" className="cursor-pointer">
                    Avoid early morning classes (before 10 AM)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="avoid-late" />
                  <Label htmlFor="avoid-late" className="cursor-pointer">
                    Avoid late evening classes (after 6 PM)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="lunch-break" />
                  <Label htmlFor="lunch-break" className="cursor-pointer">
                    Ensure lunch break (12 PM - 2 PM)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="back-to-back" />
                  <Label htmlFor="back-to-back" className="cursor-pointer">
                    Prefer back-to-back classes
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/dashboard")}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              size="lg"
              onClick={handleGenerateSchedules}
              className="flex-1"
            >
              Generate Schedules
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}