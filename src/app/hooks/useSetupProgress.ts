import { useState } from "react";

const STORAGE_KEY = "watchtower_setup_progress";

interface SetupProgress {
  preferencesSet: boolean;
  auditUploaded: boolean;
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

export function useSetupProgress() {
  const [progress, setProgress] = useState<SetupProgress>(readProgress);

  const markPreferencesSet = () => {
    const next = { ...progress, preferencesSet: true };
    writeProgress(next);
    setProgress(next);
  };

  const markAuditUploaded = () => {
    const next = { ...progress, auditUploaded: true };
    writeProgress(next);
    setProgress(next);
  };

  return { progress, markPreferencesSet, markAuditUploaded };
}
