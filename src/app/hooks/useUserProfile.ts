import { useAuth } from "../context/AuthContext";

interface UserProfile {
  email: string;
  name: string;
  emplid: number;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

export function useUserProfile(): UserProfile {
  const { email, name, emplid, isLoading, refetch } = useAuth();
  return { email, name, emplid, isLoading, refetch };
}
