import { useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import backgroundImg from "../../assets/campus-background.png";
import logoImg from "../../assets/watchtower-logo.svg";
import { API_BASE } from "../../lib/api";
import { useAuth } from "../context/AuthContext";

export function Login() {
  const navigate = useNavigate();
  const { refetch } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    try {
      const endpoint = isLogin
        ? `${API_BASE}/api/users/login`
        : `${API_BASE}/api/users/register`;
      const body: Record<string, string> = { email, password };
      if (!isLogin) {
        body.name = email.split("@")[0];
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json() as { message?: string; error?: string };

      if (res.ok) {
        await refetch();
        navigate("/dashboard");
      } else {
        setError(data.error ?? data.message ?? "Authentication failed.");
      }
    } catch {
      // TODO: hardcoded - replace port 3001 in error message with value derived from API_BASE config
      setError("Cannot connect to server. Make sure the backend is running on port 3001.");
    }
  };

  const toggleMode = () => {
    setIsLogin((prev) => !prev);
    setError(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative"
      style={{
        backgroundImage: `url(${backgroundImg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-white/70" />

      <div className="relative mb-10 text-center">
        <div className="flex items-center justify-center gap-4 mb-4">
          <img src={logoImg} alt="Watchtower Logo" className="h-24 w-auto" />
        </div>
        <p className="text-xl text-gray-700 font-medium">Smart Schedule Builder for Hunter College</p>
      </div>

      <Card className="relative w-full max-w-3xl bg-white/90 backdrop-blur-sm shadow-2xl">
        <CardHeader className="p-10">
          <CardTitle className="text-3xl text-center">
            {isLogin ? "Sign In" : "Create Account"}
          </CardTitle>
          <CardDescription className="text-lg text-center pt-3">
            {isLogin
              ? "Enter your credentials to access your schedule planner"
              : "Sign up to start building your personalized schedule"}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-10 pb-10">
          <form onSubmit={handleSubmit} className="space-y-7">
            {error && (
              <p className="text-base text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-center">
                {error}
              </p>
            )}
            <div className="space-y-3">
              <Label htmlFor="email" className="text-base font-semibold">Email</Label>
              <Input
                id="email"
                ref={emailRef}
                type="email"
                placeholder="firstname.lastnameXX@login.cuny.edu"
                required
                className="h-16 text-lg"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="password" className="text-base font-semibold">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  ref={passwordRef}
                  type={showPassword ? "text" : "password"}
                  required
                  className="h-16 text-lg pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            {!isLogin && (
              <div className="space-y-3">
                <Label htmlFor="confirm-password" className="text-base font-semibold">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    ref={confirmPasswordRef}
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    className="h-16 text-lg pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            )}
            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 h-14 text-lg font-semibold"
            >
              {isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-base text-indigo-600 hover:underline font-medium"
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>

      <p className="relative mt-8 text-base text-gray-700 text-center max-w-xl font-medium">
        Like a wise hawk guiding you on an optimized and personalized graduation path
      </p>
    </div>
  );
}
