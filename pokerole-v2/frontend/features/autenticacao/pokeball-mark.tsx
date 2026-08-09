export function PokeballMark({
  className = "",
  gradientId = "pkTop",
}: {
  className?: string;
  gradientId?: string;
}) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.7 0.2 25)" />
          <stop offset="100%" stopColor="oklch(0.55 0.24 22)" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="oklch(0.97 0.01 275)" />
      <path d="M2 24a22 22 0 0 1 44 0Z" fill={`url(#${gradientId})`} />
      <rect x="2" y="22" width="44" height="4" fill="oklch(0.17 0.035 275)" />
      <circle cx="24" cy="24" r="7.5" fill="oklch(0.17 0.035 275)" />
      <circle cx="24" cy="24" r="4.5" fill="oklch(0.97 0.01 275)" />
      <circle cx="24" cy="24" r="2" fill="oklch(0.82 0.15 85)" />
    </svg>
  );
}
