import { useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { API_BASE } from "../../lib/api";
import { useAuth } from "../context/AuthContext";

function microsoftErrorMessage(error: string | null) {
	const messages: Record<string, string> = {
		"microsoft-not-configured": "Microsoft sign-in is not available yet. Please try again later.",
		"microsoft-unavailable": "Microsoft sign-in is temporarily unavailable. Please try again.",
		"microsoft-sign-in-failed": "Microsoft could not verify your sign-in. Please try again.",
		"microsoft-sign-in-cancelled": "Microsoft sign-in was cancelled.",
		"microsoft-email-not-allowed": "Please sign in with your @login.cuny.edu Microsoft account.",
	};
	return error ? messages[error] ?? "Microsoft sign-in could not be completed." : null;
}

export function Login() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const { refetch } = useAuth();
	const completingProfile = searchParams.get("mode") === "complete-microsoft";
	const [error, setError] = useState<string | null>(microsoftErrorMessage(searchParams.get("error")));
	const [isSubmitting, setIsSubmitting] = useState(false);
	const emplIdRef = useRef<HTMLInputElement>(null);
	const firstNameRef = useRef<HTMLInputElement>(null);
	const lastNameRef = useRef<HTMLInputElement>(null);

	const signInWithMicrosoft = () => window.location.assign(`${API_BASE}/api/users/oauth/microsoft`);
	const completeProfile = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);
		setIsSubmitting(true);
		try {
			const response = await fetch(`${API_BASE}/api/users/oauth/microsoft/register`, {
				method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
				body: JSON.stringify({ emplid: emplIdRef.current?.value ?? "", first_name: firstNameRef.current?.value ?? "", last_name: lastNameRef.current?.value ?? "" }),
			});
			const data = await response.json().catch(() => ({}));
			if (!response.ok) return setError(data.error ?? "We could not create your account. Please try again.");
			await refetch();
			navigate("/dashboard");
		} catch {
			setError("Service unavailable — please try again later.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="min-h-screen flex flex-col bg-gray-50">
			<div className="bg-[#582C83]"><div className="max-w-screen-xl mx-auto px-4 lg:px-6 h-9 flex items-center"><span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Schedule Builder</span></div></div>
			<header className="bg-white border-b border-gray-200 shadow-sm"><div className="max-w-screen-xl mx-auto px-4 lg:px-6 py-3 flex items-center justify-between">
				<button onClick={() => navigate("/")} className="cursor-pointer text-left group"><div className="font-black text-[#582C83] leading-none uppercase group-hover:opacity-80 transition-opacity" style={{ fontSize: "26px", letterSpacing: "-0.01em" }}>HUNTER</div><div className="text-[#582C83] text-[9px] tracking-[0.18em] font-bold uppercase leading-tight mt-0.5 opacity-70">The City University of New York</div></button>
				<button onClick={() => navigate("/")} className="flex items-center gap-1.5 text-sm text-[#582C83] hover:opacity-70 transition-opacity font-semibold"><ArrowLeft className="size-4" /> Back</button>
			</div></header>
			<main className="flex-1 flex items-start justify-center pt-12 pb-16 px-4"><div className="w-full max-w-md"><div className="h-1 bg-[#582C83] rounded-t" />
				<div className="bg-white border border-gray-200 border-t-0 shadow-sm rounded-b p-8">
					<h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">{completingProfile ? "Finish your account" : "Sign in"}</h1>
					<p className="text-sm text-gray-500 mt-1 mb-6">{completingProfile ? "One last step: we need your CUNY EMPLID to build your schedule." : "Use your Hunter Microsoft account to access your schedule planner."}</p>
					{error && <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-4 py-2">{error}</p>}
					{completingProfile ? <form onSubmit={completeProfile} className="space-y-4">
						<div className="space-y-1.5"><Label htmlFor="emplid" className="text-xs font-bold uppercase tracking-wide text-gray-600">Student ID (EMPLID)</Label><Input id="emplid" ref={emplIdRef} inputMode="numeric" pattern="[0-9]{8}" placeholder="12345678" required /></div>
						<div className="space-y-1.5"><Label htmlFor="first_name" className="text-xs font-bold uppercase tracking-wide text-gray-600">First name</Label><Input id="first_name" ref={firstNameRef} required /></div>
						<div className="space-y-1.5"><Label htmlFor="last_name" className="text-xs font-bold uppercase tracking-wide text-gray-600">Last name</Label><Input id="last_name" ref={lastNameRef} required /></div>
						<Button type="submit" disabled={isSubmitting} className="w-full bg-[#582C83] hover:bg-[#4a2270] text-white h-10 text-sm font-bold uppercase tracking-wide">{isSubmitting ? "Saving…" : "Continue"}</Button>
					</form> : <Button type="button" onClick={signInWithMicrosoft} className="w-full bg-[#582C83] hover:bg-[#4a2270] text-white h-10 text-sm font-bold">Continue with Microsoft</Button>}
				</div>
				<p className="mt-6 text-xs text-gray-400 text-center px-4">Hunter College Smart Schedule Builder · Not an official CUNY product</p>
			</div></main>
		</div>
	);
}
