import { useState } from "react";
import { useNavigate } from "react-router";
import { useUserProfile } from "../hooks/useUserProfile";
import { useSetupProgress } from "../hooks/useSetupProgress";
import {
	readAuditData,
	clearAuditData,
	type AuditData,
} from "../hooks/useAuditData";
import {
	clearPersistedPreferences,
	readPersistedPreferences,
} from "../hooks/usePersistedPreferences";
import { Button } from "../components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import {
	Upload,
	Settings,
	AlertCircle,
	CheckCircle,
	Trash2,
	FileText,
} from "lucide-react";
import { HunterHeader } from "../components/HunterHeader";

function formatSemesterLabel(semester: string | undefined): string | null {
	if (!semester) return null;
	if (semester.includes(" ")) return semester;
	const [term, year] = semester.split("-");
	if (!term || !year) return null;
	return `${term.charAt(0).toUpperCase()}${term.slice(1)} ${year}`;
}

function getRemainingClassCount(auditData: AuditData | null): number | null {
	if (!auditData?.parserPayload) return null;
	return auditData.parserPayload.requirements_needed.reduce((total, req) => {
		const creditsNeeded = Number(req.credits_needed ?? 0);
		if (creditsNeeded > 0) {
			return total + Math.max(1, Math.ceil(creditsNeeded / 3));
		}
		return (
			total + (req.name || req.attribute || req.fulfilled_by.length > 0 ? 1 : 0)
		);
	}, 0);
}

function normalizePlanningSemester(
	selectedSemester: string,
): { term: "Spring" | "Fall"; year: number } | null {
	const [term, yearStr] = selectedSemester.split(" ");
	const year = parseInt(yearStr, 10);
	if (!Number.isFinite(year)) return null;
	if (term === "Spring") return { term, year };
	if (term === "Fall") return { term, year };
	if (term === "Summer") return { term: "Fall", year };
	if (term === "Winter") return { term: "Spring", year };
	return null;
}

function addFallSpringSemesters(
	start: { term: "Spring" | "Fall"; year: number },
	offset: number,
): string {
	const startIndex = start.term === "Spring" ? 0 : 1;
	const absoluteIndex = startIndex + offset;
	const term = absoluteIndex % 2 === 0 ? "Spring" : "Fall";
	const year = start.year + Math.floor(absoluteIndex / 2);
	return `${term} ${year}`;
}

export function Dashboard() {
	const navigate = useNavigate();
	const { name: userName, isLoading } = useUserProfile();
	const { progress, resetAuditUploaded, resetPreferences } = useSetupProgress();
	const [auditData, setAuditData] = useState<AuditData | null>(() =>
		readAuditData(),
	);
	const gpa =
		typeof auditData?.gpa === "number"
			? auditData.gpa
			: Number.parseFloat(String(auditData?.gpa ?? ""));

	const creditsRemaining = (() => {
		if (!auditData) return null;
		const { creditsRequired, creditsApplied } = auditData;
		if (!creditsRequired || creditsRequired <= 0) return null;
		return Math.max(0, creditsRequired - (creditsApplied ?? 0));
	})();

	const selectedSemester = progress.preferencesSet
		? (formatSemesterLabel(progress.semester) ??
			formatSemesterLabel(readPersistedPreferences().semester))
		: null;
	const remainingClassCount = getRemainingClassCount(auditData);
	const expectedGraduation = (() => {
		if (remainingClassCount === null || !selectedSemester) return null;
		if (remainingClassCount === 0) return "Requirements complete";
		const start = normalizePlanningSemester(selectedSemester);
		if (!start) return null;
		const semestersNeeded = Math.ceil(remainingClassCount / 4);
		return addFallSpringSemesters(start, semestersNeeded - 1);
	})();

	const completedCount = [
		progress.preferencesSet,
		progress.auditUploaded,
	].filter(Boolean).length;
	const allComplete = progress.preferencesSet && progress.auditUploaded;

	return (
		<div className="min-h-screen bg-gray-50">
			<HunterHeader showNav showSignOut />

			<main className="max-w-screen-xl mx-auto px-4 lg:px-6 py-6">
				{/* Page heading */}
				<div className="mb-6">
					<h2 className="text-2xl font-black text-gray-900 mb-1 uppercase tracking-tight">
						Welcome back, {isLoading ? "…" : userName || "Student"}
					</h2>
					<p className="text-sm text-gray-500">
						Let's build your perfect schedule
						{progress.semester ? ` for ${progress.semester}` : ""}
					</p>
				</div>

				{/* ── Setup Progress ─────────────────────────────────────── */}
				<Card className="mb-6 shadow-sm border border-gray-200 bg-white">
					<CardHeader className="pb-4 border-b border-gray-100">
						<CardTitle className="text-base font-black uppercase tracking-tight text-gray-900">
							Setup Progress
						</CardTitle>
						<CardDescription className="text-xs mt-0.5">
							Complete these steps to generate your schedule
						</CardDescription>
					</CardHeader>
					<CardContent className="pt-4">
						<div className="space-y-4">
							{/* Progress bar */}
							<div>
								<div className="flex items-center justify-between mb-2">
									<span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
										Overall Progress
									</span>
									<span className="text-xs text-gray-400">
										{completedCount} of 2 steps
									</span>
								</div>
								<Progress
									value={completedCount * 50}
									className="h-1.5 bg-[#e8dff5]"
									indicatorClassName="bg-[#582C83]"
								/>
							</div>

							{/* Step cards */}
							<div className="grid md:grid-cols-2 gap-4 mt-4">
								{/* Audit upload step */}
								<div
									className={`flex items-start gap-3 p-4 border rounded hover:shadow-md transition-shadow ${
										progress.auditUploaded
											? "border-green-200 bg-green-50/40"
											: "border-gray-200 bg-white"
									}`}
								>
									{progress.auditUploaded ? (
										<CheckCircle className="size-5 text-green-500 mt-0.5 flex-shrink-0" />
									) : (
										<AlertCircle className="size-5 text-amber-500 mt-0.5 flex-shrink-0" />
									)}
									<div className="flex-1">
										<div className="flex items-start justify-between gap-3 mb-1">
											<h4 className="font-black text-sm uppercase tracking-tight text-gray-900">
												Upload DegreeWorks Audit
											</h4>
											{auditData && (
												<Button
													size="sm"
													variant="ghost"
													className="h-7 px-2 text-xs text-green-700 hover:text-green-800 hover:bg-green-50"
													onClick={() => navigate("/requirements")}
												>
													<FileText className="size-3.5 mr-1" />
													View Audit
												</Button>
											)}
										</div>
										<p className="text-sm text-gray-500 mb-3">
											Upload your PDF to analyze degree requirements
										</p>
										<div className="flex gap-2 flex-wrap">
											<Button
												size="sm"
												onClick={() => navigate("/upload")}
												className={`text-sm font-semibold ${
													progress.auditUploaded
														? "bg-green-600 hover:bg-green-700"
														: "bg-[#582C83] hover:bg-[#4a2270]"
												} text-white`}
											>
												<Upload className="size-4 mr-1.5" />
												{progress.auditUploaded
													? "Re-upload Audit"
													: "Upload Audit"}
											</Button>
											{progress.auditUploaded && (
												<div className="relative inline-flex group">
													<span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-max max-w-64 -translate-x-1/2 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block">
														{auditData?.fileName
															? `Clear ${auditData.fileName}`
															: "Clear saved audit"}
													</span>
													<span className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 hidden size-2 -translate-x-1/2 rotate-45 bg-gray-900 group-hover:block" />
													<div>
														<Button
															size="sm"
															variant="ghost"
															className="text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100"
															onClick={() => {
																clearAuditData();
																setAuditData(null);
																resetAuditUploaded();
															}}
														>
															<Trash2 className="size-4 mr-1.5" />
															Clear Audit
														</Button>
													</div>
												</div>
											)}
										</div>
									</div>
								</div>

								{/* Preferences step */}
								<div
									className={`flex items-start gap-3 p-4 border rounded hover:shadow-md transition-shadow ${
										progress.preferencesSet
											? "border-green-200 bg-green-50/40"
											: "border-gray-200 bg-white"
									}`}
								>
									{progress.preferencesSet ? (
										<CheckCircle className="size-5 text-green-500 mt-0.5 flex-shrink-0" />
									) : (
										<AlertCircle className="size-5 text-amber-500 mt-0.5 flex-shrink-0" />
									)}
									<div className="flex-1">
										<h4 className="font-black mb-1 text-sm uppercase tracking-tight text-gray-900">
											Set Preferences
										</h4>
										<p className="text-sm text-gray-500 mb-3">
											Configure your availability and schedule preferences
										</p>
										<div className="flex gap-2 flex-wrap">
											<Button
												size="sm"
												onClick={() => navigate("/preferences")}
												className={`text-sm font-semibold ${
													progress.preferencesSet
														? "bg-green-600 hover:bg-green-700"
														: "bg-[#582C83] hover:bg-[#4a2270]"
												} text-white`}
											>
												<Settings className="size-4 mr-1.5" />
												{progress.preferencesSet
													? "Edit Preferences"
													: "Set Preferences"}
											</Button>
											{progress.preferencesSet && (
												<Button
													size="sm"
													variant="ghost"
													className="text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100"
													onClick={() => {
														clearPersistedPreferences();
														resetPreferences();
													}}
												>
													<Trash2 className="size-4 mr-1.5" />
													Reset Preferences
												</Button>
											)}
										</div>
									</div>
								</div>
							</div>

							{/* All complete banner */}
							{allComplete && (
								<div className="mt-4 flex items-center gap-4 p-4 rounded bg-[#582C83] border border-[#4a2270]">
									<div className="flex-1">
										<p className="text-sm font-black text-white uppercase tracking-tight">
											You're all set!
										</p>
										<p className="text-xs text-white/70 mt-0.5">
											Both steps are complete — view your generated schedules.
										</p>
									</div>
									<Button
										size="sm"
										onClick={() => navigate("/schedules")}
										className="shrink-0 bg-white text-[#582C83] hover:bg-white/90 font-black text-sm uppercase tracking-wide"
									>
										View Schedules
									</Button>
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				{/* ── Stats ──────────────────────────────────────────────── */}
				<div className="grid md:grid-cols-3 gap-4 mb-6">
					<Card className="shadow-sm border border-gray-200 bg-white">
						<CardHeader className="pb-2">
							<CardDescription className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
								Credits Remaining
							</CardDescription>
							<CardTitle className="text-3xl font-black text-[#582C83]">
								{creditsRemaining !== null ? creditsRemaining : "—"}
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-gray-500">
								{creditsRemaining !== null
									? `≈ ${Math.ceil(creditsRemaining / 3)} courses to graduation`
									: "Upload your audit to see progress"}
							</p>
						</CardContent>
					</Card>

					<Card className="shadow-sm border border-gray-200 bg-white">
						<CardHeader className="pb-2">
							<CardDescription className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
								Current GPA
							</CardDescription>
							<CardTitle className="text-3xl font-black text-green-600">
								{Number.isFinite(gpa) ? gpa.toFixed(2) : "—"}
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-gray-500">
								{Number.isFinite(gpa)
									? "Institutional GPA"
									: "Upload your audit to see GPA"}
							</p>
						</CardContent>
					</Card>

					<Card className="shadow-sm border border-gray-200 bg-white">
						<CardHeader className="pb-2">
							<CardDescription className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
								Expected Graduation
							</CardDescription>
							<CardTitle className="text-3xl font-black text-[#582C83]">
								{expectedGraduation ?? "—"}
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-gray-500">
								{expectedGraduation
									? "Estimated from remaining classes"
									: "Set semester preference to estimate"}
							</p>
						</CardContent>
					</Card>
				</div>

				{/* ── Getting Started ────────────────────────────────────── */}
				<Card className="shadow-sm border border-gray-200 bg-white">
					<CardHeader className="pb-4 border-b border-gray-100">
						<CardTitle className="text-base font-black uppercase tracking-tight text-gray-900">
							Getting Started
						</CardTitle>
						<CardDescription className="text-xs mt-0.5">
							Tips to make the most of the Schedule Builder
						</CardDescription>
					</CardHeader>
					<CardContent className="pt-4">
						<ul className="space-y-4">
							{(
								[
									{
										n: "1",
										title: "Download your DegreeWorks audit",
										body: "Log into CUNYfirst and download your audit as a PDF",
									},
									{
										n: "2",
										title: "Upload and let us analyze",
										body: "Our system will parse your requirements and prerequisites",
									},
									{
										n: "3",
										title: "Set your availability and preferences",
										body: "Tell us when you're free and what matters to you",
									},
									{
										n: "4",
										title: "Review generated schedules",
										body: "Get multiple conflict-free options optimized for your goals",
									},
								] as const
							).map(({ n, title, body }) => (
								<li key={n} className="flex items-start gap-3">
									<div className="size-6 rounded-full bg-[#582C83] flex items-center justify-center flex-shrink-0 mt-0.5">
										<span className="text-[10px] font-black text-white">
											{n}
										</span>
									</div>
									<div>
										<p className="font-bold text-sm mb-0.5 text-gray-900">
											{title}
										</p>
										<p className="text-sm text-gray-500">{body}</p>
									</div>
								</li>
							))}
						</ul>
					</CardContent>
				</Card>
			</main>
		</div>
	);
}
