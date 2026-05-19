import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { API_BASE } from "../../lib/api";
import { setActiveUserStorageId } from "../utils/userScopedStorage";

interface AuthState {
  email: string;
  name: string;
  emplid: number;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface ProfileResponse {
  email?: string;
  first_name?: string;
  last_name?: string;
  emplid?: number;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    email: "",
    name: "",
    emplid: 0,
    isLoading: true,
    isAuthenticated: false,
  });

  const fetchProfile = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: true }));
    return fetch(`${API_BASE}/api/users/profile`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json() as Promise<ProfileResponse>;
      })
      .then((data) => {
        setActiveUserStorageId(data.emplid);
        setState({
          email: data.email ?? "",
          name: `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim(),
          emplid: data.emplid ?? 0,
          isLoading: false,
          isAuthenticated: true,
        });
      })
      .catch(() => {
        setActiveUserStorageId(null);
        setState({ email: "", name: "", emplid: 0, isLoading: false, isAuthenticated: false });
      });
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

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
