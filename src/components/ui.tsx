import Link from "next/link";
import { CITIES } from "@/lib/geo";
import { CARGO_TYPES, TRUCK_TYPES } from "@/lib/constants";

// Road Line status colours: open = signal blue, waiting = lane yellow, booked = asphalt, done = go green.
const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-[#e6eeff] text-[#1f4fd0] ring-[#c9d8ff]",
  PENDING: "bg-brand-50 text-brand-700 ring-brand-100",
  ACCEPTED: "bg-asphalt text-lane ring-asphalt",
  MATCHED: "bg-asphalt text-lane ring-asphalt",
  BOOKED: "bg-asphalt text-lane ring-asphalt",
  IN_TRANSIT: "bg-[#e6eeff] text-[#1f4fd0] ring-[#c9d8ff]",
  DELIVERED: "bg-[#e5f4ec] text-[#0c5e34] ring-[#bfe3cf]",
  COMPLETED: "bg-[#e5f4ec] text-[#0c5e34] ring-[#bfe3cf]",
  DECLINED: "bg-slate-100 text-slate-600 ring-slate-200",
  CANCELLED: "bg-red-50 text-red-700 ring-red-200",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700 ring-slate-200"
      }`}
    >
      {status.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
}

export function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "brand" | "amber" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-[#e5f4ec] text-[#0c5e34]",
    brand: "bg-brand-50 text-brand-700",
    amber: "bg-[#fff3cc] text-[#6b5200]",
  };
  return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? <Pill tone="green">✓ Verified</Pill> : <Pill tone="amber">Unverified</Pill>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ children, href, cta }: { children: React.ReactNode; href?: string; cta?: string }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center text-sm text-slate-600">
      <p>{children}</p>
      {href && cta && (
        <Link href={href} className="btn-primary">
          {cta}
        </Link>
      )}
    </div>
  );
}

export function Route({ from, to }: { from: string; to: string }) {
  return (
    <span className="font-semibold">
      {from} <span className="text-brand-700" aria-hidden="true">→</span>
      <span className="sr-only"> to </span> {to}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-display text-2xl font-extrabold tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

const REGIONS = [...new Set(CITIES.map((c) => c.region))];

export function CitySelect({ name, defaultValue, required = true }: { name: string; defaultValue?: string; required?: boolean }) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} required={required}>
      <option value="" disabled>
        Select city…
      </option>
      {REGIONS.map((r) => (
        <optgroup key={r} label={r}>
          {CITIES.filter((c) => c.region === r).map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({c.province})
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function TruckTypeSelect({ name, allowAny, defaultValue }: { name: string; allowAny?: boolean; defaultValue?: string }) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} required={!allowAny}>
      {allowAny ? <option value="">Any suitable truck</option> : <option value="" disabled>Select type…</option>}
      {Object.entries(TRUCK_TYPES).map(([k, v]) => (
        <option key={k} value={k}>
          {v.label} (up to {v.maxTons} t)
        </option>
      ))}
    </select>
  );
}

export function CargoTypeSelect({ name }: { name: string }) {
  return (
    <select name={name} defaultValue="GENERAL" required>
      {Object.entries(CARGO_TYPES).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  );
}

/** Match quality 0–100 as a square badge: green from 75, lane-yellow tint from 50, grey below. */
export function ScoreRing({ score }: { score: number }) {
  const tone = score >= 75 ? "bg-go text-white" : score >= 50 ? "bg-[#fff3cc] text-[#6b5200]" : "bg-slate-100 text-slate-600";
  return (
    <div
      className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg ${tone}`}
      aria-label={`Fit score ${score} out of 100`}
      role="img"
    >
      <span className="font-display text-base leading-none font-extrabold">{score}</span>
      <span className="text-[9px] leading-none font-bold uppercase opacity-80">fit</span>
    </div>
  );
}

/** Small line icons in the brand's stroke style (decorative; the text beside them carries the meaning). */
export function Icon({ name, className = "" }: { name: "gift" | "lock" | "menu" | "close"; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    gift: (
      <>
        <rect x="3" y="8" width="18" height="4" rx="1" />
        <path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
        <path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </>
    ),
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="M6 6l12 12M18 6L6 18" />,
  };
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`inline-block shrink-0 align-[-3px] ${className}`}
    >
      {paths[name]}
    </svg>
  );
}
