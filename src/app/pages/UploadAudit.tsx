import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Upload, FileText, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import logoImg from "../../assets/watchtower-logo.svg";
import { useUserProfile } from "../hooks/useUserProfile";

export function UploadAudit() {
  const navigate = useNavigate();
  const { email: userEmail } = useUserProfile();
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "parsing" | "complete">("idle");
  const [progress, setProgress] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!file) return;

    setUploadStatus("uploading");
    setProgress(0);

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(intervalRef.current!);
          setUploadStatus("parsing");
          // TODO: hardcoded - replace 2000ms parsing delay with a real async API call
          timeoutRef.current = setTimeout(() => {
            setUploadStatus("complete");
          }, 2000);
          return 100;
        }
        // TODO: hardcoded - replace simulated upload (10% per 200ms interval) with real upload progress from API
        return prev + 10;
      });
    }, 200);
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
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Upload DegreeWorks Audit</h2>
          <p className="text-xl text-gray-600 leading-relaxed">
            Upload your DegreeWorks PDF so we can analyze your degree requirements and prerequisites
          </p>
        </div>

        {uploadStatus === "idle" && (
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl">Upload Your Audit</CardTitle>
              <CardDescription className="text-lg mt-2">
                Download your DegreeWorks audit from CUNYfirst as a PDF
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="space-y-6">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-purple-400 transition-colors bg-gray-50/50">
                  <Upload className="size-14 text-gray-400 mx-auto mb-5" />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <span className="text-xl text-purple-600 font-semibold hover:text-purple-700">
                      Click to upload
                    </span>
                    <span className="text-xl text-gray-600"> or drag and drop</span>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  {/* TODO: hardcoded - replace with MAX_FILE_SIZE_MB constant from app config */}
                  <p className="text-lg text-gray-500 mt-3">PDF up to 10MB</p>
                </div>

                {file && (
                  <div className="flex items-center justify-between p-5 bg-purple-50 border border-purple-200 rounded-xl">
                    <div className="flex items-center gap-4">
                      <FileText className="size-10 text-purple-600" />
                      <div>
                        <p className="text-lg font-semibold text-gray-900">{file.name}</p>
                        <p className="text-base text-gray-600">{(file.size / 1024).toFixed(2)} KB</p>
                      </div>
                    </div>
                    <Button onClick={() => setFile(null)} variant="ghost" className="text-base">
                      Remove
                    </Button>
                  </div>
                )}

                <Button onClick={handleUpload} disabled={!file} className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200" size="lg">
                  <Upload className="size-5 mr-2" />
                  Upload and Analyze
                </Button>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mt-6">
                  <h4 className="text-lg font-semibold text-blue-900 mb-3">How to get your DegreeWorks audit:</h4>
                  <ol className="text-lg text-blue-800 space-y-2 list-decimal list-inside leading-relaxed">
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
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl">
                {uploadStatus === "uploading" ? "Uploading..." : "Analyzing..."}
              </CardTitle>
              <CardDescription className="text-lg mt-2">
                {uploadStatus === "uploading"
                  ? "Uploading your DegreeWorks audit"
                  : "Parsing your degree requirements and prerequisites"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="space-y-5">
                <Progress value={progress} className="h-3" />
                <p className="text-lg text-gray-600 text-center">
                  {uploadStatus === "uploading"
                    ? `${progress}% uploaded`
                    : "This may take a few moments..."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {uploadStatus === "complete" && (
          <div className="space-y-8">
            <Card className="shadow-lg border-0 border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-5">
                  <CheckCircle className="size-10 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-green-900 mb-3">
                      Audit Successfully Analyzed!
                    </h3>
                    <p className="text-lg text-green-800 mb-5">
                      We've extracted your degree requirements and validated your prerequisites.
                    </p>
                    <Button
                      size="lg"
                      onClick={() => navigate("/preferences")}
                      className="h-12 text-base font-semibold bg-green-600 hover:bg-green-700"
                    >
                      Continue to Preferences
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl">Audit Summary</CardTitle>
                <CardDescription className="text-lg mt-2">Key information extracted from your DegreeWorks</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    {/* TODO: hardcoded - replace all credit stats with data parsed from the uploaded DegreeWorks PDF */}
                    <h4 className="text-xl font-semibold mb-4">Degree Progress</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-lg">
                        <span className="text-gray-600">Credits Completed</span>
                        <span className="font-semibold">75 / 120</span>
                      </div>
                      <div className="flex justify-between text-lg">
                        <span className="text-gray-600">Major Credits</span>
                        <span className="font-semibold">36 / 48</span>
                      </div>
                      <div className="flex justify-between text-lg">
                        <span className="text-gray-600">Core Requirements</span>
                        <span className="font-semibold">24 / 30</span>
                      </div>
                      <div className="flex justify-between text-lg">
                        <span className="text-gray-600">Electives</span>
                        <span className="font-semibold">15 / 42</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xl font-semibold mb-4">Upcoming Requirements</h4>
                    <ul className="space-y-3 text-lg">
                      {/* TODO: hardcoded - replace with upcoming requirements parsed from DegreeWorks PDF */}
                      <li className="flex items-start gap-3">
                        <AlertCircle className="size-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span>CSCI 335 - Data Structures</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <AlertCircle className="size-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span>CSCI 360 - Computer Architecture</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <AlertCircle className="size-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span>MATH 260 - Linear Algebra</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <AlertCircle className="size-5 text-blue-600 flex-shrink-0 mt-0.5" />
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
