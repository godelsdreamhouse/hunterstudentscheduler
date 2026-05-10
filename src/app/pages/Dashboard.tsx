import { useNavigate } from "react-router";
import { useUserProfile } from "../hooks/useUserProfile";
import { useSetupProgress } from "../hooks/useSetupProgress";
import { Button } from "../components/ui/button";
import { API_BASE } from "../../lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Upload, Settings, AlertCircle, CheckCircle } from "lucide-react";
import logoImg from "../../assets/watchtower-logo.svg";

export function Dashboard() {
  const navigate = useNavigate();
  const { email: userEmail, name: userName, isLoading, refetch } = useUserProfile();
  const { progress } = useSetupProgress();

  const completedCount = [progress.preferencesSet, progress.auditUploaded].filter(Boolean).length;
  const allComplete = progress.preferencesSet && progress.auditUploaded;

  const handleSignOut = async () => {
    try {
      await fetch(`${API_BASE}/api/users/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      await refetch();
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logoImg} alt="Watchtower Logo" className="h-16 w-auto" />
          </div>
          <div className="flex items-center gap-6">
            <span className="text-lg text-gray-600 font-medium">
              {isLoading ? "Loading..." : userEmail}
            </span>
            <Button variant="outline" onClick={() => navigate("/settings")} className="border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors text-base px-4 py-2">
              <Settings className="size-4 mr-2" />
              Settings
            </Button>
            <Button variant="outline" onClick={handleSignOut} className="border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors text-base px-4 py-2">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-10">
        <div className="mb-10">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Welcome back, {isLoading ? "..." : (userName || "Student")}!</h2>
          <p className="text-xl text-gray-600 leading-relaxed">
            Let's build your perfect schedule{progress.semester ? ` for ${progress.semester}` : ""}
          </p>
        </div>

        <Card className="mb-10 shadow-lg border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader className="pb-6">
            <CardTitle className="text-2xl">Setup Progress</CardTitle>
            <CardDescription className="text-base mt-2">Complete these steps to generate your schedule</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-base font-semibold">Overall Progress</span>
                  <span className="text-lg text-gray-500">{completedCount} of 2 steps completed</span>
                </div>
                <Progress value={completedCount * 50} className="h-3" />
              </div>

              <div className="grid md:grid-cols-2 gap-6 mt-8">
                <div className={`flex items-start gap-4 p-6 border rounded-xl hover:shadow-md transition-shadow ${progress.preferencesSet ? "border-green-200 bg-gradient-to-br from-white to-green-50" : "border-gray-200 bg-gradient-to-br from-white to-gray-50"}`}>
                  {progress.preferencesSet
                    ? <CheckCircle className="size-6 text-green-500 mt-1 flex-shrink-0" />
                    : <AlertCircle className="size-6 text-amber-500 mt-1 flex-shrink-0" />}
                  <div className="flex-1">
                    <h4 className="font-semibold mb-2 text-xl">Set Preferences</h4>
                    <p className="text-lg text-gray-600 mb-5 leading-relaxed">
                      Configure your availability and schedule preferences
                    </p>
                    <Button size="lg" onClick={() => navigate("/preferences")} className={`w-full md:w-auto text-base ${progress.preferencesSet ? "bg-green-600 hover:bg-green-700" : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"}`}>
                      <Settings className="size-5 mr-2" />
                      {progress.preferencesSet ? "Edit Preferences" : "Set Preferences"}
                    </Button>
                  </div>
                </div>

                <div className={`flex items-start gap-4 p-6 border rounded-xl hover:shadow-md transition-shadow ${progress.auditUploaded ? "border-green-200 bg-gradient-to-br from-white to-green-50" : "border-gray-200 bg-gradient-to-br from-white to-gray-50"}`}>
                  {progress.auditUploaded
                    ? <CheckCircle className="size-6 text-green-500 mt-1 flex-shrink-0" />
                    : <AlertCircle className="size-6 text-amber-500 mt-1 flex-shrink-0" />}
                  <div className="flex-1">
                    <h4 className="font-semibold mb-2 text-xl">Upload DegreeWorks Audit</h4>
                    <p className="text-lg text-gray-600 mb-5 leading-relaxed">
                      Upload your PDF to analyze degree requirements
                    </p>
                    <Button size="lg" onClick={() => navigate("/upload")} className={`w-full md:w-auto text-base ${progress.auditUploaded ? "bg-green-600 hover:bg-green-700" : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"}`}>
                      <Upload className="size-5 mr-2" />
                      {progress.auditUploaded ? "Re-upload Audit" : "Upload Audit"}
                    </Button>
                  </div>
                </div>
              </div>

              {allComplete && (
                <div className="mt-6 flex items-center gap-5 p-6 rounded-xl bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-lg">
                  <div className="flex-1">
                    <p className="text-lg font-bold">You're all set!</p>
                    <p className="text-base text-indigo-100">Both steps are complete — view your generated schedules.</p>
                  </div>
                  <Button size="lg" onClick={() => navigate("/schedules")} className="shrink-0 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-base">
                    View Schedules
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-8 mb-10">
          <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-blue-50">
            <CardHeader className="pb-4">
              <CardDescription className="text-base font-medium text-gray-600">Credits Remaining</CardDescription>
              {/* TODO: hardcoded - replace with credits remaining from parsed DegreeWorks data */}
              <CardTitle className="text-4xl font-bold text-blue-600">45</CardTitle>
            </CardHeader>
            <CardContent>
              {/* TODO: hardcoded - replace with courses remaining derived from DegreeWorks data */}
              <p className="text-lg text-gray-600 font-medium">15 courses to graduation</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-green-50">
            <CardHeader className="pb-4">
              <CardDescription className="text-base font-medium text-gray-600">Current GPA</CardDescription>
              {/* TODO: hardcoded - replace with GPA from parsed DegreeWorks data or user profile */}
              <CardTitle className="text-4xl font-bold text-green-600">3.65</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-gray-600 font-medium">Maintain for honors</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-purple-50">
            <CardHeader className="pb-4">
              <CardDescription className="text-base font-medium text-gray-600">Expected Graduation</CardDescription>
              {/* TODO: hardcoded - replace with expected graduation year from user settings */}
              <CardTitle className="text-4xl font-bold text-purple-600">2028</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-gray-600 font-medium">Spring semester</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader className="pb-6">
            <CardTitle className="text-2xl">Getting Started</CardTitle>
            <CardDescription className="text-base mt-2">Tips to make the most of Watchtower</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-6">
              <li className="flex items-start gap-4">
                <div className="size-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-sm font-bold text-blue-700">1</span>
                </div>
                <div>
                  <p className="font-semibold text-xl mb-1">Download your DegreeWorks audit</p>
                  <p className="text-lg text-gray-600 leading-relaxed">Log into CUNYfirst and download your audit as a PDF</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="size-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-sm font-bold text-blue-700">2</span>
                </div>
                <div>
                  <p className="font-semibold text-xl mb-1">Upload and let us analyze</p>
                  <p className="text-lg text-gray-600 leading-relaxed">Our system will parse your requirements and prerequisites</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="size-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-sm font-bold text-blue-700">3</span>
                </div>
                <div>
                  <p className="font-semibold text-xl mb-1">Set your availability and preferences</p>
                  <p className="text-lg text-gray-600 leading-relaxed">Tell us when you're free and what matters to you</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="size-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-sm font-bold text-blue-700">4</span>
                </div>
                <div>
                  <p className="font-semibold text-xl mb-1">Review generated schedules</p>
                  <p className="text-lg text-gray-600 leading-relaxed">Get multiple conflict-free options optimized for your goals</p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}