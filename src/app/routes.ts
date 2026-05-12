import { lazy } from "react";
import { createBrowserRouter } from "react-router";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { NotFoundRedirect, PublicRoute } from "./components/PublicRoute";
import { SetupCompleteRoute } from "./components/SetupCompleteRoute";

const Landing = lazy(() => import("./pages/Landing").then(({ Landing }) => ({ default: Landing })));
const Login = lazy(() => import("./pages/Login").then(({ Login }) => ({ default: Login })));
const Dashboard = lazy(() => import("./pages/Dashboard").then(({ Dashboard }) => ({ default: Dashboard })));
const UploadAudit = lazy(() => import("./pages/UploadAudit").then(({ UploadAudit }) => ({ default: UploadAudit })));
const SetPreferences = lazy(() => import("./pages/SetPreferences").then(({ SetPreferences }) => ({ default: SetPreferences })));
const ViewSchedules = lazy(() => import("./pages/ViewSchedules").then(({ ViewSchedules }) => ({ default: ViewSchedules })));
const Settings = lazy(() => import("./pages/Settings").then(({ Settings }) => ({ default: Settings })));

export const router = createBrowserRouter([
  { path: "/", Component: Landing },
  {
    Component: PublicRoute,
    children: [
      { path: "/login", Component: Login },
    ],
  },
  {
    Component: ProtectedRoute,
    children: [
      { path: "/dashboard", Component: Dashboard },
      { path: "/upload", Component: UploadAudit },
      { path: "/preferences", Component: SetPreferences },
      { path: "/settings", Component: Settings },
      {
        Component: SetupCompleteRoute,
        children: [
          { path: "/schedules", Component: ViewSchedules },
        ],
      },
    ],
  },
  { path: "*", Component: NotFoundRedirect },
]);
