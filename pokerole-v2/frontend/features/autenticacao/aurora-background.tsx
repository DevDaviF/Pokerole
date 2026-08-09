import type { CSSProperties } from "react";

const PARTICLES = [
  { left: "8%", size: 3, duration: 19, delay: 0, drift: "30px", opacity: 0.5 },
  { left: "18%", size: 2, duration: 24, delay: 6, drift: "-20px", opacity: 0.4 },
  { left: "27%", size: 4, duration: 16, delay: 2, drift: "40px", opacity: 0.6 },
  { left: "39%", size: 2, duration: 27, delay: 9, drift: "-30px", opacity: 0.35 },
  { left: "48%", size: 3, duration: 21, delay: 4, drift: "25px", opacity: 0.5 },
  { left: "58%", size: 2, duration: 25, delay: 12, drift: "-15px", opacity: 0.4 },
  { left: "67%", size: 4, duration: 18, delay: 1, drift: "35px", opacity: 0.55 },
  { left: "76%", size: 3, duration: 23, delay: 7, drift: "-40px", opacity: 0.45 },
  { left: "85%", size: 2, duration: 28, delay: 3, drift: "20px", opacity: 0.4 },
  { left: "93%", size: 3, duration: 20, delay: 10, drift: "-25px", opacity: 0.5 },
];

export function AuroraBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_-10%,oklch(0.93_0.02_85)_0%,var(--background)_55%,oklch(0.96_0.01_275)_100%)] dark:bg-[radial-gradient(120%_120%_at_50%_-10%,oklch(0.24_0.05_285)_0%,var(--background)_55%,oklch(0.12_0.03_280)_100%)]" />

      <div className="animate-aurora absolute -left-[10%] top-[-15%] h-[65vh] w-[65vh] rounded-full bg-primary/20 blur-[120px] dark:bg-primary/30" />
      <div className="animate-aurora-slow absolute top-[10%] right-[-12%] h-[70vh] w-[70vh] rounded-full bg-accent/25 blur-[130px] dark:bg-accent/20" />
      <div className="animate-aurora absolute bottom-[-25%] left-[35%] h-[60vh] w-[60vh] rounded-full bg-[oklch(0.75_0.08_280)]/20 blur-[140px] dark:bg-[oklch(0.45_0.12_280)]/25" />

      <svg
        className="animate-spin-slow absolute -right-24 top-1/2 h-[520px] w-[520px] -translate-y-1/2 text-foreground/[0.05]"
        viewBox="0 0 200 200"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      >
        <circle cx="100" cy="100" r="88" />
        <circle cx="100" cy="100" r="70" strokeDasharray="4 6" />
        <line x1="12" y1="100" x2="66" y2="100" />
        <line x1="134" y1="100" x2="188" y2="100" />
        <circle cx="100" cy="100" r="26" />
        <circle cx="100" cy="100" r="14" />
      </svg>

      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="animate-float-up absolute bottom-[-10px] rounded-full bg-accent"
          style={
            {
              left: p.left,
              width: `${p.size}px`,
              height: `${p.size}px`,
              "--dot-duration": `${p.duration}s`,
              "--dot-drift": p.drift,
              "--dot-opacity": p.opacity,
              animationDelay: `-${p.delay}s`,
              boxShadow: "0 0 8px 1px currentColor",
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
