import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { API_BASE } from "../../lib/api";

interface AuthState {
  email: string;
  name: string;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface ProfileResponse {
  email?: string;
  name?: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    email: "",
    name: "",
    isLoading: true,
    isAuthenticated: false,
  });

  const fetchProfile = () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    return fetch(`${API_BASE}/api/users/profile`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json() as Promise<ProfileResponse>;
      })
      .then((data) => {
        setState({
          email: data.email ?? "",
          name: data.name ?? "",
          isLoading: false,
          isAuthenticated: true,
        });
      })
      .catch(() => {
        setState({ email: "", name: "", isLoading: false, isAuthenticated: false });
      });
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, refetch: fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
