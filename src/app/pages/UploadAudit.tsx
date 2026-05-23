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

interface ParserResponse {
  Major: string[];
  Concentration: string[];
  Minor: string[];
  "Degree Credits": CreditBlock;
  MajorInfo: Record<string, CreditBlock>;
  Completed: ParserRequirement[];
  "Still Needed": ParserRequirement[];
  GPA?: number | null;
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

  const cleanMajorName = (name: string) => name.replace(/^MHC-/, "").trim();
  const cleanDisplayName = (name: string) => name.replace(/\bMHC-/g, "").trim();

  const firstCourseLabel = (req: ParserRequirement) => {
    const course = req.courses?.[0];
    if (!course) return null;
    const code = `${course.departmentCode ?? ""} ${course.courseID ?? ""}`.trim();
    const title = course.name ?? "";
    return [code, title].filter(Boolean).join(" - ");
  };

  const requirementLabel = (req: ParserRequirement) => {
    const name = req.name || "";
    const genericNames = new Set(["Elective", "Elective Courses Allowed", "Pluralism & Diversity"]);
    if (genericNames.has(name)) return firstCourseLabel(req) ?? name;
    return cleanDisplayName(name || req.tag || "Requirement");
  };

  const parseGpa = (value: unknown) => {
    const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const hasTag = (req: ParserRequirement, ...needles: string[]) => {
    const tag = (req.tag ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const name = (req.name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return needles.some((needle) => {
      const normalized = needle.toLowerCase().replace(/[^a-z0-9]/g, "");
      return tag.includes(normalized) || name.includes(normalized);
    });
  };

  const uniqueLines = (lines: string[]) => Array.from(new Set(lines));

  const linesFor = (
    data: ParserResponse,
    predicate: (req: ParserRequirement) => boolean,
    options: { includeCompleted?: boolean; includeNeeded?: boolean } = {}
  ) => {
    const includeCompleted = options.includeCompleted ?? true;
    const includeNeeded = options.includeNeeded ?? true;
    return uniqueLines([
      ...(includeCompleted ? (data.Completed ?? [])
      .filter(predicate)
      .map((req) => `${requirementLabel(req)} — Completed`) : []),
      ...(includeNeeded ? (data["Still Needed"] ?? [])
      .filter(predicate)
      .map((req) => `${requirementLabel(req)} — Still Needed`) : []),
    ]);
  };

  const mapToRequirements = (data: ParserResponse): ParsedRequirements => {
    const dc = data["Degree Credits"];
    const majorCreditLines = Object.entries(data.MajorInfo ?? {}).map(([key, credits]) => {
      const majorName = cleanMajorName(key.replace(/^Major_?Credits_?/, ""));
      return `${majorName}: ${credits["Credits applied"]} / ${credits["Credits required"]} credits — ${credits.Status}`;
    });

    return {
      degree: [
        `${dc["Credits applied"]} / ${dc["Credits required"]} total credits — ${dc.Status}`,
        ...majorCreditLines,
      ],
      commonCore: linesFor(data, (req) => hasTag(req, "CUNYcommon", "CUNY Common Core")),
      pluralism: linesFor(data, (req) => hasTag(req, "PluralismDiversity", "Pluralism & Diversity")),
      hunterFocus: linesFor(data, (req) => hasTag(req, "Hunter Focus")),
      writing: linesFor(data, (req) => hasTag(req, "Writing Requirement")),
      major: uniqueLines([
        ...(data.Completed ?? [])
          .filter((req) => hasTag(req, "major_") && !hasTag(req, "major_elective", "Additional Requ"))
          .map((req) => `${requirementLabel(req)} — Completed`),
        ...(data["Still Needed"] ?? [])
          .filter((req) => hasTag(req, "major_") && !hasTag(req, "Additional Requ"))
          .map((req) => `${requirementLabel(req)} — Still Needed`),
      ]),
      additionalMajor: linesFor(data, (req) => hasTag(req, "Additional Requ")),
      electives: linesFor(data, (req) => hasTag(req, "major_elective", "Elective Courses Allowed"), { includeNeeded: false }),
    };
  };

  const applyChecklistChanges = (
    data: ParserResponse,
    summary: ParsedRequirements,
    checked: Set<string>,
  ) => {
    const nextSummary: ParsedRequirements = {
      degree: [...summary.degree],
      commonCore: [...summary.commonCore],
      pluralism: [...summary.pluralism],
      hunterFocus: [...summary.hunterFocus],
      writing: [...summary.writing],
      major: [...summary.major],
      additionalMajor: [...summary.additionalMajor],
      electives: [...summary.electives],
    };
    const labelsToComplete = new Set<string>();
    const labelsToNeed = new Set<string>();

    const syncSection = (sectionLabel: string, key: keyof ParsedRequirements, summaryOnly = false) => {
      if (summaryOnly) return;
      nextSummary[key] = nextSummary[key].map((item, idx) => {
        const itemKey = `${sectionLabel}::${idx}`;
        const displayText = item.replace(/ — (Completed|Still Needed)$/, "");
        const originallyDone = item.endsWith("— Completed");
        const isToggled = checked.has(itemKey);
        const isDone = originallyDone ? !isToggled : isToggled;

        if (!originallyDone && isDone) labelsToComplete.add(displayText);
        if (originallyDone && !isDone) labelsToNeed.add(displayText);

        return `${displayText} — ${isDone ? "Completed" : "Still Needed"}`;
      });
    };

    syncSection("Degree Requirements", "degree", true);
    syncSection("Common Core", "commonCore");
    syncSection("Pluralism & Diversity", "pluralism");
    syncSection("Hunter Focus", "hunterFocus");
    syncSection("Writing Requirement", "writing");
    syncSection("Major", "major");
    syncSection("Additional Major Requirements", "additionalMajor");
    syncSection("Electives Accepted", "electives");

    const nextResponse: ParserResponse = {
      ...data,
      Completed: [...(data.Completed ?? [])],
      "Still Needed": [...(data["Still Needed"] ?? [])],
    };

    const completedFromNeeded: ParserRequirement[] = [];
    nextResponse["Still Needed"] = nextResponse["Still Needed"].filter((req) => {
      if (!labelsToComplete.has(requirementLabel(req))) return true;
      completedFromNeeded.push(req);
      return false;
    });
    nextResponse.Completed = [
      ...nextResponse.Completed.filter((req) => !labelsToNeed.has(requirementLabel(req))),
      ...completedFromNeeded,
    ];

    return { nextResponse, nextSummary };
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
          if (data.ERROR) {
            setUploadError(`The parser could not read this audit: ${String(data.ERROR)}`);
            setUploadStatus("idle");
            return;
          }
          setCheckedItems(new Set());
          setParserResponse(data);
          setParsedRequirements(mapToRequirements(data));
          setUploadStatus("complete");
          setShowReviewModal(true);
        } catch {
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
                              const credits =
                                parserResponse.MajorInfo?.[`MajorCredits_${majorName}`] ??
                                parserResponse.MajorInfo?.[`Major_Credits_${majorName}`];
                              if (!credits) return null;
                              return (
                                <div key={majorName} className="flex justify-between text-sm">
	                                  <span className="text-gray-600">{cleanMajorName(majorName)} Major</span>
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
                      const stillNeeded = parserResponse?.["Still Needed"] ?? [];
                      const areaItems = stillNeeded
                        .filter((req) => !hasTag(req, "major_"))
                        .map((req) => ({ label: requirementLabel(req) }));
                      const majorItems = stillNeeded
                        .filter((req) => hasTag(req, "major_"))
                        .map((req) => requirementLabel(req));
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
                { label: "Degree Requirements", items: parsedRequirements?.degree ?? [], color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", summaryOnly: true },
                { label: "Common Core", items: parsedRequirements?.commonCore ?? [], color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200", summaryOnly: false },
                { label: "Pluralism & Diversity", items: parsedRequirements?.pluralism ?? [], color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
                { label: "Hunter Focus", items: parsedRequirements?.hunterFocus ?? [], color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
                { label: "Writing Requirement", items: parsedRequirements?.writing ?? [], color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
                { label: "Major", items: parsedRequirements?.major ?? [], color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
                { label: "Additional Major Requirements", items: parsedRequirements?.additionalMajor ?? [], color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
                { label: "Electives Accepted", items: parsedRequirements?.electives ?? [], color: "text-sky-600", bg: "bg-sky-50", border: "border-sky-200" },
              ].filter(({ items }) => items.length > 0).map(({ label, items, color, bg, border, summaryOnly }) => (
                <div key={label}>
                  <h3 className={`text-xs font-semibold uppercase tracking-wide mb-3 ${color}`}>{label}</h3>
                  <ul className={`rounded-xl border ${border} ${bg} divide-y divide-white/60`}>
                    {items.map((item: string, idx: number) => {
                      const itemKey = `${label}::${idx}`;
                      const displayText = item.replace(/ — (Completed|Still Needed)$/, "");
                      if (summaryOnly) {
                        return (
                          <li key={itemKey} className="flex items-start gap-3 px-4 py-3">
                            <span className={`size-2 rounded-full shrink-0 mt-2 ${color.replace("text-", "bg-")}`} />
                            <span className="text-sm font-medium text-gray-800">{displayText}</span>
                          </li>
                        );
                      }
                      const originallyDone = item.endsWith("— Completed");
                      const isToggled = checkedItems.has(itemKey);
                      const isDone = originallyDone ? !isToggled : isToggled;
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
                  if (parserResponse && parsedRequirements) {
                    const { nextResponse, nextSummary } = applyChecklistChanges(
                      parserResponse,
                      parsedRequirements,
                      checkedItems,
                    );
                    const dc = nextResponse["Degree Credits"];
                    writeAuditData({
                      creditsRequired: dc["Credits required"],
                      creditsApplied: dc["Credits applied"],
                      gpa: parseGpa(nextResponse["GPA"]),
                      fileName: file?.name ?? null,
                      parserPayload: buildParserPayload(nextResponse),
                      requirementsSummary: nextSummary,
                    });
                    setParserResponse(nextResponse);
                    setParsedRequirements(nextSummary);
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
