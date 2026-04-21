import { createBrowserRouter } from "react-router";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { UploadAudit } from "./pages/UploadAudit";
import { SetPreferences } from "./pages/SetPreferences";
import { ViewSchedules } from "./pages/ViewSchedules";
import { Settings } from "./pages/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Landing,
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/dashboard",
    Component: Dashboard,
  },
  {
    path: "/upload",
    Component: UploadAudit,
  },
  {
    path: "/preferences",
    Component: SetPreferences,
  },
  {
    path: "/schedules",
    Component: ViewSchedules,
  },
  {
    path: "/settings",
    Component: Settings,
  },
]);