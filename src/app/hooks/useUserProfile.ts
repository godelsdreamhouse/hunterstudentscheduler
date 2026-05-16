import { useAuth } from "../context/AuthContext";

interface UserProfile {
  email: string;
  name: string;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

export function useUserProfile(): UserProfile {
  const { email, name, isLoading, refetch } = useAuth();
  return { email, name, isLoading, refetch };
}
