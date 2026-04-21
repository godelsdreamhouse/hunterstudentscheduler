import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import backgroundImg from "../../assets/b3d452bf12523fa72eb64d2315103a37f4afe3ea.png";
import logoImg from "../../assets/9b3d587c8bb8091232b3d2c8640647d3ca857481.png";

export function Login() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/dashboard");
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4 relative"
      style={{
        backgroundImage: `url(${backgroundImg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="absolute inset-0 bg-white/70" />
      
      <div className="relative mb-1 text-center">
        <div className="flex items-center justify-center">
          <img src={logoImg} alt="Watchtower Logo" className="h-[352px] w-auto" />
        </div>
        <p className="text-gray-700">Smart Schedule Builder for Hunter College</p>
      </div>

      <Card className="relative w-full max-w-md bg-white/90 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>{isLogin ? "Sign In" : "Create Account"}</CardTitle>
          <CardDescription>
            {isLogin
              ? "Enter your credentials to access your schedule planner"
              : "Sign up to start building your personalized schedule"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="student@hunter.cuny.edu"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required />
            </div>
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input id="confirm-password" type="password" required />
              </div>
            )}
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700">
              {isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-indigo-600 hover:underline"
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>

      <p className="relative mt-6 text-sm text-gray-700 text-center max-w-md">
        Like a wise hawk guiding you on an optimized and personalized graduation path
      </p>
    </div>
  );
}