import { NavLink, useNavigate } from "react-router";

interface HunterHeaderProps {
	/** Show app nav links in the purple bar */
	showNav?: boolean;
	/** Retained for compatibility with dormant account-only screens. */
	showSignOut?: boolean;
}

const NAV_LINKS = [
	{ to: "/upload", label: "Upload Audit" },
	{ to: "/requirements", label: "Requirements" },
	{ to: "/preferences", label: "Preferences" },
	{ to: "/schedules", label: "Smart Schedule" },
	{ to: "/planner", label: "Manual Planner" },
] as const;

export function HunterHeader({
	showNav = false,
}: HunterHeaderProps) {
	const navigate = useNavigate();

	return (
		<div className="sticky top-0 z-50">
			{/* ── Purple identity / nav bar ────────────────────────────── */}
			<div className="bg-[#582C83]">
				<div className="max-w-screen-xl mx-auto px-4 lg:px-6 flex items-center justify-between h-9">
					<span className="text-[11px] font-semibold uppercase tracking-wider text-white/60 shrink-0 hidden sm:block">
						Schedule Builder
					</span>

					{showNav ? (
						<nav className="flex items-stretch overflow-x-auto text-[11px] font-semibold ml-auto sm:ml-0">
							{NAV_LINKS.map(({ to, label }) => (
								<NavLink
									key={to}
									to={to}
									className={({ isActive }) =>
										`px-3 h-9 flex items-center transition-colors whitespace-nowrap ${
											isActive
												? "text-white bg-white/20"
												: "text-white/70 hover:text-white hover:bg-white/10"
										}`
									}
								>
									{label}
								</NavLink>
							))}
						</nav>
					) : (
						<span className="text-[11px] font-semibold uppercase tracking-wider text-white/60 ml-auto sm:hidden">
							Schedule Builder
						</span>
					)}
				</div>
			</div>

			{/* ── White brand bar ──────────────────────────────────────── */}
			<header className="bg-white border-b border-gray-200 shadow-sm">
				<div className="max-w-screen-xl mx-auto px-4 lg:px-6 py-3 flex items-center justify-between gap-4">
					<button
						onClick={() => navigate("/")}
						className="cursor-pointer text-left group shrink-0"
					>
						<div
							className="font-black text-[#582C83] leading-none uppercase group-hover:opacity-80 transition-opacity"
							style={{ fontSize: "26px", letterSpacing: "-0.01em" }}
						>
							HUNTER
						</div>
						<div className="text-[#582C83] text-[9px] tracking-[0.18em] font-bold uppercase leading-tight mt-0.5 opacity-70">
							The City University of New York
						</div>
					</button>

					<div className="flex items-center gap-3 min-w-0">
						<span className="text-xs font-semibold text-gray-500 hidden sm:block">
							No account required
						</span>
					</div>
				</div>
			</header>
		</div>
	);
}
