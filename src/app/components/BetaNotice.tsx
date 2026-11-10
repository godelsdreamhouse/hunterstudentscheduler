interface BetaNoticeProps {
  className?: string;
}

export function BetaNotice({ className }: BetaNoticeProps) {
  return (
    <div className={className} role="note">
      <strong>Student beta</strong>
      <span>Satisfi is a planning aid. Confirm enrollment and degree requirements in CUNYfirst or with an advisor.</span>
    </div>
  );
}
