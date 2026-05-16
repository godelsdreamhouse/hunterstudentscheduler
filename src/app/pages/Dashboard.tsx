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
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/dashboard")} className="cursor-pointer">
              <img src={logoImg} alt="Watchtower Logo" className="h-10 w-auto" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 font-medium">
              {isLoading ? "Loading..." : userEmail}
            </span>
            <Button variant="outline" onClick={handleSignOut} className="border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors text-sm px-4 py-2">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back, {isLoading ? "..." : (userName || "Student")}!</h2>
          <p className="text-sm text-gray-600">
            Let's build your perfect schedule{progress.semester ? ` for ${progress.semester}` : ""}
          </p>
        </div>

        <Card className="mb-6 shadow-lg border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Setup Progress</CardTitle>
            <CardDescription className="text-sm mt-1">Complete these steps to generate your schedule</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Overall Progress</span>
                  <span className="text-sm text-gray-500">{completedCount} of 2 steps completed</span>
                </div>
                <Progress value={completedCount * 50} className="h-2" />
              </div>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className={`flex items-start gap-3 p-4 border rounded-xl hover:shadow-md transition-shadow ${progress.auditUploaded ? "border-green-200 bg-gradient-to-br from-white to-green-50" : "border-gray-200 bg-gradient-to-br from-white to-gray-50"}`}>
                  {progress.auditUploaded
                    ? <CheckCircle className="size-5 text-green-500 mt-0.5 flex-shrink-0" />
                    : <AlertCircle className="size-5 text-amber-500 mt-0.5 flex-shrink-0" />}
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1 text-base">Upload DegreeWorks Audit</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Upload your PDF to analyze degree requirements
                    </p>
                    <Button size="sm" onClick={() => navigate("/upload")} className={`w-full md:w-auto text-sm ${progress.auditUploaded ? "bg-green-600 hover:bg-green-700" : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"}`}>
                      <Upload className="size-4 mr-1.5" />
                      {progress.auditUploaded ? "Re-upload Audit" : "Upload Audit"}
                    </Button>
                  </div>
                </div>

                <div className={`flex items-start gap-3 p-4 border rounded-xl hover:shadow-md transition-shadow ${progress.preferencesSet ? "border-green-200 bg-gradient-to-br from-white to-green-50" : "border-gray-200 bg-gradient-to-br from-white to-gray-50"}`}>
                  {progress.preferencesSet
                    ? <CheckCircle className="size-5 text-green-500 mt-0.5 flex-shrink-0" />
                    : <AlertCircle className="size-5 text-amber-500 mt-0.5 flex-shrink-0" />}
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1 text-base">Set Preferences</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Configure your availability and schedule preferences
                    </p>
                    <Button size="sm" onClick={() => navigate("/preferences")} className={`w-full md:w-auto text-sm ${progress.preferencesSet ? "bg-green-600 hover:bg-green-700" : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"}`}>
                      <Settings className="size-4 mr-1.5" />
                      {progress.preferencesSet ? "Edit Preferences" : "Set Preferences"}
                    </Button>
                  </div>
                </div>
              </div>

              {allComplete && (
                <div className="mt-4 flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-lg">
                  <div className="flex-1">
                    <p className="text-sm font-bold">You're all set!</p>
                    <p className="text-xs text-indigo-100">Both steps are complete — view your generated schedules.</p>
                  </div>
                  <Button size="sm" onClick={() => navigate("/schedules")} className="shrink-0 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-sm">
                    View Schedules
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-blue-50">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium text-gray-600">Credits Remaining</CardDescription>
              {/* TODO: hardcoded - replace with credits remaining from parsed DegreeWorks data */}
              <CardTitle className="text-2xl font-bold text-blue-600">45</CardTitle>
            </CardHeader>
            <CardContent>
              {/* TODO: hardcoded - replace with courses remaining derived from DegreeWorks data */}
              <p className="text-sm text-gray-600 font-medium">15 courses to graduation</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-green-50">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium text-gray-600">Current GPA</CardDescription>
              {/* TODO: hardcoded - replace with GPA from parsed DegreeWorks data or user profile */}
              <CardTitle className="text-2xl font-bold text-green-600">3.65</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 font-medium">Maintain for honors</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-purple-50">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium text-gray-600">Expected Graduation</CardDescription>
              {/* TODO: hardcoded - replace with expected graduation year from user settings */}
              <CardTitle className="text-2xl font-bold text-purple-600">2028</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 font-medium">Spring semester</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Getting Started</CardTitle>
            <CardDescription className="text-sm mt-1">Tips to make the most of Watchtower</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="size-6 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-700">1</span>
                </div>
                <div>
                  <p className="font-semibold text-sm mb-0.5">Download your DegreeWorks audit</p>
                  <p className="text-sm text-gray-600">Log into CUNYfirst and download your audit as a PDF</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="size-6 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-700">2</span>
                </div>
                <div>
                  <p className="font-semibold text-sm mb-0.5">Upload and let us analyze</p>
                  <p className="text-sm text-gray-600">Our system will parse your requirements and prerequisites</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="size-6 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-700">3</span>
                </div>
                <div>
                  <p className="font-semibold text-sm mb-0.5">Set your availability and preferences</p>
                  <p className="text-sm text-gray-600">Tell us when you're free and what matters to you</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="size-6 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-700">4</span>
                </div>
                <div>
                  <p className="font-semibold text-sm mb-0.5">Review generated schedules</p>
                  <p className="text-sm text-gray-600">Get multiple conflict-free options optimized for your goals</p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
