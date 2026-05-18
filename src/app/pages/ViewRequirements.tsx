import { useMemo } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, AlertCircle, CheckCircle, Circle, FileText, Upload } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { useUserProfile } from "../hooks/useUserProfile";
import { readAuditData, type ParsedRequirements } from "../hooks/useAuditData";
import logoImg from "../../assets/watchtower-logo.svg";

const REQUIREMENT_GROUPS: Array<{
  key: keyof ParsedRequirements;
  label: string;
  color: string;
  bg: string;
  border: string;
}> = [
  { key: "degree", label: "Degree Requirements", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  { key: "commonCore", label: "Common Core", color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
  { key: "pluralism", label: "Pluralism & Diversity", color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
  { key: "hunterFocus", label: "Hunter Focus", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  { key: "writing", label: "Writing Requirement", color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
  { key: "major", label: "Major", color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
  { key: "additionalMajor", label: "Additional Major Requirements", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
  { key: "electives", label: "Electives Accepted", color: "text-sky-600", bg: "bg-sky-50", border: "border-sky-200" },
];

function parseRequirementStatus(item: string): { label: string; completed: boolean } {
  return {
    label: item.replace(/ — (Completed|Still Needed)$/, ""),
    completed: item.endsWith("— Completed"),
  };
}

function formatCourseId(course: { subject_area: string; catalog_number: number }): string {
  return `${course.subject_area} ${course.catalog_number}`;
}

function buildFallbackSummary(auditData: ReturnType<typeof readAuditData>): ParsedRequirements | null {
  const parserPayload = auditData?.parserPayload;
  if (!parserPayload) return null;

  const summary: ParsedRequirements = {
    degree: [
      `${auditData.creditsApplied} / ${auditData.creditsRequired} total credits — Saved Audit`,
      ...parserPayload.classes_taken.map((course) => `${formatCourseId(course)} — Completed`),
    ],
    commonCore: [],
    pluralism: [],
    hunterFocus: [],
    writing: [],
    major: [],
    additionalMajor: [],
    electives: [],
  };

  for (const req of parserPayload.requirements_needed) {
    const line = `${req.name || req.attribute || "Requirement"} — Still Needed`;
    const attr = `${req.attribute} ${req.name}`.toLowerCase();
    if (attr.includes("pluralism")) {
      summary.pluralism.push(line);
    } else if (attr.includes("cuny core") || attr.includes("common core")) {
      summary.commonCore.push(line);
    } else if (attr.includes("hunter focus")) {
      summary.hunterFocus.push(line);
    } else if (attr.includes("writing")) {
      summary.writing.push(line);
    } else if (attr.includes("additional")) {
      summary.additionalMajor.push(line);
    } else {
      summary.major.push(line);
    }
  }

  return summary;
}

function flattenStillNeeded(summary: ParsedRequirements): string[] {
  return REQUIREMENT_GROUPS.flatMap(({ key }) =>
    (summary[key] ?? [])
      .filter((item) => item.endsWith("— Still Needed"))
      .map((item) => parseRequirementStatus(item).label),
  );
}

export function ViewRequirements() {
  const navigate = useNavigate();
  const { email: userEmail } = useUserProfile();
  const auditData = useMemo(() => readAuditData(), []);
  const summary = auditData?.requirementsSummary ?? buildFallbackSummary(auditData);
  const stillNeeded = summary ? flattenStillNeeded(summary) : [];
  const completedCount = summary
    ? REQUIREMENT_GROUPS.reduce(
      (count, { key }) => count + (summary[key] ?? []).filter((item) => item.endsWith("— Completed")).length,
      0,
    )
    : 0;
  const stillNeededCount = stillNeeded.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-3 flex items-center justify-between">
          <button onClick={() => navigate("/dashboard")} className="cursor-pointer">
            <img src={logoImg} alt="Watchtower Logo" className="h-10 w-auto" />
          </button>
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Requirements Summary</h2>
          <p className="text-sm text-gray-600">
            Completed and still-needed requirements from your confirmed DegreeWorks audit
          </p>
        </div>

        {!auditData || !summary ? (
          <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <AlertCircle className="size-10 text-amber-500" />
              <p className="text-sm text-gray-700 font-medium text-center max-w-md">
                No saved audit data was found. Upload and confirm your audit to view your requirements here.
              </p>
              <Button size="sm" onClick={() => navigate("/upload")} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                Upload Audit
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-[360px_1fr] gap-5 items-start">
            <div className="space-y-4">
              <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="size-5 text-indigo-600" />
                    Audit Summary
                  </CardTitle>
                  <CardDescription className="text-sm mt-1">Saved from your confirmed DegreeWorks audit</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                      <p className="text-xs font-medium text-gray-600">Credits</p>
                      <p className="text-xl font-bold text-blue-700">
                        {auditData.creditsApplied} / {auditData.creditsRequired}
                      </p>
                    </div>
                    <div className="rounded-xl bg-green-50 border border-green-100 p-3">
                      <p className="text-xs font-medium text-gray-600">GPA</p>
                      <p className="text-xl font-bold text-green-700">
                        {auditData.gpa ? auditData.gpa.toFixed(2) : "—"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
                      <p className="text-xs font-medium text-gray-600">Completed</p>
                      <p className="text-xl font-bold text-indigo-700">{completedCount}</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                      <p className="text-xs font-medium text-gray-600">Still Needed</p>
                      <p className="text-xl font-bold text-amber-700">{stillNeededCount}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Still Needed</h3>
                    {stillNeeded.length > 0 ? (
                      <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {stillNeeded.map((item, idx) => (
                          <li key={`${item}-${idx}`} className="flex items-start gap-2 text-sm text-gray-700">
                            <AlertCircle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">No still-needed requirements were saved.</p>
                    )}
                  </div>

                  <Button size="sm" variant="outline" onClick={() => navigate("/upload")} className="w-full border-gray-300 hover:bg-gray-50">
                    <Upload className="size-4 mr-1.5" />
                    Replace Audit
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Parsed Requirements</CardTitle>
                <CardDescription className="text-sm mt-1">The same completed and still-needed items from your audit review</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-6">
                {REQUIREMENT_GROUPS
                  .map((group) => ({ ...group, items: summary[group.key] ?? [] }))
                  .filter(({ items }) => items.length > 0)
                  .map(({ label, items, color, bg, border }) => (
                    <section key={label}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className={`text-xs font-semibold uppercase tracking-wide ${color}`}>{label}</h3>
                        <span className="text-xs text-gray-400">
                          {items.length} {items.length === 1 ? "item" : "items"}
                        </span>
                      </div>
                      <ul className={`rounded-xl border ${border} ${bg} divide-y divide-white/60`}>
                        {items.map((item, idx) => {
                          const { label: itemLabel, completed } = parseRequirementStatus(item);
                          return (
                            <li key={`${label}-${idx}`} className="flex items-start gap-3 px-4 py-3">
                              {completed
                                ? <CheckCircle className={`size-4 shrink-0 mt-0.5 ${color}`} />
                                : <Circle className="size-4 shrink-0 mt-0.5 text-gray-300" />
                              }
                              <span className={`text-sm ${completed ? "text-gray-800" : "text-gray-500"}`}>
                                {itemLabel}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
