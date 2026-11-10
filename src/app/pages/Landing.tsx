import { useNavigate } from "react-router";
import backgroundImg from "../../assets/campus-background.png";

export function Landing() {
	const navigate = useNavigate();

	return (
		<div className="min-h-screen flex flex-col bg-white">
			{/* ── Top purple identity bar ─────────────────────────────── */}
			<div className="bg-[#582C83]">
				<div className="max-w-screen-xl mx-auto px-4 lg:px-6 h-9 flex items-center">
					<span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
						Schedule Builder
					</span>
				</div>
			</div>

			{/* ── White brand bar ─────────────────────────────────────── */}
			<header className="bg-white border-b border-gray-200 shadow-sm">
				<div className="max-w-screen-xl mx-auto px-4 lg:px-6 py-3 flex items-center justify-between">
					<div>
						<div
							className="font-black text-[#582C83] leading-none uppercase"
							style={{ fontSize: "26px", letterSpacing: "-0.01em" }}
						>
							HUNTER
						</div>
						<div className="text-[#582C83] text-[9px] tracking-[0.18em] font-bold uppercase leading-tight mt-0.5 opacity-70">
							The City University of New York
						</div>
					</div>
					<button
						onClick={() => navigate("/upload")}
						className="bg-[#582C83] hover:bg-[#4a2270] text-white text-sm font-bold px-5 py-2 transition-colors"
					>
						Smart Scheduler
					</button>
				</div>
			</header>

			{/* ── Hero ────────────────────────────────────────────────── */}
			<div className="flex flex-1 min-h-[480px] md:min-h-[540px]">
				{/* Left: purple content panel */}
				<div className="bg-[#582C83] flex flex-col justify-center px-8 lg:px-16 py-16 w-full md:w-[50%] lg:w-[44%] shrink-0">
					<p className="text-white/55 text-[10px] font-black uppercase tracking-[0.22em] mb-4 leading-none">
						Hunter College
					</p>
					<h1
						className="text-white font-black leading-[1.0] mb-6 uppercase"
						style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}
					>
						Smart
						<br />
						Schedule
						<br />
						Builder
					</h1>
					<p className="text-white/75 text-sm leading-relaxed mb-8 max-w-xs">
						Generate a schedule from your DegreeWorks audit or build one
						manually from live Hunter sections. No account required.
					</p>
					<div className="flex flex-wrap gap-3">
						<button
							onClick={() => navigate("/upload")}
							className="px-6 py-2.5 border-2 border-white text-white text-sm font-black uppercase tracking-wide hover:bg-white hover:text-[#582C83] transition-colors"
						>
							Smart Scheduler →
						</button>
						<button
							onClick={() => navigate("/planner")}
							className="px-6 py-2.5 border-2 border-white/35 text-white/75 text-sm font-black uppercase tracking-wide hover:border-white hover:text-white transition-colors"
						>
							Manual Planner
						</button>
					</div>
				</div>

				{/* Right: campus photo with purple tint */}
				<div className="hidden md:block flex-1 relative overflow-hidden">
					<img
						src={backgroundImg}
						alt="Hunter College Campus"
						className="absolute inset-0 w-full h-full object-cover"
					/>
					<div className="absolute inset-0 bg-[#582C83]/25" />
				</div>
			</div>

			{/* ── How It Works ─────────────────────────────────────────── */}
			<div className="py-16 px-4 bg-white border-t border-gray-100">
				<div className="max-w-screen-xl mx-auto">
					<div className="mb-10">
						<span className="text-[#582C83] text-[10px] font-black uppercase tracking-[0.22em] block mb-2">
							How It Works
						</span>
						<h2 className="text-2xl md:text-3xl font-black text-gray-900 uppercase leading-tight">
							Build a Schedule in One Session
						</h2>
					</div>

					<div className="grid md:grid-cols-3 gap-8 md:gap-12">
						{(
							[
								{
									n: "01",
									title: "Choose Your Path",
									body: "Upload a DegreeWorks audit for smart recommendations, or open the manual Spring 2027 planner.",
								},
								{
									n: "02",
									title: "Build Your Week",
									body: "Set your availability and preferences, or add sections yourself while conflicts are blocked.",
								},
								{
									n: "03",
									title: "Save or Export",
									body: "Your work stays in this browser session. Export the finished schedule when you are ready to keep or share it.",
								},
							] as const
						).map(({ n, title, body }) => (
							<div key={n} className="border-t-4 border-[#582C83] pt-5">
								<span className="text-[#582C83] text-5xl font-black leading-none opacity-15 block mb-3 select-none">
									{n}
								</span>
								<h3 className="text-sm font-black text-gray-900 mb-2 uppercase tracking-tight">
									{title}
								</h3>
								<p className="text-sm text-gray-500 leading-relaxed">{body}</p>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* ── CTA bar ──────────────────────────────────────────────── */}
			<div className="bg-[#582C83] py-12 px-4">
				<div className="max-w-screen-xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
					<div>
						<p className="text-white/55 text-[10px] font-black uppercase tracking-[0.22em] mb-1">
							Take the Next Step
						</p>
						<h2 className="text-white font-black text-2xl uppercase leading-tight">
							Build Your Schedule Today
						</h2>
					</div>
					<button
						onClick={() => navigate("/upload")}
						className="shrink-0 px-8 py-3 bg-white text-[#582C83] font-black text-sm uppercase tracking-wide hover:bg-white/90 transition-colors"
					>
						Start Smart Scheduler →
					</button>
				</div>
			</div>

			{/* ── Footer ───────────────────────────────────────────────── */}
			<footer className="bg-[#1a0f28] text-white py-10 px-4">
				<div className="max-w-screen-xl mx-auto flex flex-col md:flex-row justify-between gap-8">
					<div>
						<div
							className="font-black text-xl uppercase leading-none mb-0.5"
							style={{ letterSpacing: "-0.01em" }}
						>
							HUNTER
						</div>
						<div className="text-[9px] tracking-[0.18em] uppercase opacity-50 font-bold mb-4">
							The City University of New York
						</div>
						<p className="text-white/40 text-xs leading-relaxed">
							695 Park Ave
							<br />
							NY, NY 10065
							<br />
							212-772-4000
						</p>
					</div>
					<div className="text-xs text-white/35 self-end text-right">
						<p>Smart Schedule Builder</p>
						<p className="mt-1">Hunter College Academic Planning Tool</p>
						<p className="mt-1">
							Not an official CUNY / Hunter College product
						</p>
					</div>
				</div>
			</footer>
		</div>
	);
}
