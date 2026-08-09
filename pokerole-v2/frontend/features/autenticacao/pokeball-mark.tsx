export function PokeballMark({
  className = "",
}: {
  className?: string;
  /** @deprecated mantido por compat — gradientes fixos da pokébola clássica */
  gradientId?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      {/* metade inferior branca */}
      <path
        d="M16 30c7.732 0 14-6.268 14-14H2c0 7.732 6.268 14 14 14Z"
        fill="#F5F5F5"
      />
      {/* metade superior vermelha */}
      <path
        d="M16 2C8.268 2 2 8.268 2 16h28C30 8.268 23.732 2 16 2Z"
        fill="#E3350D"
      />
      {/* faixa preta */}
      <rect x="2" y="14.5" width="28" height="3" fill="#1A1A1A" />
      {/* botão central */}
      <circle cx="16" cy="16" r="5.5" fill="#1A1A1A" />
      <circle cx="16" cy="16" r="3.25" fill="#F5F5F5" />
      <circle cx="16" cy="16" r="1.35" fill="#E8E8E8" />
    </svg>
  );
}
