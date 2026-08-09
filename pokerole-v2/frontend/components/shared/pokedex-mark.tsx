export function PokedexMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="4"
        y="3"
        width="24"
        height="26"
        rx="4"
        className="fill-red-500 dark:fill-red-500"
      />
      <rect x="6.5" y="5.5" width="19" height="9" rx="2" fill="#0a0c12" />
      <circle cx="16" cy="10" r="2.5" fill="#22d3ee" />
      <circle cx="16" cy="10" r="1.2" fill="#ecfeff" />
      <rect x="8" y="17" width="10" height="2" rx="1" fill="#fef2f2" opacity="0.9" />
      <rect x="8" y="21" width="16" height="2" rx="1" fill="#fef2f2" opacity="0.55" />
      <rect x="8" y="25" width="12" height="2" rx="1" fill="#fef2f2" opacity="0.35" />
    </svg>
  );
}
