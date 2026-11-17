export function Mark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <g className="fill-accent-fg">
        <rect x="9" y="8" width="4" height="16" />
        <rect x="9" y="8" width="14" height="3.5" />
        <rect x="9" y="14.5" width="10" height="3.5" />
      </g>
    </svg>
  );
}
