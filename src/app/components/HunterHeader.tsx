import { NavLink, useNavigate } from "react-router";
import { Button } from "./ui/button";
import { useUserProfile } from "../hooks/useUserProfile";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../../lib/api";

interface HunterHeaderProps {
	/** Show app nav links in the purple bar */
	showNav?: boolean;
	/** Show Sign Out button in the white brand bar */
	showSignOut?: boolean;
}

const NAV_LINKS = [
	{ to: "/dashboard", label: "Dashboard" },
	{ to: "/upload", label: "Upload Audit" },
	{ to: "/preferences", label: "Preferences" },
	{ to: "/schedules", label: "My Schedule" },
] as const;

export function HunterHeader({
	showNav = false,
	showSignOut = false,
}: HunterHeaderProps) {
	const navigate = useNavigate();
	const { email } = useUserProfile();
	const { refetch } = useAuth();

	const handleSignOut = async () => {
		try {
			await fetch(`${API_BASE}/api/users/logout`, {
				method: "POST",
				credentials: "include",
			});
		} finally {
			await refetch();
			navigate("/login");
		}
	};

	return (
		<div className="sticky top-0 z-50">
			{/* ── Purple identity / nav bar ────────────────────────────── */}
			<div className="bg-[#582C83]">
				<div className="max-w-screen-xl mx-auto px-4 lg:px-6 flex items-center justify-between h-9">
					<span className="text-[11px] font-semibold uppercase tracking-wider text-white/60 shrink-0 hidden sm:block">
						Schedule Builder
					</span>

					{showNav ? (
						<nav className="flex items-stretch text-[11px] font-semibold ml-auto sm:ml-0">
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
						onClick={() => navigate("/dashboard")}
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
						{email && (
							<span className="text-sm text-gray-500 truncate hidden md:block">
								{email}
							</span>
						)}
						{showSignOut && (
							<Button
								variant="outline"
								size="sm"
								onClick={handleSignOut}
								className="shrink-0 border-[#582C83] text-[#582C83] hover:bg-[#582C83] hover:text-white transition-colors text-xs h-8 px-3 font-semibold"
							>
								Sign Out
							</Button>
						)}
					</div>
				</div>
			</header>
		</div>
	);
}
