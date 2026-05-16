import { Navigate, Outlet } from "react-router";
import { useAuth } from "../context/AuthContext";

export function PublicRoute() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-100">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export function NotFoundRedirect() {
  return <Navigate to="/" replace />;
}
