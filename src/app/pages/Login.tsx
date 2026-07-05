import { useRef, useState } from "react";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { API_BASE } from "../../lib/api";
import { useAuth } from "../context/AuthContext";

interface AuthResponse {
	message?: string;
	error?: string;
}

function isStrongPassword(password: string): boolean {
	return (
		password.length >= 8 &&
		/[A-Z]/.test(password) &&
		/[a-z]/.test(password) &&
		/\d/.test(password) &&
		/[^A-Za-z0-9]/.test(password)
	);
}

async function readAuthResponse(res: Response): Promise<AuthResponse> {
	const contentType = res.headers.get("content-type") ?? "";
	if (contentType.includes("application/json")) {
		return res.json() as Promise<AuthResponse>;
	}

	const text = await res.text();
	return {
		error: text.trim()
			? `Unexpected server response (${res.status}).`
			: `Authentication service returned ${res.status}.`,
	};
}

export function Login() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const { refetch } = useAuth();
	const [isLogin, setIsLogin] = useState(searchParams.get("mode") !== "signup");
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const emplIdRef = useRef<HTMLInputElement>(null);
	const firstNameRef = useRef<HTMLInputElement>(null);
	const lastNameRef = useRef<HTMLInputElement>(null);
	const emailRef = useRef<HTMLInputElement>(null);
	const passwordRef = useRef<HTMLInputElement>(null);
	const confirmPasswordRef = useRef<HTMLInputElement>(null);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError(null);
		const email = emailRef.current?.value ?? "";
		const password = passwordRef.current?.value ?? "";

		if (!email.endsWith("@login.cuny.edu")) {
			setError("Only @login.cuny.edu email addresses are allowed.");
			return;
		}

		if (!isLogin) {
			const confirmPassword = confirmPasswordRef.current?.value ?? "";
			if (!isStrongPassword(password)) {
				setError(
					"Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
				);
				return;
			}
			if (password !== confirmPassword) {
				setError("Passwords do not match.");
				return;
			}
		}

		setIsSubmitting(true);
		try {
			const endpoint = isLogin
				? `${API_BASE}/api/users/login`
				: `${API_BASE}/api/users/register`;
			const body: Record<string, string> = { email, password };
			if (!isLogin) {
				body.emplid = emplIdRef.current?.value ?? "";
				body.first_name = firstNameRef.current?.value ?? "";
				body.last_name = lastNameRef.current?.value ?? "";
			}

			const res = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify(body),
			});

			const data = await readAuthResponse(res);

			if (res.ok) {
				await refetch();
				navigate("/dashboard");
			} else {
				setError(data.error ?? data.message ?? "Authentication failed.");
			}
		} catch (err) {
			console.error("Authentication request failed:", err);
			setError("Service unavailable — please try again later.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const toggleMode = () => {
		setIsLogin((prev) => !prev);
		setError(null);
		setShowPassword(false);
		setShowConfirmPassword(false);
		if (emplIdRef.current) emplIdRef.current.value = "";
		if (firstNameRef.current) firstNameRef.current.value = "";
		if (lastNameRef.current) lastNameRef.current.value = "";
		if (emailRef.current) emailRef.current.value = "";
		if (passwordRef.current) passwordRef.current.value = "";
		if (confirmPasswordRef.current) confirmPasswordRef.current.value = "";
	};

	return (
		<div className="min-h-screen flex flex-col bg-gray-50">
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
					<button
						onClick={() => navigate("/")}
						className="cursor-pointer text-left group"
					>
						<div
							className="font-black text-[#582C83] leading-none uppercase group-hover:opacity-80 transition-opacity"
							style={{ fontSize: "26px", letterSpacing: "-0.01em" }}
						>
							HUNTER
						</div>
						<div className="text-[#582C83] text-[9px] tracking-[0.18em] font-bold uppercase leading-tight mt-0.5 opacity-70">
							The City University of New York
						</div>
					</button>
					<button
						onClick={() => navigate("/")}
						className="flex items-center gap-1.5 text-sm text-[#582C83] hover:opacity-70 transition-opacity font-semibold"
					>
						<ArrowLeft className="size-4" />
						Back
					</button>
				</div>
			</header>

			{/* ── Page content ────────────────────────────────────────── */}
			<main className="flex-1 flex items-start justify-center pt-12 pb-16 px-4">
				<div className="w-full max-w-md">
					{/* Card top accent */}
					<div className="h-1 bg-[#582C83] rounded-t" />

					<div className="bg-white border border-gray-200 border-t-0 shadow-sm rounded-b p-8">
						{/* Heading */}
						<div className="mb-6">
							<h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">
								{isLogin ? "Sign In" : "Create Account"}
							</h1>
							<p className="text-sm text-gray-500 mt-1">
								{isLogin
									? "Enter your credentials to access your schedule planner"
									: "Sign up to start building your personalized schedule"}
							</p>
						</div>

						<form onSubmit={handleSubmit} className="space-y-4">
							{error && (
								<p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-4 py-2">
									{error}
								</p>
							)}

							{!isLogin && (
								<>
									<div className="space-y-1.5">
										<Label
											htmlFor="emplid"
											className="text-xs font-bold uppercase tracking-wide text-gray-600"
										>
											Student ID (EMPLID)
										</Label>
										<Input
											id="emplid"
											ref={emplIdRef}
											type="text"
											inputMode="numeric"
											pattern="\d*"
											placeholder="12345678"
											required
											className="h-10 text-sm border-gray-300 focus:border-[#582C83] focus:ring-[#582C83]"
										/>
									</div>
									<div className="space-y-1.5">
										<Label
											htmlFor="first_name"
											className="text-xs font-bold uppercase tracking-wide text-gray-600"
										>
											First Name
										</Label>
										<Input
											id="first_name"
											ref={firstNameRef}
											type="text"
											placeholder="John"
											required
											className="h-10 text-sm border-gray-300 focus:border-[#582C83] focus:ring-[#582C83]"
										/>
									</div>
									<div className="space-y-1.5">
										<Label
											htmlFor="last_name"
											className="text-xs font-bold uppercase tracking-wide text-gray-600"
										>
											Last Name
										</Label>
										<Input
											id="last_name"
											ref={lastNameRef}
											type="text"
											placeholder="Doe"
											required
											className="h-10 text-sm border-gray-300 focus:border-[#582C83] focus:ring-[#582C83]"
										/>
									</div>
								</>
							)}

							<div className="space-y-1.5">
								<Label
									htmlFor="email"
									className="text-xs font-bold uppercase tracking-wide text-gray-600"
								>
									Email
								</Label>
								<Input
									id="email"
									ref={emailRef}
									type="email"
									placeholder="firstname.lastnameXX@login.cuny.edu"
									required
									className="h-10 text-sm border-gray-300 focus:border-[#582C83] focus:ring-[#582C83]"
								/>
							</div>

							<div className="space-y-1.5">
								<Label
									htmlFor="password"
									className="text-xs font-bold uppercase tracking-wide text-gray-600"
								>
									Password
								</Label>
								<div className="relative">
									<Input
										id="password"
										ref={passwordRef}
										type={showPassword ? "text" : "password"}
										required
										className="h-10 text-sm pr-10 border-gray-300 focus:border-[#582C83] focus:ring-[#582C83]"
									/>
									<button
										type="button"
										onClick={() => setShowPassword((prev) => !prev)}
										className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
									>
										{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
									</button>
								</div>
							</div>

							{!isLogin && (
								<div className="space-y-1.5">
									<Label
										htmlFor="confirm-password"
										className="text-xs font-bold uppercase tracking-wide text-gray-600"
									>
										Confirm Password
									</Label>
									<div className="relative">
										<Input
											id="confirm-password"
											ref={confirmPasswordRef}
											type={showConfirmPassword ? "text" : "password"}
											required
											className="h-10 text-sm pr-10 border-gray-300 focus:border-[#582C83] focus:ring-[#582C83]"
										/>
										<button
											type="button"
											onClick={() => setShowConfirmPassword((prev) => !prev)}
											className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
										>
											{showConfirmPassword ? (
												<EyeOff size={16} />
											) : (
												<Eye size={16} />
											)}
										</button>
									</div>
								</div>
							)}

							<Button
								type="submit"
								disabled={isSubmitting}
								className="w-full bg-[#582C83] hover:bg-[#4a2270] text-white h-10 text-sm font-bold uppercase tracking-wide disabled:opacity-60 mt-2"
							>
								{isSubmitting
									? "Please wait…"
									: isLogin
										? "Sign In"
										: "Create Account"}
							</Button>
						</form>

						<div className="mt-5 pt-5 border-t border-gray-100 text-center">
							<button
								type="button"
								onClick={toggleMode}
								className="text-sm text-[#582C83] hover:underline font-semibold"
							>
								{isLogin
									? "Don't have an account? Sign up"
									: "Already have an account? Sign in"}
							</button>
						</div>
					</div>

					<p className="mt-6 text-xs text-gray-400 text-center px-4">
						Hunter College Smart Schedule Builder · Not an official CUNY product
					</p>
				</div>
			</main>
		</div>
	);
}
