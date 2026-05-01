import { useAuth } from "../context/AuthContext";

interface UserProfile {
  email: string;
  name: string;
  isLoading: boolean;
}

export function useUserProfile(): UserProfile {
  const { email, name, isLoading } = useAuth();
  return { email, name, isLoading };
}
