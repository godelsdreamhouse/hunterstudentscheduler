import { lazy } from "react";
import { createBrowserRouter, redirect } from "react-router";
import { NotFoundRedirect } from "./components/PublicRoute";
import { SetupCompleteRoute } from "./components/SetupCompleteRoute";

const UploadAudit = lazy(() => import("./pages/UploadAudit").then(({ UploadAudit }) => ({ default: UploadAudit })));
const SetPreferences = lazy(() => import("./pages/SetPreferences").then(({ SetPreferences }) => ({ default: SetPreferences })));
const ViewSchedules = lazy(() => import("./pages/ViewSchedules").then(({ ViewSchedules }) => ({ default: ViewSchedules })));
const ViewRequirements = lazy(() => import("./pages/ViewRequirements").then(({ ViewRequirements }) => ({ default: ViewRequirements })));
const Planner = lazy(() => import("./pages/Planner").then(({ Planner }) => ({ default: Planner })));
export const router = createBrowserRouter([
  { path: "/", loader: () => redirect("/planner") },
  { path: "/planner", Component: Planner },
  { path: "/upload", Component: UploadAudit },
  { path: "/requirements", Component: ViewRequirements },
  { path: "/preferences", Component: SetPreferences },
  {
    Component: SetupCompleteRoute,
    children: [
      { path: "/schedules", Component: ViewSchedules },
    ],
  },
  { path: "*", Component: NotFoundRedirect },
]);
