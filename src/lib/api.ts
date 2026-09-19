// Production defaults to same-origin paths. CloudFront routes API requests.
export const API_BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:3001" : "");
// Empty string = relative path, resolved via Vite proxy in dev. Set VITE_PARSER_URL in production.
export const PARSER_BASE = import.meta.env.VITE_PARSER_URL ?? "";
// Empty string = relative path, resolved via Vite proxy in dev. Set VITE_SCHEDULER_URL in production.
export const SCHEDULER_BASE = import.meta.env.VITE_SCHEDULER_URL ?? "";
