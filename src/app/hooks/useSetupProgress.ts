import { useState } from "react";

const STORAGE_KEY = "watchtower_setup_progress";

interface SetupProgress {
  preferencesSet: boolean;
  auditUploaded: boolean;
  semester?: string;
}

function readProgress(): SetupProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SetupProgress;
  } catch {}
  return { preferencesSet: false, auditUploaded: false };
}

function writeProgress(progress: SetupProgress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function updateProgress(patch: Partial<SetupProgress>): SetupProgress {
  const next = { ...readProgress(), ...patch };
  writeProgress(next);
  return next;
}

// TODO: replace localStorage with an API call to fetch setup progress from the backend
// so that state reflects the real server-side status (e.g. after upload on another device)
export function useSetupProgress() {
  const [progress, setProgress] = useState<SetupProgress>(readProgress);

  const markPreferencesSet = (semester: string) => {
    const next = updateProgress({ preferencesSet: true, semester });
    setProgress(next);
  };

  const markAuditUploaded = () => {
    const next = updateProgress({ auditUploaded: true });
    setProgress(next);
  };

  const resetAuditUploaded = () => {
    const next = updateProgress({ auditUploaded: false });
    setProgress(next);
  };

  const resetPreferences = () => {
    const next = updateProgress({ preferencesSet: false, semester: undefined });
    setProgress(next);
  };

  return { progress, markPreferencesSet, markAuditUploaded, resetAuditUploaded, resetPreferences };
}
