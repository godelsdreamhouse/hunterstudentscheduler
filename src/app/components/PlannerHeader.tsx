import { Check, Download } from "lucide-react";
import { NavLink, useLocation } from "react-router";

type PlannerHeaderProps = {
  onExport?: () => void;
  exportDisabled?: boolean;
};

const SMART_STEPS = [
  { path: "/upload", label: "Upload audit" },
  { path: "/requirements", label: "Review requirements" },
  { path: "/preferences", label: "Set preferences" },
  { path: "/schedules", label: "Build schedules" },
] as const;

export function PlannerHeader({ onExport, exportDisabled = false }: PlannerHeaderProps) {
  const { pathname } = useLocation();
  const plannerActive = pathname === "/planner";
  const smartStep = SMART_STEPS.findIndex((step) => pathname.startsWith(step.path));
  const smartActive = smartStep >= 0;

  return (
    <header className="border-b border-[#ded8e5] bg-white text-slate-950">
      <div className="flex min-h-16 items-center justify-between gap-3 px-4 lg:px-6">
        <NavLink to="/" className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#582C83] text-sm font-black text-white">H</span>
          <span className="min-w-0">
            <strong className="block truncate text-sm leading-none tracking-tight">Hunter Schedule Builder</strong>
            <span className="text-[11px] text-slate-500">Spring 2027</span>
          </span>
        </NavLink>

        <nav aria-label="Planner modes" className="hidden items-center rounded-lg bg-slate-100 p-1 text-sm font-semibold md:flex">
          <NavLink to="/planner" className={`rounded-md px-4 py-1.5 transition ${plannerActive ? "bg-white text-[#582C83] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Course Search</NavLink>
          <NavLink to="/upload" className={`rounded-md px-4 py-1.5 transition ${smartActive ? "bg-white text-[#582C83] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Smart Builder</NavLink>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs font-semibold text-emerald-700 lg:block">No account needed</span>
          {plannerActive ? (
            <>
              <NavLink to="/upload" className="hidden rounded-lg border border-[#cdbddc] px-3 py-2 text-xs font-bold text-[#582C83] hover:bg-[#f6f0fa] sm:block">Build from DegreeWorks</NavLink>
              <button type="button" onClick={onExport} disabled={exportDisabled} title="Download an .ics calendar file" className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-[#bba7ce] hover:text-[#582C83] disabled:cursor-not-allowed disabled:opacity-40">
                <Download className="size-4" /><span className="hidden sm:inline">Export calendar</span>
              </button>
            </>
          ) : (
            <NavLink to="/planner" className="rounded-lg border border-[#cdbddc] px-3 py-2 text-xs font-bold text-[#582C83] hover:bg-[#f6f0fa]">Back to planner</NavLink>
          )}
        </div>
      </div>

      {smartActive && (
        <div className="overflow-x-auto border-t border-slate-100 bg-[#faf9fb] px-4 lg:px-6">
          <ol className="mx-auto flex min-w-[620px] max-w-3xl items-center py-2" aria-label="Smart schedule progress">
            {SMART_STEPS.map((step, index) => {
              const complete = index < smartStep;
              const active = index === smartStep;
              return (
                <li key={step.path} className="flex flex-1 items-center last:flex-none">
                  <span className={`grid size-6 shrink-0 place-items-center rounded-full border text-[10px] font-black ${complete ? "border-[#582C83] bg-[#582C83] text-white" : active ? "border-[#582C83] bg-white text-[#582C83]" : "border-slate-300 bg-white text-slate-400"}`}>{complete ? <Check className="size-3.5" /> : index + 1}</span>
                  <span className={`ml-2 whitespace-nowrap text-xs font-semibold ${active ? "text-[#582C83]" : complete ? "text-slate-700" : "text-slate-400"}`}>{step.label}</span>
                  {index < SMART_STEPS.length - 1 && <span className={`mx-3 h-px min-w-6 flex-1 ${index < smartStep ? "bg-[#582C83]" : "bg-slate-200"}`} />}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </header>
  );
}
