import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../components/ui/dialog";
import {
	Upload,
	FileText,
	CheckCircle,
	Circle,
	AlertCircle,
	ArrowLeft,
} from "lucide-react";
import { PlannerHeader } from "../components/PlannerHeader";
import { useSetupProgress } from "../hooks/useSetupProgress";
import { writeAuditData, type ParsedRequirements } from "../hooks/useAuditData";
import { buildConfirmedAuditData } from "../../lib/auditReview";
import { PARSER_BASE } from "../../lib/api";
import styles from "./SmartBuilder.module.css";

const MAX_FILE_SIZE_MB = 5;
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
	const { markAuditUploaded } = useSetupProgress();
	const [file, setFile] = useState<File | null>(null);
	const [uploadStatus, setUploadStatus] = useState<
		"idle" | "uploading" | "parsing" | "complete"
	>("idle");
	const [progress, setProgress] = useState(0);
	const [showReviewModal, setShowReviewModal] = useState(false);
	const [auditConfirmed, setAuditConfirmed] = useState(false);
	const [parsedRequirements, setParsedRequirements] =
		useState<ParsedRequirements | null>(null);
	const [parserResponse, setParserResponse] = useState<ParserResponse | null>(
		null,
	);
	const [uploadError, setUploadError] = useState<string | null>(null);

	const xhrRef = useRef<XMLHttpRequest | null>(null);
	const pageHeadingRef = useRef<HTMLHeadingElement | null>(null);
	const closeReviewModal = () => {
		setShowReviewModal(false);
		setUploadStatus("idle");
		setFile(null);
	};

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
		const code =
			`${course.departmentCode ?? ""} ${course.courseID ?? ""}`.trim();
		const title = course.name ?? "";
		return [code, title].filter(Boolean).join(" - ");
	};

	const requirementLabel = (req: ParserRequirement) => {
		const name = req.name || "";
		const genericNames = new Set([
			"Elective",
			"Elective Courses Allowed",
			"Pluralism & Diversity",
		]);
		if (genericNames.has(name)) return firstCourseLabel(req) ?? name;
		return cleanDisplayName(name || req.tag || "Requirement");
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
		options: { includeCompleted?: boolean; includeNeeded?: boolean } = {},
	) => {
		const includeCompleted = options.includeCompleted ?? true;
		const includeNeeded = options.includeNeeded ?? true;
		return uniqueLines([
			...(includeCompleted
				? (data.Completed ?? [])
						.filter(predicate)
						.map((req) => `${requirementLabel(req)} — Completed`)
				: []),
			...(includeNeeded
				? (data["Still Needed"] ?? [])
						.filter(predicate)
						.map((req) => `${requirementLabel(req)} — Still Needed`)
				: []),
		]);
	};

	const mapToRequirements = (data: ParserResponse): ParsedRequirements => {
		const dc = data["Degree Credits"];
		const majorCreditLines = Object.entries(data.MajorInfo ?? {}).map(
			([key, credits]) => {
				const majorName = cleanMajorName(key.replace(/^Major_?Credits_?/, ""));
				return `${majorName}: ${credits["Credits applied"]} / ${credits["Credits required"]} credits — ${credits.Status}`;
			},
		);

		return {
			degree: [
				`${dc["Credits applied"]} / ${dc["Credits required"]} total credits — ${dc.Status}`,
				...majorCreditLines,
			],
			commonCore: linesFor(data, (req) =>
				hasTag(req, "CUNYcommon", "CUNY Common Core"),
			),
			pluralism: linesFor(data, (req) =>
				hasTag(req, "PluralismDiversity", "Pluralism & Diversity"),
			),
			hunterFocus: linesFor(data, (req) => hasTag(req, "Hunter Focus")),
			writing: linesFor(data, (req) => hasTag(req, "Writing Requirement")),
			major: uniqueLines([
				...(data.Completed ?? [])
					.filter(
						(req) =>
							hasTag(req, "major_") &&
							!hasTag(req, "major_elective", "Additional Requ"),
					)
					.map((req) => `${requirementLabel(req)} — Completed`),
				...(data["Still Needed"] ?? [])
					.filter(
						(req) => hasTag(req, "major_") && !hasTag(req, "Additional Requ"),
					)
					.map((req) => `${requirementLabel(req)} — Still Needed`),
			]),
			additionalMajor: linesFor(data, (req) => hasTag(req, "Additional Requ")),
			electives: linesFor(
				data,
				(req) => hasTag(req, "major_elective", "Elective Courses Allowed"),
				{ includeNeeded: false },
			),
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
					if (data.ERROR) {
						setUploadError(
							`The parser could not read this audit: ${String(data.ERROR)}`,
						);
						setUploadStatus("idle");
						return;
					}
					setParserResponse(data);
					setParsedRequirements(mapToRequirements(data));
					setUploadStatus("complete");
					setShowReviewModal(true);
				} catch {
					setUploadError(
						"Your audit was uploaded but could not be read. Please try again or use a different PDF.",
					);
					setUploadStatus("idle");
				}
			} else {
				setUploadError(
					"The server could not process your audit. Please check your file and try again.",
				);
				setUploadStatus("idle");
			}
		};

		xhr.onerror = () => {
			setUploadError(
				"Upload failed. Please check your connection and try again.",
			);
			setUploadStatus("idle");
		};
		xhr.open("POST", `${PARSER_BASE}/AuditParse`);
		xhr.send(formData);
	};

	return (
		<div className={styles.page}>
			<PlannerHeader />

			<main className="max-w-screen-xl mx-auto px-4 lg:px-6 py-6">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => navigate("/planner")}
					className="mb-4 text-gray-600 hover:text-gray-800 hover:bg-white transition-all"
				>
					<ArrowLeft className="size-4 mr-2" />
					Back to Course Search
				</Button>

				<div className="mb-6">
					<h2
						ref={pageHeadingRef}
						tabIndex={-1}
						className="text-2xl font-bold text-gray-900 mb-2"
					>
						Upload DegreeWorks Audit
					</h2>
					<p className="text-sm text-gray-600">
						Upload your DegreeWorks PDF so we can analyze your degree
						requirements and prerequisites
					</p>
				</div>

				{uploadStatus === "idle" && (
					<Card className="shadow-sm border border-gray-200 bg-white">
						<CardHeader className="pb-3">
							<CardTitle className="text-lg">Upload Your Audit</CardTitle>
							<CardDescription className="text-sm mt-1">
								Download your DegreeWorks audit from CUNYfirst as a PDF
							</CardDescription>
						</CardHeader>
						<CardContent className="pt-2">
							<div className="space-y-4">
								<div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-[#582C83] transition-colors bg-gray-50/50">
									<Upload className="size-8 text-gray-400 mx-auto mb-3" />
									<label htmlFor="file-upload" className="cursor-pointer">
										<span className="text-base text-[#582C83] font-semibold hover:text-[#4a2270]">
											Click to upload
										</span>
										<span className="text-base text-gray-600">
											{" "}
											or drag and drop
										</span>
										<input
											id="file-upload"
											type="file"
											accept=".pdf"
											onChange={handleFileChange}
											className="hidden"
										/>
									</label>
									<p className="text-sm text-gray-500 mt-2">
										PDF up to {MAX_FILE_SIZE_MB}MB
									</p>
								</div>

								{file && (
									<div className="flex items-center justify-between p-4 bg-[#f5f0fb] border border-[#c9b3e8] rounded-xl">
										<div className="flex items-center gap-3">
											<FileText className="size-8 text-[#582C83]" />
											<div>
												<p className="text-sm font-semibold text-gray-900">
													{file.name}
												</p>
												<p className="text-xs text-gray-600">
													{(file.size / 1024).toFixed(2)} KB
												</p>
											</div>
										</div>
										<Button
											onClick={() => setFile(null)}
											variant="ghost"
											className="text-sm"
										>
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

								<Button
									onClick={handleUpload}
									disabled={!file}
									className="w-full h-10 text-sm font-semibold bg-[#582C83] hover:bg-[#4a2270] text-white transition-colors"
								>
									<Upload className="size-4 mr-2" />
									Upload and Analyze
								</Button>

								<div className="bg-[#f5f0fb] border border-[#c9b3e8] rounded-xl p-4">
									<h4 className="text-sm font-semibold text-[#582C83] mb-2">
										How to get your DegreeWorks audit:
									</h4>
									<ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside leading-relaxed">
										<li>Log into CUNYfirst</li>
										<li>
											Navigate to Self Service → Academic Progress → View my
											Degree Audit
										</li>
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
					<Card className="shadow-sm border border-gray-200 bg-white">
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
						<Card className="shadow-sm border border-green-200 bg-green-50">
							<CardContent className="pt-4">
								<div className="flex items-start gap-4">
									<CheckCircle className="size-8 text-green-600 flex-shrink-0" />
									<div className="flex-1">
										<h3 className="text-lg font-bold text-green-900 mb-2">
											Audit Successfully Analyzed!
										</h3>
										<p className="text-sm text-green-800 mb-4">
											We've extracted your degree requirements and validated
											your prerequisites.
										</p>
										<Button
											size="sm"
											onClick={() => navigate("/requirements")}
											className="text-sm font-semibold bg-green-600 hover:bg-green-700"
										>
											Review Requirements
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card className="shadow-sm border border-gray-200 bg-white">
							<CardHeader className="pb-3">
								<CardTitle className="text-lg">Audit Summary</CardTitle>
								<CardDescription className="text-sm mt-1">
									Key information extracted from your DegreeWorks
								</CardDescription>
							</CardHeader>
							<CardContent className="pt-2">
								<div className="grid md:grid-cols-2 gap-6">
									<div>
										<h4 className="text-base font-semibold mb-3">
											Degree Progress
										</h4>
										<div className="space-y-2">
											{parserResponse &&
												(() => {
													const dc = parserResponse["Degree Credits"];
													return (
														<>
															<div className="flex justify-between text-sm">
																<span className="text-gray-600">
																	Credits Completed
																</span>
																<span className="font-semibold">
																	{dc["Credits applied"]} /{" "}
																	{dc["Credits required"]}
																</span>
															</div>
															{parserResponse.Major.map((majorName: string) => {
																const credits =
																	parserResponse.MajorInfo?.[
																		`MajorCredits_${majorName}`
																	] ??
																	parserResponse.MajorInfo?.[
																		`Major_Credits_${majorName}`
																	];
																if (!credits) return null;
																return (
																	<div
																		key={majorName}
																		className="flex justify-between text-sm"
																	>
																		<span className="text-gray-600">
																			{cleanMajorName(majorName)} Major
																		</span>
																		<span className="font-semibold">
																			{credits["Credits applied"]} /{" "}
																			{credits["Credits required"]}
																		</span>
																	</div>
																);
															})}
														</>
													);
												})()}
										</div>
									</div>

									<div>
										<h4 className="text-base font-semibold mb-3">
											Still Needed
										</h4>
										{(() => {
											const stillNeeded =
												parserResponse?.["Still Needed"] ?? [];
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
															<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
																Area Requirements
															</p>
															<ul className="space-y-2 text-sm">
																{areaItems.map(({ label }) => (
																	<li
																		key={label}
																		className="flex items-start gap-2"
																	>
																		<AlertCircle className="size-4 text-blue-600 flex-shrink-0 mt-0.5" />
																		<span>{label}</span>
																	</li>
																))}
															</ul>
														</div>
													)}
													{majorItems.length > 0 && (
														<div>
															<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
																Major Requirements
															</p>
															<ul className="space-y-2 text-sm">
																{majorItems.map((name: string) => (
																	<li
																		key={name}
																		className="flex items-start gap-2"
																	>
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

			<Dialog
				open={showReviewModal}
				onOpenChange={(open) => {
					if (!open) closeReviewModal();
				}}
			>
				<DialogContent
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						pageHeadingRef.current?.focus();
					}}
					className="flex max-h-[85vh] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl bg-white p-0 shadow-2xl"
				>
					<DialogHeader className="border-b border-gray-200 px-6 py-4 pr-12 text-left">
						<DialogTitle className="text-lg font-bold text-gray-900">
							Review Parsed Requirements
						</DialogTitle>
						<DialogDescription className="text-sm text-gray-500">
							Review the statuses parsed from your DegreeWorks audit
						</DialogDescription>
					</DialogHeader>

					<div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
							<div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
								Completion statuses are read-only. If something is incorrect,
								upload a current DegreeWorks audit rather than marking a
								requirement complete manually.
							</div>
							{[
								{
									label: "Degree Requirements",
									items: parsedRequirements?.degree ?? [],
									color: "text-blue-600",
									bg: "bg-blue-50",
									border: "border-blue-200",
									summaryOnly: true,
								},
								{
									label: "Common Core",
									items: parsedRequirements?.commonCore ?? [],
									color: "text-violet-600",
									bg: "bg-violet-50",
									border: "border-violet-200",
									summaryOnly: false,
								},
								{
									label: "Pluralism & Diversity",
									items: parsedRequirements?.pluralism ?? [],
									color: "text-purple-600",
									bg: "bg-purple-50",
									border: "border-purple-200",
								},
								{
									label: "Hunter Focus",
									items: parsedRequirements?.hunterFocus ?? [],
									color: "text-amber-600",
									bg: "bg-amber-50",
									border: "border-amber-200",
								},
								{
									label: "Writing Requirement",
									items: parsedRequirements?.writing ?? [],
									color: "text-green-600",
									bg: "bg-green-50",
									border: "border-green-200",
								},
								{
									label: "Major",
									items: parsedRequirements?.major ?? [],
									color: "text-indigo-600",
									bg: "bg-indigo-50",
									border: "border-indigo-200",
								},
								{
									label: "Additional Major Requirements",
									items: parsedRequirements?.additionalMajor ?? [],
									color: "text-orange-600",
									bg: "bg-orange-50",
									border: "border-orange-200",
								},
								{
									label: "Electives Accepted",
									items: parsedRequirements?.electives ?? [],
									color: "text-sky-600",
									bg: "bg-sky-50",
									border: "border-sky-200",
								},
							]
								.filter(({ items }) => items.length > 0)
								.map(({ label, items, color, bg, border, summaryOnly }) => (
									<div key={label}>
										<h3
											className={`text-xs font-semibold uppercase tracking-wide mb-3 ${color}`}
										>
											{label}
										</h3>
										<ul
											className={`rounded-xl border ${border} ${bg} divide-y divide-white/60`}
										>
											{items.map((item: string, idx: number) => {
												const itemKey = `${label}::${idx}`;
												const displayText = item.replace(
													/ — (Completed|Still Needed)$/,
													"",
												);
												if (summaryOnly) {
													return (
														<li
															key={itemKey}
															className="flex items-start gap-3 px-4 py-3"
														>
															<span
																className={`size-2 rounded-full shrink-0 mt-2 ${color.replace("text-", "bg-")}`}
															/>
															<span className="text-sm font-medium text-gray-800">
																{displayText}
															</span>
														</li>
													);
												}
												const originallyDone = item.endsWith("— Completed");
												const isDone = originallyDone;
												return (
													<li
														key={itemKey}
														className="flex items-start gap-3 px-4 py-3"
													>
														{isDone ? (
															<CheckCircle
																className={`size-4 shrink-0 mt-0.5 ${color}`}
															/>
														) : (
															<Circle className="size-4 shrink-0 mt-0.5 text-gray-300" />
														)}
														<span className="text-sm text-gray-800">
															{displayText}
															<span className="block text-xs text-gray-500 mt-0.5">
																{isDone ? "Completed" : "Still needed"}
															</span>
														</span>
													</li>
												);
											})}
										</ul>
									</div>
								))}
						</div>

					<DialogFooter className="border-t border-gray-200 px-6 py-4 sm:flex-row">
						<Button
							variant="outline"
							className="h-10 w-full text-sm font-semibold border-gray-300 hover:bg-gray-50 sm:flex-1"
							onClick={closeReviewModal}
						>
							Cancel
						</Button>
						<Button
							className="h-10 w-full border border-blue-800 bg-blue-700 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 hover:text-white sm:flex-1"
							onClick={() => {
									if (parserResponse && parsedRequirements) {
										writeAuditData(
											buildConfirmedAuditData(parserResponse, parsedRequirements),
										);
										setFile(null);
									}
									markAuditUploaded();
									setShowReviewModal(false);
									setAuditConfirmed(true);
									navigate("/preferences");
							}}
						>
							<CheckCircle className="size-4 mr-2" />
							Continue to Preferences
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
