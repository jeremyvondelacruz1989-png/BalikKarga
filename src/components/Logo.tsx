/**
 * BalikKarga brand mark (Road Line): a U-turn lane in road-marking yellow on asphalt,
 * with a white centre-line tick. Keep these paths in sync with src/app/icon.svg and
 * public/favicon.svg.
 */
export function LogoMark({ size = 32, title, onDark = false }: { size?: number; title?: string; onDark?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className="shrink-0"
    >
      <rect width="64" height="64" rx="12" fill={onDark ? "#2A2D33" : "#14161A"} />
      <path d="M22 50 V28 a10 10 0 0 1 20 0 V42" stroke="#FFC400" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M35 37 L42 45 L49 37" stroke="#FFC400" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 14 V18" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Mark plus wordmark. `tone="dark"` sets the wordmark in white for the asphalt header. */
export function Logo({ tone = "light", size = 32 }: { tone?: "light" | "dark"; size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} onDark={tone === "dark"} />
      <span
        className={`font-display text-[19px] leading-none font-extrabold tracking-[-0.02em] ${
          tone === "dark" ? "text-white" : "text-ink"
        }`}
      >
        BALIKKARGA
      </span>
    </span>
  );
}
