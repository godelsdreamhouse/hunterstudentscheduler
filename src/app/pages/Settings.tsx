import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ArrowLeft, User, GraduationCap, BookOpen, Save } from "lucide-react";
import logoImg from "../../assets/9b3d587c8bb8091232b3d2c8640647d3ca857481.png";

export function Settings() {
  const navigate = useNavigate();
  const [major, setMajor] = useState("Computer Science");
  const [minor, setMinor] = useState("Mathematics");

  const handleSave = () => {
    console.log("Save settings:", { major, minor });
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
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Settings</h2>
          <p className="text-gray-600">
            Manage your account and degree program information
          </p>
        </div>

        <div className="space-y-6">
          {/* Account Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="size-5 text-purple-600" />
                <CardTitle>Account Information</CardTitle>
              </div>
              <CardDescription>Your personal account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First Name</Label>
                  <Input id="first-name" defaultValue="John" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last Name</Label>
                  <Input id="last-name" defaultValue="Doe" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" defaultValue="student@hunter.cuny.edu" disabled />
                <p className="text-xs text-gray-500">Email cannot be changed</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="emplid">EMPLID (Student ID)</Label>
                <Input id="emplid" defaultValue="12345678" disabled />
                <p className="text-xs text-gray-500">Student ID is automatically populated from DegreeWorks</p>
              </div>
            </CardContent>
          </Card>

          {/* Degree Program */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <GraduationCap className="size-5 text-purple-600" />
                <CardTitle>Degree Program</CardTitle>
              </div>
              <CardDescription>
                Manually adjust your majors and minors (populated from DegreeWorks)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> These fields are automatically populated from your DegreeWorks audit. 
                  You can manually adjust them here if needed, but changes won't affect your official degree requirements.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="degree">Degree</Label>
                <Select defaultValue="bachelor-science">
                  <SelectTrigger id="degree">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bachelor-arts">Bachelor of Arts (B.A.)</SelectItem>
                    <SelectItem value="bachelor-science">Bachelor of Science (B.S.)</SelectItem>
                    <SelectItem value="bachelor-fine-arts">Bachelor of Fine Arts (B.F.A.)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="major">Primary Major</Label>
                <Select value={major} onValueChange={setMajor}>
                  <SelectTrigger id="major">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Computer Science">Computer Science</SelectItem>
                    <SelectItem value="Mathematics">Mathematics</SelectItem>
                    <SelectItem value="Physics">Physics</SelectItem>
                    <SelectItem value="Biology">Biology</SelectItem>
                    <SelectItem value="Chemistry">Chemistry</SelectItem>
                    <SelectItem value="Psychology">Psychology</SelectItem>
                    <SelectItem value="Economics">Economics</SelectItem>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="History">History</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="minor">Minor (Optional)</Label>
                <Select value={minor} onValueChange={setMinor}>
                  <SelectTrigger id="minor">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="Computer Science">Computer Science</SelectItem>
                    <SelectItem value="Mathematics">Mathematics</SelectItem>
                    <SelectItem value="Physics">Physics</SelectItem>
                    <SelectItem value="Biology">Biology</SelectItem>
                    <SelectItem value="Chemistry">Chemistry</SelectItem>
                    <SelectItem value="Psychology">Psychology</SelectItem>
                    <SelectItem value="Economics">Economics</SelectItem>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="History">History</SelectItem>
                    <SelectItem value="Philosophy">Philosophy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="concentration">Concentration (Optional)</Label>
                <Input id="concentration" placeholder="e.g., Software Engineering" />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expected-graduation">Expected Graduation</Label>
                  <Select defaultValue="spring-2028">
                    <SelectTrigger id="expected-graduation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fall-2026">Fall 2026</SelectItem>
                      <SelectItem value="spring-2027">Spring 2027</SelectItem>
                      <SelectItem value="fall-2027">Fall 2027</SelectItem>
                      <SelectItem value="spring-2028">Spring 2028</SelectItem>
                      <SelectItem value="fall-2028">Fall 2028</SelectItem>
                      <SelectItem value="spring-2029">Spring 2029</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="enrollment-status">Enrollment Status</Label>
                  <Select defaultValue="full-time">
                    <SelectTrigger id="enrollment-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">Full-time</SelectItem>
                      <SelectItem value="part-time">Part-time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* DegreeWorks Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="size-5 text-purple-600" />
                <CardTitle>DegreeWorks Audit</CardTitle>
              </div>
              <CardDescription>Manage your uploaded degree audit</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div>
                  <p className="font-medium text-green-900">Audit uploaded and analyzed</p>
                  <p className="text-sm text-green-700">Last uploaded: February 20, 2026</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/upload")}>
                  Re-upload Audit
                </Button>
              </div>
              <p className="text-sm text-gray-600">
                Upload a new DegreeWorks audit if your requirements have changed or to update your progress.
              </p>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1">
              <Save className="size-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}