import { Fragment, useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useUserProfile } from "../hooks/useUserProfile";
import { usePersistedPreferences } from "../hooks/usePersistedPreferences";
import { useSetupProgress } from "../hooks/useSetupProgress";
import { Button } from "../components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Slider } from "../components/ui/slider";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../components/ui/select";
import {
	ArrowLeft,
	Calendar,
	XCircle,
	BookOpen,
	GraduationCap,
	SlidersHorizontal,
	Search,
	X,
	AlertTriangle,
} from "lucide-react";
import { HunterHeader } from "../components/HunterHeader";
import { API_BASE } from "../../lib/api";
import { readAuditData } from "../hooks/useAuditData";
import type { ElectiveCourse } from "../hooks/usePersistedPreferences";
import {
	DEFAULT_CREDIT_RANGE,
	getDefaultSemester,
	getUpcomingSemesters,
} from "../constants/preferences";

const DAYS = [
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];
const TIME_SLOTS = [
	"7:00 AM",
	"8:00 AM",
	"9:00 AM",
	"10:00 AM",
	"11:00 AM",
	"12:00 PM",
	"1:00 PM",
	"2:00 PM",
	"3:00 PM",
	"4:00 PM",
	"5:00 PM",
	"6:00 PM",
	"7:00 PM",
	"8:00 PM",
	"9:00 PM",
];

// TODO: hardcoded - replace with departments list fetched from backend
const DEPARTMENTS = [
	"Anthropology",
	"Art",
	"Biology",
	"Chemistry",
	"Computer Science",
	"Economics",
	"English",
	"History",
	"Mathematics",
	"Philosophy",
	"Physics",
	"Political Science",
	"Psychology",
	"Sociology",
	"Statistics",
];

export function SetPreferences() {
	const navigate = useNavigate();
	useUserProfile(); // email shown by HunterHeader
	const { markPreferencesSet } = useSetupProgress();
	const upcomingSemesters = getUpcomingSemesters(2);
	const defaultSemester = getDefaultSemester();
	const {
		semester,
		setSemester,
		creditRange,
		setCreditRange,
		blockedTimes,
		setBlockedTimes,
		preferences,
		setPreferences,
		preferredDepartments,
		setPreferredDepartments,
		specificCoursesList,
		setSpecificCoursesList,
		electiveCourses,
		setElectiveCourses,
	} = usePersistedPreferences();

	const programKey = readAuditData()?.parserPayload?.majors?.[0] ?? "";

	const [electiveSearch, setElectiveSearch] = useState("");
	const [electiveResults, setElectiveResults] = useState<ElectiveCourse[]>([]);
	const [isElectiveSearching, setIsElectiveSearching] = useState(false);

	const [specificSearch, setSpecificSearch] = useState("");
	const [specificResults, setSpecificResults] = useState<ElectiveCourse[]>([]);
	const [isSpecificSearching, setIsSpecificSearching] = useState(false);
	const [dragMode, setDragMode] = useState<"block" | "unblock" | null>(null);

	useEffect(() => {
		const q = electiveSearch.trim();
		if (!q) {
			setElectiveResults([]);
			setIsElectiveSearching(false);
			return;
		}
		setIsElectiveSearching(true);
		const timeout = setTimeout(async () => {
			try {
				const url = `${API_BASE}/api/courses/electives?q=${encodeURIComponent(q)}&program_key=${encodeURIComponent(programKey)}`;
				const res = await fetch(url, { credentials: "include" });
				if (res.ok) {
					const data = (await res.json()) as {
						courses: { course_code: string }[];
					};
					setElectiveResults(
						data.courses.map((c) => ({
							id: c.course_code,
							code: c.course_code,
							name: "",
						})),
					);
				}
			} catch {
				setElectiveResults([]);
			} finally {
				setIsElectiveSearching(false);
			}
		}, 300);
		return () => clearTimeout(timeout);
	}, [electiveSearch, programKey]);

	useEffect(() => {
		const q = specificSearch.trim();
		if (!q) {
			setSpecificResults([]);
			setIsSpecificSearching(false);
			return;
		}
		setIsSpecificSearching(true);
		const timeout = setTimeout(async () => {
			try {
				const res = await fetch(
					`${API_BASE}/api/courses/search?q=${encodeURIComponent(q)}`,
					{ credentials: "include" },
				);
				if (res.ok) {
					const data = (await res.json()) as {
						courses: {
							course_id: string;
							course_code: string;
							course_name: string;
						}[];
					};
					setSpecificResults(
						data.courses.map((c) => ({
							id: c.course_id,
							code: c.course_code,
							name: c.course_name,
						})),
					);
				}
			} catch {
				setSpecificResults([]);
			} finally {
				setIsSpecificSearching(false);
			}
		}, 300);
		return () => clearTimeout(timeout);
	}, [specificSearch]);

	// Exclude already-selected courses from each dropdown
	const allPinnedIds = new Set(
		[...electiveCourses, ...specificCoursesList].map((c) => c.id),
	);
	const filteredElectiveResults = electiveResults.filter(
		(c) => !allPinnedIds.has(c.id),
	);
	const filteredSpecificResults = specificResults.filter(
		(c) => !allPinnedIds.has(c.id),
	);

	const toggleTimeSlot = (day: string, slot: string) => {
		setBlockedTimes((prev: Record<string, Set<string>>) => {
			const existingSet = prev[day] ?? new Set<string>();
			const newSet = new Set(existingSet);
			if (newSet.has(slot)) {
				newSet.delete(slot);
			} else {
				newSet.add(slot);
			}
			return { ...prev, [day]: newSet };
		});
	};

	const setTimeSlotBlocked = (day: string, slot: string, blocked: boolean) => {
		setBlockedTimes((prev: Record<string, Set<string>>) => {
			const existingSet = prev[day] ?? new Set<string>();
			const newSet = new Set(existingSet);
			if (blocked) {
				newSet.add(slot);
			} else {
				newSet.delete(slot);
			}
			return { ...prev, [day]: newSet };
		});
	};

	const toggleFullDay = (day: string) => {
		setBlockedTimes((prev: Record<string, Set<string>>) => {
			const existingSet = prev[day] ?? new Set<string>();
			const allBlocked = TIME_SLOTS.every((slot) => existingSet.has(slot));
			const newSet = new Set(existingSet);
			if (allBlocked) {
				TIME_SLOTS.forEach((slot) => newSet.delete(slot));
			} else {
				TIME_SLOTS.forEach((slot) => newSet.add(slot));
			}
			return { ...prev, [day]: newSet };
		});
	};

	const startTimeSlotDrag = (day: string, slot: string) => {
		// keep drag behavior consistent with the first cell's block or unblock action
		const nextMode = isSlotBlocked(day, slot) ? "unblock" : "block";
		setDragMode(nextMode);
		setTimeSlotBlocked(day, slot, nextMode === "block");
	};

	const applyTimeSlotDrag = (day: string, slot: string) => {
		if (!dragMode) return;
		setTimeSlotBlocked(day, slot, dragMode === "block");
	};

	const updatePreference = (key: keyof typeof preferences, value: boolean) => {
		setPreferences((prev: typeof preferences) => ({ ...prev, [key]: value }));
	};

	const toggleDepartment = (dept: string) => {
		setPreferredDepartments((prev: string[]) =>
			prev.includes(dept)
				? prev.filter((d: string) => d !== dept)
				: [...prev, dept],
		);
	};

	const isSlotBlocked = (day: string, slot: string) => {
		return blockedTimes[day]?.has(slot) || false;
	};

	const hasMeaningfulPreferences =
		semester !== defaultSemester ||
		creditRange[0] !== DEFAULT_CREDIT_RANGE[0] ||
		creditRange[1] !== DEFAULT_CREDIT_RANGE[1] ||
		Object.values(preferences).some(Boolean) ||
		Object.values(blockedTimes).some((slots) => slots.size > 0) ||
		preferredDepartments.length > 0 ||
		electiveCourses.length > 0 ||
		specificCoursesList.length > 0;

	const markSavedPreferences = () => {
		const label =
			upcomingSemesters.find((s) => s.value === semester)?.label ?? semester;
		markPreferencesSet(label);
	};

	const handleBackToDashboard = () => {
		if (hasMeaningfulPreferences) {
			markSavedPreferences();
		}
		navigate("/dashboard");
	};

	const handleGenerateSchedules = () => {
		markSavedPreferences();
		navigate("/schedules");
	};

	useEffect(() => {
		const stopDragging = () => setDragMode(null);
		window.addEventListener("pointerup", stopDragging);
		window.addEventListener("pointercancel", stopDragging);
		return () => {
			window.removeEventListener("pointerup", stopDragging);
			window.removeEventListener("pointercancel", stopDragging);
		};
	}, []);

	return (
		<div className="min-h-screen bg-gray-50">
			<HunterHeader showNav showSignOut />

			<main className="max-w-screen-xl mx-auto px-4 lg:px-6 py-4">
				<Button
					variant="ghost"
					size="sm"
					onClick={handleBackToDashboard}
					className="mb-4 hover:bg-white/60 text-gray-600 hover:text-gray-800 transition-all"
				>
					<ArrowLeft className="size-4 mr-2" />
					Back to Dashboard
				</Button>

				<div className="mb-4">
					<h2 className="text-2xl font-bold text-gray-900 mb-2">
						Set Your Preferences
					</h2>
					<p className="text-sm text-gray-600">
						Tell us about your availability and preferences to generate
						optimized schedules
					</p>
				</div>

				<div className="space-y-4">
					<div className="flex gap-4">
						<Card className="shadow-sm border border-gray-200 bg-white w-[30%] shrink-0">
							<CardHeader className="pb-2">
								<div className="flex items-center gap-2">
									<Calendar className="size-5 text-[#582C83]" />
									<CardTitle className="text-lg">Semester</CardTitle>
								</div>
								<CardDescription className="text-sm mt-1">
									Select the semester you're planning for
								</CardDescription>
							</CardHeader>
							<CardContent className="pt-2 pb-4">
								<Select value={semester} onValueChange={setSemester}>
									<SelectTrigger className="w-full h-10 px-4 py-2 rounded-full border-2 border-[#c9b3e8] bg-[#f5f0fb] hover:bg-[#ede5f8] text-[#3d1a5e] font-semibold text-sm shadow-sm transition-colors focus-visible:ring-[#582C83] focus-visible:border-[#582C83]">
										<SelectValue placeholder="Choose a semester" />
									</SelectTrigger>
									<SelectContent className="rounded-xl shadow-lg border-0 overflow-hidden">
										{upcomingSemesters.map((sem) => (
											<SelectItem
												key={sem.value}
												value={sem.value}
												className="text-sm py-2 px-4 font-medium cursor-pointer"
											>
												{sem.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</CardContent>
						</Card>

						<Card className="shadow-sm border border-gray-200 bg-white flex-1">
							<CardHeader className="pb-2">
								<div className="flex items-center gap-2">
									<SlidersHorizontal className="size-5 text-[#582C83]" />
									<CardTitle className="text-lg">Target Credit Load</CardTitle>
								</div>
								<CardDescription className="text-sm mt-1">
									Set your minimum and maximum credits per semester
								</CardDescription>
							</CardHeader>
							<CardContent className="pt-2">
								<div className="space-y-3">
									<div className="flex items-center justify-between px-2">
										<div className="text-center">
											<span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
												Min
											</span>
											<div className="text-2xl font-bold text-[#582C83] mt-0.5">
												{creditRange[0]}
											</div>
										</div>
										<div className="text-center">
											<span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
												Max
											</span>
											<div className="text-2xl font-bold text-[#582C83] mt-0.5">
												{creditRange[1]}
											</div>
										</div>
									</div>
									<div className="px-2">
										<Slider
											value={creditRange}
											onValueChange={setCreditRange}
											min={DEFAULT_CREDIT_RANGE[0]}
											max={DEFAULT_CREDIT_RANGE[1]}
											step={3}
											className="w-full"
										/>
										<div className="flex justify-between text-xs text-gray-500 mt-2 font-medium">
											<span>{DEFAULT_CREDIT_RANGE[0]} credits</span>
											<span>{DEFAULT_CREDIT_RANGE[1]} credits</span>
										</div>
									</div>
									<div className="bg-[#f5f0fb] p-2.5 rounded-xl border border-[#c9b3e8]">
										<p className="text-sm text-[#3d1a5e] text-center font-medium">
											{creditRange[0]}–{creditRange[1]} credits this semester
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Calendar + Preference checkboxes: two-column layout */}
					<div className="flex gap-4 items-start">
						{/* Left column (60%): Unavailable Times */}
						<div className="w-[60%] shrink-0">
							<div className="mb-3">
								<h3 className="text-lg font-bold text-gray-900 mb-2">
									Required Constraints
								</h3>
								<div className="w-12 h-1 bg-gradient-to-r from-orange-400 to-orange-300 rounded-full mb-3" />
								<p className="text-sm text-orange-600 font-medium">
									These are hard requirements — schedules that don't meet these
									will not be shown
								</p>
							</div>
							<Card className="shadow-sm border border-gray-200 bg-white">
								<CardHeader className="pb-3">
									<div className="flex items-center gap-2">
										<XCircle className="size-5 text-orange-500" />
										<CardTitle className="text-lg">
											Unavailable Times (Required)
										</CardTitle>
									</div>
									<CardDescription className="text-sm mt-1">
										Block times when you are absolutely NOT available for
										classes
									</CardDescription>
								</CardHeader>
								<CardContent className="pt-3">
									<div className="overflow-x-auto">
										<div className="min-w-[500px] border border-gray-200 rounded-xl overflow-hidden bg-white shadow-inner">
											<div className="grid grid-cols-7 gap-0">
												<div className="text-xs font-bold text-gray-700 p-2 bg-gradient-to-r from-gray-100 to-gray-50 border-b border-gray-200 flex items-center justify-center">
													TIME
												</div>
												{DAYS.map((day) => (
													<button
														key={day}
														type="button"
														onClick={() => toggleFullDay(day)}
														className="text-center font-bold text-xs py-2 px-1 bg-gradient-to-r from-gray-100 to-gray-50 border-b border-l border-gray-200 hover:from-orange-50 hover:to-orange-100 hover:text-orange-700 transition-colors"
														title={`Toggle all ${day} unavailable times`}
													>
														{day.slice(0, 3)}
													</button>
												))}
												{TIME_SLOTS.map((slot, slotIndex) => (
													<Fragment key={slot}>
														<div
															className={`h-6 text-xs text-gray-700 flex items-center justify-center px-2 font-medium border-b border-gray-200 ${slotIndex % 2 === 0 ? "bg-gray-50" : "bg-white"}`}
														>
															{slot}
														</div>
														{DAYS.map((day) => (
															<button
																key={`${day}-${slot}`}
																type="button"
																onPointerDown={(event) => {
																	event.preventDefault();
																	startTimeSlotDrag(day, slot);
																}}
																onPointerEnter={() =>
																	applyTimeSlotDrag(day, slot)
																}
																onKeyDown={(event) => {
																	if (
																		event.key === "Enter" ||
																		event.key === " "
																	) {
																		event.preventDefault();
																		toggleTimeSlot(day, slot);
																	}
																}}
																aria-label={`${isSlotBlocked(day, slot) ? "Unblock" : "Block"} ${day} at ${slot}`}
																className={`h-6 touch-none transition-all duration-200 border-b border-l border-gray-200 hover:shadow-inner ${
																	isSlotBlocked(day, slot)
																		? "bg-red-100 hover:bg-red-200 border-red-200"
																		: "bg-white hover:bg-green-50"
																}`}
															/>
														))}
													</Fragment>
												))}
											</div>
										</div>
									</div>
									<div className="mt-3 flex items-center gap-6">
										<div className="flex items-center gap-2">
											<div className="size-4 bg-white border border-gray-300 rounded" />
											<span className="text-sm text-gray-600 font-medium">
												Available
											</span>
										</div>
										<div className="flex items-center gap-2">
											<div className="size-4 bg-red-100 border border-red-200 rounded" />
											<span className="text-sm text-gray-600 font-medium">
												Blocked
											</span>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>

						{/* Right column (40%): Schedule Preferences stacked */}
						<div className="flex-1">
							<div className="mb-3">
								<h3 className="text-lg font-bold text-gray-900 mb-2">
									Schedule Preferences
								</h3>
								<div className="w-12 h-1 bg-[#582C83] rounded-full mb-3" />
								<p className="text-sm text-gray-600">
									These are your preferences — we'll try to optimize for them
									when possible
								</p>
							</div>
							<div className="space-y-3">
								{/* Class Timing */}
								<Card className="shadow-sm border border-gray-200 bg-white">
									<CardHeader className="pb-3">
										<CardTitle className="text-base font-semibold">
											Class Timing Preferences
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-1">
										{[
											{
												id: "backToBack",
												label: "Prefer back-to-back classes",
												key: "backToBack",
											},
											// TODO: hardcoded - replace time boundary strings with values from shared time-slot constants
											{
												id: "morningClasses",
												label: "Prefer morning classes (7:00–10:50 AM)",
												key: "morningClasses",
											},
											{
												id: "midDayClasses",
												label: "Prefer mid-day classes (11:00 AM–3:50 PM)",
												key: "midDayClasses",
											},
											{
												id: "eveningClasses",
												label: "Prefer evening classes (4:00–9:50 PM)",
												key: "eveningClasses",
											},
										].map(({ id, label, key }) => (
											<div
												key={id}
												className="flex items-center space-x-3 p-2.5 rounded-lg hover:bg-[#f5f0fb] transition-colors"
											>
												<Checkbox
													id={id}
													checked={preferences[key as keyof typeof preferences]}
													onCheckedChange={(checked) =>
														updatePreference(
															key as keyof typeof preferences,
															checked as boolean,
														)
													}
													className="text-blue-600"
												/>
												<Label
													htmlFor={id}
													className="text-sm cursor-pointer font-medium"
												>
													{label}
												</Label>
											</div>
										))}
									</CardContent>
								</Card>

								{/* Schedule & Format */}
								<Card className="shadow-sm border border-gray-200 bg-white">
									<CardHeader className="pb-3">
										<CardTitle className="text-base font-semibold">
											Schedule & Format Preferences
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-1">
										{[
											{
												id: "minimizeDays",
												label: "Minimize days on campus",
												key: "minimizeDays",
											},
											{
												id: "preferInPerson",
												label: "Prefer in-person sections",
												key: "preferInPerson",
											},
											{
												id: "preferRemote",
												label: "Prefer remote sections",
												key: "preferRemote",
											},
										].map(({ id, label, key }) => (
											<div
												key={id}
												className="flex items-center space-x-3 p-2.5 rounded-lg hover:bg-[#f5f0fb] transition-colors"
											>
												<Checkbox
													id={id}
													checked={preferences[key as keyof typeof preferences]}
													onCheckedChange={(checked) =>
														updatePreference(
															key as keyof typeof preferences,
															checked as boolean,
														)
													}
													className="text-blue-600"
												/>
												<Label
													htmlFor={id}
													className="text-sm cursor-pointer font-medium"
												>
													{label}
												</Label>
											</div>
										))}
									</CardContent>
								</Card>
							</div>
						</div>
					</div>

					{/* Course Preferences */}
					<div className="mb-3">
						<h3 className="text-lg font-bold text-gray-900 mb-2">
							Course Preferences
						</h3>
						<div className="w-12 h-1 bg-gradient-to-r from-blue-500 to-indigo-400 rounded-full mb-3" />
						<p className="text-sm text-gray-600">
							Specify electives, required courses, and departments you'd like to
							prioritize
						</p>
					</div>

					{/* Major Electives */}
					<Card className="relative z-20 shadow-sm border border-gray-200 bg-white">
						<CardHeader className="pb-3">
							<div className="flex items-center gap-2">
								<GraduationCap className="size-5 text-[#582C83]" />
								<CardTitle className="text-lg">Major Electives</CardTitle>
							</div>
							<CardDescription className="text-sm mt-1">
								Search and select up to 4 elective courses to include in your
								schedule
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4 pt-3">
							<div className="space-y-1.5">
								<p className="text-xs font-semibold text-indigo-700">
									{electiveCourses.length}/4 electives selected
								</p>
								<div className="relative">
									<div
										className={`flex items-center gap-2 border rounded-xl px-3 h-10 bg-white shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 ${electiveCourses.length >= 4 ? "border-gray-200 bg-gray-50" : "border-gray-300"}`}
									>
										<Search className="size-4 text-gray-400 flex-shrink-0" />
										<input
											type="text"
											value={electiveSearch}
											onChange={(e) => setElectiveSearch(e.target.value)}
											placeholder={
												electiveCourses.length >= 4
													? "Maximum of 4 electives selected"
													: "Search by course code or name..."
											}
											disabled={electiveCourses.length >= 4}
											className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400 disabled:cursor-not-allowed"
										/>
										{isElectiveSearching && (
											<span className="text-xs text-gray-400 whitespace-nowrap">
												Searching...
											</span>
										)}
									</div>

									{electiveSearch.trim() &&
										filteredElectiveResults.length > 0 && (
											<ul className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
												{filteredElectiveResults.map((course) => (
													<li
														key={course.id}
														onClick={() => {
															setElectiveCourses([...electiveCourses, course]);
															setElectiveSearch("");
														}}
														className="flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
													>
														<span className="font-semibold text-sm text-gray-900">
															{course.code}
														</span>
														<span className="text-xs text-gray-500 truncate ml-4">
															{course.name}
														</span>
													</li>
												))}
											</ul>
										)}

									{electiveSearch.trim() &&
										!isElectiveSearching &&
										filteredElectiveResults.length === 0 &&
										electiveResults.length === 0 && (
											<div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-2.5 text-sm text-gray-500">
												No courses found
											</div>
										)}
								</div>
							</div>

							{electiveCourses.length > 0 && (
								<div className="flex flex-wrap gap-2">
									{electiveCourses.map((course) => (
										<div
											key={course.id}
											className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-full text-sm font-medium text-indigo-800"
										>
											<span>
												{course.code} — {course.name}
											</span>
											<button
												type="button"
												onClick={() =>
													setElectiveCourses(
														electiveCourses.filter((c) => c.id !== course.id),
													)
												}
												className="text-indigo-400 hover:text-indigo-700 transition-colors ml-0.5"
												aria-label={`Remove ${course.code}`}
											>
												<X className="size-3.5" />
											</button>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>

					{/* Course & Department Preferences */}
					<Card className="shadow-sm border border-gray-200 bg-white">
						<CardHeader className="pb-3">
							<div className="flex items-center gap-2">
								<BookOpen className="size-5 text-[#582C83]" />
								<CardTitle className="text-lg">
									Course & Department Preferences
								</CardTitle>
							</div>
							<CardDescription className="text-sm mt-1">
								Specify classes or departments you'd like to prioritize when
								fulfilling requirements
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-5 pt-3">
							<div>
								<Label className="text-sm font-semibold text-gray-700 mb-3 block">
									Preferred Departments (Select all that apply)
								</Label>
								<div className="grid grid-cols-2 md:grid-cols-3 gap-2">
									{DEPARTMENTS.map((dept) => (
										<div
											key={dept}
											className="flex items-center space-x-2 p-2.5 rounded-lg hover:bg-[#f5f0fb] transition-colors border border-gray-200"
										>
											<Checkbox
												id={dept}
												checked={preferredDepartments.includes(dept)}
												onCheckedChange={() => toggleDepartment(dept)}
												className="text-blue-600"
											/>
											<Label
												htmlFor={dept}
												className="text-sm cursor-pointer font-medium"
											>
												{dept}
											</Label>
										</div>
									))}
								</div>
								<p className="text-sm text-gray-500 mt-2">
									When fulfilling requirements, we'll prioritize classes from
									these departments
								</p>
							</div>

							<div>
								<Label className="text-sm font-semibold text-gray-700 mb-2 block">
									Specific Courses (Optional)
								</Label>

								<div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-3">
									<AlertTriangle className="size-4 text-amber-600 flex-shrink-0 mt-0.5" />
									<p className="text-sm text-amber-800">
										<strong>These courses will always be included</strong> in
										your generated schedule. Add courses you know you need to
										take this semester.
									</p>
								</div>

								<div className="relative">
									<div className="flex items-center gap-2 border border-gray-300 rounded-xl px-3 h-10 bg-white shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
										<Search className="size-4 text-gray-400 flex-shrink-0" />
										<input
											type="text"
											value={specificSearch}
											onChange={(e) => setSpecificSearch(e.target.value)}
											placeholder="Search by course code or name..."
											className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
										/>
										{isSpecificSearching && (
											<span className="text-xs text-gray-400 whitespace-nowrap">
												Searching...
											</span>
										)}
									</div>

									{specificSearch.trim() &&
										filteredSpecificResults.length > 0 && (
											<ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
												{filteredSpecificResults.map((course) => (
													<li
														key={course.id}
														onClick={() => {
															setSpecificCoursesList([
																...specificCoursesList,
																course,
															]);
															setSpecificSearch("");
														}}
														className="flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
													>
														<span className="font-semibold text-sm text-gray-900">
															{course.code}
														</span>
														<span className="text-xs text-gray-500 truncate ml-4">
															{course.name}
														</span>
													</li>
												))}
											</ul>
										)}

									{specificSearch.trim() &&
										!isSpecificSearching &&
										filteredSpecificResults.length === 0 &&
										specificResults.length === 0 && (
											<div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-2.5 text-sm text-gray-500">
												No courses found
											</div>
										)}
								</div>

								{specificCoursesList.length > 0 && (
									<div className="flex flex-wrap gap-2 mt-3">
										{specificCoursesList.map((course) => (
											<div
												key={course.id}
												className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-full text-sm font-medium text-indigo-800"
											>
												<span>
													{course.code} — {course.name}
												</span>
												<button
													type="button"
													onClick={() =>
														setSpecificCoursesList(
															specificCoursesList.filter(
																(c) => c.id !== course.id,
															),
														)
													}
													className="text-indigo-400 hover:text-indigo-700 transition-colors ml-0.5"
													aria-label={`Remove ${course.code}`}
												>
													<X className="size-3.5" />
												</button>
											</div>
										))}
									</div>
								)}
							</div>

							{preferredDepartments.length > 0 && (
								<div className="p-4 bg-[#f5f0fb] rounded-xl border border-[#c9b3e8]">
									<p className="text-sm text-[#3d1a5e] font-medium">
										<GraduationCap className="inline size-4 mr-1.5" />
										<strong>Selected departments:</strong>{" "}
										{preferredDepartments.join(", ")}
									</p>
								</div>
							)}
						</CardContent>
					</Card>

					<div className="flex gap-4">
						<Button
							variant="outline"
							onClick={handleBackToDashboard}
							className="flex-1 h-10 text-sm font-semibold border-[#582C83] text-[#582C83] hover:bg-[#582C83] hover:text-white transition-colors"
						>
							Back to Dashboard
						</Button>
						<Button
							onClick={handleGenerateSchedules}
							className="flex-1 h-10 text-sm font-semibold bg-[#582C83] hover:bg-[#4a2270] text-white transition-colors"
						>
							Generate Schedules
						</Button>
					</div>
				</div>
			</main>
		</div>
	);
}
