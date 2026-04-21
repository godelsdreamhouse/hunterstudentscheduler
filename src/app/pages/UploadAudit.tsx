import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Upload, FileText, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import logoImg from "../../assets/9b3d587c8bb8091232b3d2c8640647d3ca857481.png";

export function UploadAudit() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "parsing" | "complete">("idle");
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!file) return;

    setUploadStatus("uploading");
    setProgress(0);

    // Simulate upload progress
    const uploadInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(uploadInterval);
          setUploadStatus("parsing");
          setTimeout(() => {
            setUploadStatus("complete");
          }, 2000);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const handleContinue = () => {
    navigate("/preferences");
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
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Upload DegreeWorks Audit</h2>
          <p className="text-gray-600">
            Upload your DegreeWorks PDF so we can analyze your degree requirements and prerequisites
          </p>
        </div>

        {uploadStatus === "idle" && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Your Audit</CardTitle>
              <CardDescription>
                Download your DegreeWorks audit from CUNYfirst as a PDF
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Upload Area */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-purple-400 transition-colors">
                  <Upload className="size-12 text-gray-400 mx-auto mb-4" />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <span className="text-purple-600 font-medium hover:text-purple-700">
                      Click to upload
                    </span>
                    <span className="text-gray-600"> or drag and drop</span>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-sm text-gray-500 mt-2">PDF up to 10MB</p>
                </div>

                {file && (
                  <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="size-8 text-purple-600" />
                      <div>
                        <p className="font-medium text-gray-900">{file.name}</p>
                        <p className="text-sm text-gray-600">
                          {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => setFile(null)}
                      variant="ghost"
                      size="sm"
                    >
                      Remove
                    </Button>
                  </div>
                )}

                <Button
                  onClick={handleUpload}
                  disabled={!file}
                  className="w-full"
                  size="lg"
                >
                  <Upload className="size-4 mr-2" />
                  Upload and Analyze
                </Button>

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                  <h4 className="font-medium text-blue-900 mb-2">How to get your DegreeWorks audit:</h4>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Log into CUNYfirst</li>
                    <li>Navigate to Self Service → Academic Progress → View my Degree Audit</li>
                    <li>Click "Generate New Audit"</li>
                    <li>Save or print the audit as a PDF</li>
                    <li>Upload the PDF here</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {(uploadStatus === "uploading" || uploadStatus === "parsing") && (
          <Card>
            <CardHeader>
              <CardTitle>
                {uploadStatus === "uploading" ? "Uploading..." : "Analyzing..."}
              </CardTitle>
              <CardDescription>
                {uploadStatus === "uploading"
                  ? "Uploading your DegreeWorks audit"
                  : "Parsing your degree requirements and prerequisites"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-gray-600 text-center">
                  {uploadStatus === "uploading"
                    ? `${progress}% uploaded`
                    : "This may take a few moments..."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {uploadStatus === "complete" && (
          <div className="space-y-6">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <CheckCircle className="size-8 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-medium text-green-900 text-lg mb-2">
                      Audit Successfully Analyzed!
                    </h3>
                    <p className="text-green-800 mb-4">
                      We've extracted your degree requirements and validated your prerequisites.
                    </p>
                    <Button onClick={handleContinue} className="bg-green-600 hover:bg-green-700">
                      Continue to Preferences
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Audit Summary</CardTitle>
                <CardDescription>Key information extracted from your DegreeWorks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Degree Progress</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Credits Completed</span>
                        <span className="font-medium">75 / 120</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Major Credits</span>
                        <span className="font-medium">36 / 48</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Core Requirements</span>
                        <span className="font-medium">24 / 30</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Electives</span>
                        <span className="font-medium">15 / 42</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Upcoming Requirements</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <AlertCircle className="size-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span>CSCI 335 - Data Structures</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <AlertCircle className="size-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span>CSCI 360 - Computer Architecture</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <AlertCircle className="size-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span>MATH 260 - Linear Algebra</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <AlertCircle className="size-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span>Additional Core Requirement</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}