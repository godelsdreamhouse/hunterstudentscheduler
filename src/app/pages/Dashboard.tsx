import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Upload, Settings, Calendar, CheckCircle, AlertCircle } from "lucide-react";
import logoImg from "../../assets/9b3d587c8bb8091232b3d2c8640647d3ca857481.png";

export function Dashboard() {
  const navigate = useNavigate();

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
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/settings")}
            >
              <Settings className="size-4 mr-2" />
              Settings
            </Button>
            <Button variant="outline" size="sm">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome back, Student!</h2>
          <p className="text-gray-600">
            Let's build your perfect schedule for Fall 2026
          </p>
        </div>

        {/* Progress Overview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Setup Progress</CardTitle>
            <CardDescription>Complete these steps to generate your schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm text-gray-500">0 of 2 steps completed</span>
                </div>
                <Progress value={0} className="h-2" />
              </div>
              
              <div className="grid md:grid-cols-2 gap-4 mt-6">
                <div className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg">
                  <AlertCircle className="size-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium mb-1">Set Preferences</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Configure your availability and schedule preferences
                    </p>
                    <Button
                      size="sm"
                      onClick={() => navigate("/preferences")}
                      className="w-full md:w-auto"
                    >
                      <Settings className="size-4 mr-2" />
                      Set Preferences
                    </Button>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg">
                  <AlertCircle className="size-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium mb-1">Upload DegreeWorks Audit</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Upload your PDF to analyze degree requirements
                    </p>
                    <Button
                      size="sm"
                      onClick={() => navigate("/upload")}
                      className="w-full md:w-auto"
                    >
                      <Upload className="size-4 mr-2" />
                      Upload Audit
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Credits Remaining</CardDescription>
              <CardTitle className="text-3xl">45</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">15 courses to graduation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Current GPA</CardDescription>
              <CardTitle className="text-3xl">3.65</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Maintain for honors</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Expected Graduation</CardDescription>
              <CardTitle className="text-3xl">2028</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Spring semester</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>Tips to make the most of Watchtower</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="size-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-purple-700">1</span>
                </div>
                <div>
                  <p className="font-medium">Download your DegreeWorks audit</p>
                  <p className="text-sm text-gray-600">
                    Log into CUNYfirst and download your audit as a PDF
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="size-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-purple-700">2</span>
                </div>
                <div>
                  <p className="font-medium">Upload and let us analyze</p>
                  <p className="text-sm text-gray-600">
                    Our system will parse your requirements and prerequisites
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="size-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-purple-700">3</span>
                </div>
                <div>
                  <p className="font-medium">Set your availability and preferences</p>
                  <p className="text-sm text-gray-600">
                    Tell us when you're free and what matters to you
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="size-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-purple-700">4</span>
                </div>
                <div>
                  <p className="font-medium">Review generated schedules</p>
                  <p className="text-sm text-gray-600">
                    Get multiple conflict-free options optimized for your goals
                  </p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}