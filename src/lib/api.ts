// Central API base URL. Override in production via VITE_API_URL environment variable.
// TODO: hardcoded - replace with env variable only; remove localhost fallback for production
export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
