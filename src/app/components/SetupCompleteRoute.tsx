import { Navigate, Outlet } from "react-router";
import { useSetupProgress } from "../hooks/useSetupProgress";

export function SetupCompleteRoute() {
  const { progress } = useSetupProgress();

  if (!progress.auditUploaded) {
    return <Navigate to="/upload" replace />;
  }

  if (!progress.preferencesSet) {
    return <Navigate to="/preferences" replace />;
  }

  return <Outlet />;
}
