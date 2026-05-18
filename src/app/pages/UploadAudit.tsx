import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Upload, FileText, CheckCircle, Circle, AlertCircle, ArrowLeft, X } from "lucide-react";
import logoImg from "../../assets/watchtower-logo.svg";
import { useUserProfile } from "../hooks/useUserProfile";
import { useSetupProgress } from "../hooks/useSetupProgress";
import { writeAuditData, type ParsedRequirements } from "../hooks/useAuditData";
import { buildParserPayload } from "../../lib/schedulePayload";
import { PARSER_BASE } from "../../lib/api";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface ParserCourse {
  courseID: string;
  departmentCode: string;
  name: string | null;
  grade: string | null;
  credit: number;
}

interface ParserRequirement {
  name: string;
  tag: string;
  courses: ParserCourse[];
  exceptions: null;
  credits: number;
}

interface CreditBlock {
  Status: string;
  "Credits applied": number;
  "Credits required": number;
}

interface MajorSection {
  taken: ParserRequirement[];
  "Still Needed": string[];
}

interface MajorData {
  "Major Credits": CreditBlock;
  [sectionName: string]: CreditBlock | MajorSection;
}

interface CoreBlock {
  Completed: ParserRequirement[];
  "Still Needed": ParserRequirement[];
}

interface ParserResponse {
  Major: string[];
  Concentration: string[];
  Minor: string[];
  "Degree Credits": CreditBlock;
  "CUNY Core": CoreBlock;
  "Hunter Focus": CoreBlock;
  "Writing Requirement": CoreBlock;
  [key: string]: any;
}

export function UploadAudit() {
  const navigate = useNavigate();
  const { email: userEmail } = useUserProfile();
  const { markAuditUploaded } = useSetupProgress();
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "parsing" | "complete">("idle");
  const [progress, setProgress] = useState(0);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [auditConfirmed, setAuditConfirmed] = useState(false);
  const [parsedRequirements, setParsedRequirements] = useState<ParsedRequirements | null>(null);
  const [parserResponse, setParserResponse] = useState<ParserResponse | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [uploadError, setUploadError] = useState<string | null>(null);

  const toggleItem = (key: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const xhrRef = useRef<XMLHttpRequest | null>(null);

  useEffect(() => {
    return () => {
      xhrRef.current?.abort();
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setFile(null);
      setUploadError(`PDF must be ${MAX_FILE_SIZE_MB}MB or smaller.`);
      e.target.value = "";
      return;
    }

    setUploadError(null);
    setFile(selectedFile);
  };

  const mapToRequirements = (data: ParserResponse): ParsedRequirements => {
    const cunyCore = data["CUNY Core"] ?? { Completed: [], "Still Needed": [] };
    const coreCompleted: ParserRequirement[] = cunyCore.Completed ?? [];
    const coreNeeded: ParserRequirement[] = cunyCore["Still Needed"] ?? [];

    const completedCommonCore = coreCompleted
      .filter((r: ParserRequirement) => !r.name?.startsWith("Pluralism"))
      .map((r: ParserRequirement) => `${r.name} — Completed`);
    const neededCommonCore = coreNeeded
      .filter((r: ParserRequirement) => r.tag === "CUNY Common Core")
      .map((r: ParserRequirement) => `${r.name} — Still Needed`);

    const completedPluralism = coreCompleted
      .filter((r: ParserRequirement) => r.name?.startsWith("Pluralism & Diversity"))
      .map((r: ParserRequirement) => `${r.name} — Completed`);
    const neededPluralism = coreNeeded
      .filter((r: ParserRequirement) => r.tag === "Pluralism & Diversity")
      .map((r: ParserRequirement) => `${r.name} — Still Needed`);

    const dc = data["Degree Credits"];
    const majorCreditLines = (data.Major ?? []).flatMap((majorName: string) => {
      const majorData = data[majorName] as MajorData | undefined;
      const credits = majorData?.["Major Credits"] as CreditBlock | undefined;
      if (!credits) return [];
      return [`${majorName}: ${credits["Credits applied"]} / ${credits["Credits required"]} credits — ${credits.Status}`];
    });

    const completedMajor: string[] = [];
    const neededMajor: string[] = [];
    const completedAdditionalMajor: string[] = [];
    const neededAdditionalMajor: string[] = [];
    const completedElectives: string[] = [];

    (data.Major ?? []).forEach((majorName: string) => {
      const majorData = data[majorName] as MajorData | undefined;
      if (!majorData) return;
      Object.entries(majorData)
        .filter(([key]) => key !== "Major Credits")
        .forEach(([sectionKey, val]) => {
          const section = val as MajorSection;
          const isAdditional = sectionKey.startsWith("Additional Requ-");
          (section.taken ?? []).forEach((r: ParserRequirement) => {
            const displayName = r.name === "Elective" ? (r.courses?.[0]?.name ?? "Elective") : r.name;
            if (isAdditional) {
              completedAdditionalMajor.push(`${displayName} — Completed`);
            } else {
              completedMajor.push(`${displayName} — Completed`);
            }
          });
          (section["Still Needed"] ?? []).forEach((name: string) => {
            if (isAdditional) neededAdditionalMajor.push(`${name} — Still Needed`);
            else neededMajor.push(`${name} — Still Needed`);
          });
        });
    });

    return {
      degree: [
        `${dc["Credits applied"]} / ${dc["Credits required"]} total credits — ${dc.Status}`,
        ...majorCreditLines,
      ],
      commonCore: [...completedCommonCore, ...neededCommonCore],
      pluralism: [...completedPluralism, ...neededPluralism],
      hunterFocus: [
        ...(data["Hunter Focus"]?.Completed ?? []).map((r: ParserRequirement) => `${r.name} — Completed`),
        ...(data["Hunter Focus"]?.["Still Needed"] ?? []).map((r: ParserRequirement) => `${r.name} — Still Needed`),
      ],
      writing: [
        ...(data["Writing Requirement"]?.Completed ?? []).map((r: ParserRequirement) => `${r.name} — Completed`),
        ...(data["Writing Requirement"]?.["Still Needed"] ?? []).map((r: ParserRequirement) => `${r.name} — Still Needed`),
      ],
      major: [...completedMajor, ...neededMajor],
      additionalMajor: [...completedAdditionalMajor, ...neededAdditionalMajor],
      electives: [...completedElectives],
    };
  };

  const handleUpload = () => {
    if (!file) return;
    setUploadStatus("uploading");
    setProgress(0);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setProgress(pct);
        if (pct === 100) setUploadStatus("parsing");
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const data: ParserResponse = JSON.parse(xhr.responseText);
          setCheckedItems(new Set());
          setParserResponse(data);
          setParsedRequirements(mapToRequirements(data));
          setUploadStatus("complete");
          setShowReviewModal(true);
        } catch (err) {
          console.error("Failed to process parser response:", err);
          setUploadError("Your audit was uploaded but could not be read. Please try again or use a different PDF.");
          setUploadStatus("idle");
        }
      } else {
        setUploadError("The server could not process your audit. Please check your file and try again.");
        setUploadStatus("idle");
      }
    };

    xhr.onerror = () => {
      setUploadError("Upload failed. Please check your connection and try again.");
      setUploadStatus("idle");
    };
    xhr.open("POST", `${PARSER_BASE}/AuditParse`);
    xhr.send(formData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="cursor-pointer">
              <img src={logoImg} alt="Watchtower Logo" className="h-10 w-auto" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 font-medium">{userEmail}</span>
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors text-sm px-4 py-2">
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="mb-4 hover:bg-white/60 text-gray-600 hover:text-gray-800 transition-all">
          <ArrowLeft className="size-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload DegreeWorks Audit</h2>
          <p className="text-sm text-gray-600">
            Upload your DegreeWorks PDF so we can analyze your degree requirements and prerequisites
          </p>
        </div>

        {uploadStatus === "idle" && (
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Upload Your Audit</CardTitle>
              <CardDescription className="text-sm mt-1">
                Download your DegreeWorks audit from CUNYfirst as a PDF
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-400 transition-colors bg-gray-50/50">
                  <Upload className="size-8 text-gray-400 mx-auto mb-3" />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <span className="text-base text-purple-600 font-semibold hover:text-purple-700">
                      Click to upload
                    </span>
                    <span className="text-base text-gray-600"> or drag and drop</span>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-sm text-gray-500 mt-2">PDF up to {MAX_FILE_SIZE_MB}MB</p>
                </div>

                {file && (
                  <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <FileText className="size-8 text-purple-600" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{file.name}</p>
                        <p className="text-xs text-gray-600">{(file.size / 1024).toFixed(2)} KB</p>
                      </div>
                    </div>
                    <Button onClick={() => setFile(null)} variant="ghost" className="text-sm">
                      Remove
                    </Button>
                  </div>
                )}

                {uploadError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <AlertCircle className="size-4 flex-shrink-0 text-red-500" />
                    {uploadError}
                  </div>
                )}

                <Button onClick={handleUpload} disabled={!file} className="w-full h-10 text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200">
                  <Upload className="size-4 mr-2" />
                  Upload and Analyze
                </Button>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">How to get your DegreeWorks audit:</h4>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside leading-relaxed">
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
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                {uploadStatus === "uploading" ? "Uploading..." : "Analyzing..."}
              </CardTitle>
              <CardDescription className="text-sm mt-1">
                {uploadStatus === "uploading"
                  ? "Uploading your DegreeWorks audit"
                  : "Parsing your degree requirements and prerequisites"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="space-y-3">
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

        {uploadStatus === "complete" && auditConfirmed && (
          <div className="space-y-6">
            <Card className="shadow-lg border-0 border-green-200 bg-green-50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-4">
                  <CheckCircle className="size-8 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-green-900 mb-2">
                      Audit Successfully Analyzed!
                    </h3>
                    <p className="text-sm text-green-800 mb-4">
                      We've extracted your degree requirements and validated your prerequisites.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => navigate("/preferences")}
                      className="text-sm font-semibold bg-green-600 hover:bg-green-700"
                    >
                      Continue to Preferences
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Audit Summary</CardTitle>
                <CardDescription className="text-sm mt-1">Key information extracted from your DegreeWorks</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-base font-semibold mb-3">Degree Progress</h4>
                    <div className="space-y-2">
                      {parserResponse && (() => {
                        const dc = parserResponse["Degree Credits"];
                        return (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Credits Completed</span>
                              <span className="font-semibold">{dc["Credits applied"]} / {dc["Credits required"]}</span>
                            </div>
                            {parserResponse.Major.map((majorName: string) => {
                              const credits = (parserResponse[majorName] as MajorData | undefined)?.["Major Credits"] as CreditBlock | undefined;
                              if (!credits) return null;
                              return (
                                <div key={majorName} className="flex justify-between text-sm">
                                  <span className="text-gray-600">{majorName} Major</span>
                                  <span className="font-semibold">{credits["Credits applied"]} / {credits["Credits required"]}</span>
                                </div>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-base font-semibold mb-3">Still Needed</h4>
                    {(() => {
                      const areaItems = [
                        ...(parserResponse?.["CUNY Core"]?.["Still Needed"] ?? []).map((r: ParserRequirement) => ({ label: r.name })),
                        ...(parserResponse?.["Hunter Focus"]?.["Still Needed"] ?? []).map((r: ParserRequirement) => ({ label: r.name })),
                        ...(parserResponse?.["Writing Requirement"]?.["Still Needed"] ?? []).map((r: ParserRequirement) => ({ label: r.name })),
                      ];
                      const majorItems = (parserResponse?.Major ?? []).flatMap((majorName: string) => {
                        const majorData = parserResponse?.[majorName] as MajorData | undefined;
                        if (!majorData) return [] as string[];
                        return Object.entries(majorData)
                          .filter(([key]) => key !== "Major Credits")
                          .flatMap(([, val]) => (val as MajorSection)["Still Needed"] ?? []) as string[];
                      });
                      return (
                        <div className="space-y-4">
                          {areaItems.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Area Requirements</p>
                              <ul className="space-y-2 text-sm">
                                {areaItems.map(({ label }) => (
                                  <li key={label} className="flex items-start gap-2">
                                    <AlertCircle className="size-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <span>{label}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {majorItems.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Major Requirements</p>
                              <ul className="space-y-2 text-sm">
                                {majorItems.map((name: string) => (
                                  <li key={name} className="flex items-start gap-2">
                                    <AlertCircle className="size-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <span>{name}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Review Parsed Requirements</h2>
                <p className="text-sm text-gray-500 mt-0.5">Confirm the data looks correct before proceeding</p>
              </div>
              <button
                onClick={() => { setShowReviewModal(false); setUploadStatus("idle"); setFile(null); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-6 space-y-6 flex-1">
              {[
                { label: "Degree Requirements", items: parsedRequirements?.degree ?? [], color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
                { label: "Common Core", items: parsedRequirements?.commonCore ?? [], color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
                { label: "Pluralism & Diversity", items: parsedRequirements?.pluralism ?? [], color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
                { label: "Hunter Focus", items: parsedRequirements?.hunterFocus ?? [], color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
                { label: "Writing Requirement", items: parsedRequirements?.writing ?? [], color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
                { label: "Major", items: parsedRequirements?.major ?? [], color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
                { label: "Additional Major Requirements", items: parsedRequirements?.additionalMajor ?? [], color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
                { label: "Electives Accepted", items: parsedRequirements?.electives ?? [], color: "text-sky-600", bg: "bg-sky-50", border: "border-sky-200" },
              ].filter(({ items }) => items.length > 0).map(({ label, items, color, bg, border }) => (
                <div key={label}>
                  <h3 className={`text-xs font-semibold uppercase tracking-wide mb-3 ${color}`}>{label}</h3>
                  <ul className={`rounded-xl border ${border} ${bg} divide-y divide-white/60`}>
                    {items.map((item: string, idx: number) => {
                      const itemKey = `${label}::${idx}`;
                      const originallyDone = item.endsWith("— Completed");
                      const isToggled = checkedItems.has(itemKey);
                      const isDone = originallyDone ? !isToggled : isToggled;
                      const displayText = item.replace(/ — (Completed|Still Needed)$/, "");
                      return (
                        <li
                          key={itemKey}
                          onClick={() => toggleItem(itemKey)}
                          className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-white/50 transition-colors"
                        >
                          {isDone
                            ? <CheckCircle className={`size-4 shrink-0 mt-0.5 ${color}`} />
                            : <Circle className="size-4 shrink-0 mt-0.5 text-gray-300" />
                          }
                          <span className={`text-sm ${isDone ? "text-gray-800" : "text-gray-400"}`}>
                            {displayText}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
              <Button
                variant="outline"
                className="flex-1 h-10 text-sm font-semibold border-gray-300 hover:bg-gray-50"
                onClick={() => { setShowReviewModal(false); setUploadStatus("idle"); setFile(null); }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-10 text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                onClick={() => {
                  if (parserResponse) {
                    const dc = parserResponse["Degree Credits"];
                    writeAuditData({
                      creditsRequired: dc["Credits required"],
                      creditsApplied: dc["Credits applied"],
                      gpa: parserResponse["GPA"] ?? null,
                      parserPayload: buildParserPayload(parserResponse),
                      requirementsSummary: parsedRequirements,
                    });
                  }
                  markAuditUploaded();
                  setShowReviewModal(false);
                  setAuditConfirmed(true);
                }}
              >
                <CheckCircle className="size-4 mr-2" />
                Looks Good
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
