import { Check, Download } from "lucide-react";
import { NavLink, useLocation } from "react-router";
import styles from "./PlannerHeader.module.css";

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
    <header className={styles.header}>
      <div className={styles.bar}>
        <NavLink to="/planner" className={styles.brand}>
          <span className={styles.brandMark}>H</span>
          <span className={styles.brandText}>
            <strong>Hunter Schedule Builder</strong>
            <span>Spring 2027</span>
          </span>
        </NavLink>

        <nav aria-label="Planner modes" className={styles.modes}>
          <NavLink to="/planner" className={`${styles.mode} ${plannerActive ? styles.modeActive : ""}`}>Course Search</NavLink>
          <NavLink to="/upload" className={`${styles.mode} ${smartActive ? styles.modeActive : ""}`}>Smart Builder</NavLink>
        </nav>

        <div className={styles.actions}>
          <span className={styles.noAccount}>No account needed</span>
          {plannerActive ? (
            <>
              <NavLink to="/upload" className={`${styles.action} ${styles.desktopAction}`}>Build from DegreeWorks</NavLink>
              <button type="button" onClick={onExport} disabled={exportDisabled} title="Download an .ics calendar file" className={styles.action}>
                <Download className="size-4" /><span className="hidden sm:inline">Export calendar</span>
              </button>
            </>
          ) : (
            <NavLink to="/planner" className={styles.action}>Back to planner</NavLink>
          )}
        </div>
      </div>

      {smartActive && (
        <div className={styles.progress}>
          <ol className={styles.steps} aria-label="Smart schedule progress">
            {SMART_STEPS.map((step, index) => {
              const complete = index < smartStep;
              const active = index === smartStep;
              return (
                <li key={step.path} className={`${styles.step} ${complete ? styles.stepComplete : ""} ${active ? styles.stepActive : ""}`}>
                  <span className={styles.stepNumber}>{complete ? <Check /> : index + 1}</span>
                  <span className={styles.stepLabel}>{step.label}</span>
                  {index < SMART_STEPS.length - 1 && <span className={`${styles.connector} ${index < smartStep ? styles.connectorComplete : ""}`} />}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </header>
  );
}
