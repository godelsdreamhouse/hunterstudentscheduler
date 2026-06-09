import { Suspense } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./context/AuthContext";

function PageLoader() {
	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50">
			<p className="text-gray-500">Loading...</p>
		</div>
	);
}

export default function App() {
	return (
		<AuthProvider>
			<Suspense fallback={<PageLoader />}>
				<RouterProvider router={router} />
			</Suspense>
		</AuthProvider>
	);
}
