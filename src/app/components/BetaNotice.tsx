interface BetaNoticeProps {
  className?: string;
}

export function BetaNotice({ className }: BetaNoticeProps) {
  return (
    <div className={className} role="note">
      <strong>Student beta</strong>
      <span>Satisfi is a planning aid. Enrollment and waitlist counts are periodic snapshots; confirm current availability and degree requirements in CUNYfirst or with an advisor.</span>
    </div>
  );
}
