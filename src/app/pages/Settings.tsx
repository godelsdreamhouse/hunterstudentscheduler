import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useUserProfile } from "../hooks/useUserProfile";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ArrowLeft, User, GraduationCap, BookOpen, Save } from "lucide-react";
import logoImg from "../../assets/watchtower-logo.svg";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Settings() {
  const navigate = useNavigate();
  const { email: userEmail, name } = useUserProfile();
  // TODO: hardcoded - replace with major from parsed DegreeWorks data or user profile API
  const [major, setMajor] = useState("Computer Science");
  // TODO: hardcoded - replace with minor from parsed DegreeWorks data or user profile API
  const [minor, setMinor] = useState("Mathematics");
  // TODO: hardcoded - replace with degree type from parsed DegreeWorks data or user profile API
  const [degree, setDegree] = useState("bachelor-science");
  // TODO: hardcoded - replace with expected graduation from parsed DegreeWorks data or user profile API
  const [expectedGraduation, setExpectedGraduation] = useState("spring-2028");
  // TODO: hardcoded - replace with enrollment status from parsed DegreeWorks data or user profile API
  const [enrollmentStatus, setEnrollmentStatus] = useState("full-time");
  const [concentration, setConcentration] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!name) return;
    const parts = name.split(".");
    setFirstName(capitalize(parts[0] ?? ""));
    setLastName(capitalize((parts[1] ?? "").replace(/\d+$/, "")));
  }, [name]);

  const handleSave = () => {
    setSaveSuccess(true);
    // TODO: hardcoded - replace 3000ms with a UI_FEEDBACK_TIMEOUT constant from app config
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="Watchtower Logo" className="h-16 w-auto" />
          </div>
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
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Settings</h2>
          <p className="text-xl text-gray-600 leading-relaxed">Manage your account and degree program information</p>
        </div>

        <div className="space-y-8">
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <User className="size-6 text-purple-600" />
                <CardTitle className="text-2xl">Account Information</CardTitle>
              </div>
              <CardDescription className="text-lg mt-2">Your personal account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-2">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="first-name" className="text-base font-semibold">First Name</Label>
                  <Input id="first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-12 text-base" />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="last-name" className="text-base font-semibold">Last Name</Label>
                  <Input id="last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-12 text-base" />
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor="email" className="text-base font-semibold">Email</Label>
                <Input id="email" type="email" value={userEmail} disabled readOnly className="h-12 text-base" />
                <p className="text-base text-gray-500">Email cannot be changed</p>
              </div>
              <div className="space-y-3">
                <Label htmlFor="emplid" className="text-base font-semibold">EMPLID (Student ID)</Label>
                {/* TODO: hardcoded - replace with EMPLID from parsed DegreeWorks data */}
                <Input id="emplid" defaultValue="12345678" disabled className="h-12 text-base" />
                <p className="text-base text-gray-500">Student ID is automatically populated from DegreeWorks</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <GraduationCap className="size-6 text-purple-600" />
                <CardTitle className="text-2xl">Degree Program</CardTitle>
              </div>
              <CardDescription className="text-lg mt-2">
                Manually adjust your majors and minors (populated from DegreeWorks)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-2">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <p className="text-lg text-blue-900">
                  <strong>Note:</strong> These fields are automatically populated from your DegreeWorks audit.
                  You can manually adjust them here if needed, but changes won't affect your official degree requirements.
                </p>
              </div>

              <div className="space-y-3">
                <Label htmlFor="degree" className="text-base font-semibold">Degree</Label>
                <Select value={degree} onValueChange={setDegree}>
                  <SelectTrigger id="degree" className="h-12 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bachelor-arts" className="text-base">Bachelor of Arts (B.A.)</SelectItem>
                    <SelectItem value="bachelor-science" className="text-base">Bachelor of Science (B.S.)</SelectItem>
                    <SelectItem value="bachelor-fine-arts" className="text-base">Bachelor of Fine Arts (B.F.A.)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="major" className="text-base font-semibold">Primary Major</Label>
                <Select value={major} onValueChange={setMajor}>
                  <SelectTrigger id="major" className="h-12 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Computer Science" className="text-base">Computer Science</SelectItem>
                    <SelectItem value="Mathematics" className="text-base">Mathematics</SelectItem>
                    <SelectItem value="Physics" className="text-base">Physics</SelectItem>
                    <SelectItem value="Biology" className="text-base">Biology</SelectItem>
                    <SelectItem value="Chemistry" className="text-base">Chemistry</SelectItem>
                    <SelectItem value="Psychology" className="text-base">Psychology</SelectItem>
                    <SelectItem value="Economics" className="text-base">Economics</SelectItem>
                    <SelectItem value="English" className="text-base">English</SelectItem>
                    <SelectItem value="History" className="text-base">History</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="minor" className="text-base font-semibold">Minor (Optional)</Label>
                <Select value={minor} onValueChange={setMinor}>
                  <SelectTrigger id="minor" className="h-12 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-base">None</SelectItem>
                    <SelectItem value="Computer Science" className="text-base">Computer Science</SelectItem>
                    <SelectItem value="Mathematics" className="text-base">Mathematics</SelectItem>
                    <SelectItem value="Physics" className="text-base">Physics</SelectItem>
                    <SelectItem value="Biology" className="text-base">Biology</SelectItem>
                    <SelectItem value="Chemistry" className="text-base">Chemistry</SelectItem>
                    <SelectItem value="Psychology" className="text-base">Psychology</SelectItem>
                    <SelectItem value="Economics" className="text-base">Economics</SelectItem>
                    <SelectItem value="English" className="text-base">English</SelectItem>
                    <SelectItem value="History" className="text-base">History</SelectItem>
                    <SelectItem value="Philosophy" className="text-base">Philosophy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="concentration" className="text-base font-semibold">Concentration (Optional)</Label>
                <Input id="concentration" value={concentration} onChange={(e) => setConcentration(e.target.value)} placeholder="e.g., Software Engineering" className="h-12 text-base" />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="expected-graduation" className="text-base font-semibold">Expected Graduation</Label>
                  <Select value={expectedGraduation} onValueChange={setExpectedGraduation}>
                    <SelectTrigger id="expected-graduation" className="h-12 text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fall-2026" className="text-base">Fall 2026</SelectItem>
                      <SelectItem value="spring-2027" className="text-base">Spring 2027</SelectItem>
                      <SelectItem value="fall-2027" className="text-base">Fall 2027</SelectItem>
                      <SelectItem value="spring-2028" className="text-base">Spring 2028</SelectItem>
                      <SelectItem value="fall-2028" className="text-base">Fall 2028</SelectItem>
                      <SelectItem value="spring-2029" className="text-base">Spring 2029</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="enrollment-status" className="text-base font-semibold">Enrollment Status</Label>
                  <Select value={enrollmentStatus} onValueChange={setEnrollmentStatus}>
                    <SelectTrigger id="enrollment-status" className="h-12 text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time" className="text-base">Full-time</SelectItem>
                      <SelectItem value="part-time" className="text-base">Part-time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <BookOpen className="size-6 text-purple-600" />
                <CardTitle className="text-2xl">DegreeWorks Audit</CardTitle>
              </div>
              <CardDescription className="text-lg mt-2">Manage your uploaded degree audit</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="flex items-center justify-between p-5 bg-green-50 border border-green-200 rounded-xl">
                <div>
                  <p className="text-lg font-semibold text-green-900">Audit uploaded and analyzed</p>
                  {/* TODO: hardcoded - replace with actual upload timestamp from backend */}
                  <p className="text-base text-green-700 mt-1">Last uploaded: February 20, 2026</p>
                </div>
                <Button variant="outline" onClick={() => navigate("/upload")} className="text-base px-4 py-2">
                  Re-upload Audit
                </Button>
              </div>
              <p className="text-lg text-gray-600">
                Upload a new DegreeWorks audit if your requirements have changed or to update your progress.
              </p>
            </CardContent>
          </Card>

          <div className="flex gap-6 pt-2">
            {saveSuccess && (
              <p className="self-center text-base text-green-700 font-medium">Settings saved.</p>
            )}
            <Button variant="outline" size="lg" onClick={() => navigate("/dashboard")} className="flex-1 h-14 text-lg font-semibold border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors">
              Cancel
            </Button>
            <Button size="lg" onClick={handleSave} className="flex-1 h-14 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200">
              <Save className="size-5 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
