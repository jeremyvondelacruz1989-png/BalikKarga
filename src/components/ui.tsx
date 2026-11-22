import Link from "next/link";
import { CITIES } from "@/lib/geo";
import { CARGO_TYPES, TRUCK_TYPES } from "@/lib/constants";

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700 ring-blue-200",
  PENDING: "bg-amber-50 text-amber-800 ring-amber-200",
  ACCEPTED: "bg-violet-50 text-violet-700 ring-violet-200",
  MATCHED: "bg-violet-50 text-violet-700 ring-violet-200",
  BOOKED: "bg-violet-50 text-violet-700 ring-violet-200",
  IN_TRANSIT: "bg-sky-50 text-sky-700 ring-sky-200",
  DELIVERED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  DECLINED: "bg-slate-100 text-slate-600 ring-slate-200",
  CANCELLED: "bg-red-50 text-red-700 ring-red-200",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
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
    green: "bg-emerald-50 text-emerald-700",
    brand: "bg-brand-50 text-brand-700",
    amber: "bg-amber-50 text-amber-800",
  };
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? <Pill tone="green">✓ Verified</Pill> : <Pill tone="amber">Unverified</Pill>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
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
      {from} <span className="text-brand-600">→</span> {to}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
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

export function ScoreRing({ score }: { score: number }) {
  const tone = score >= 75 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-slate-500";
  return (
    <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full border-2 border-current ${tone}`}>
      <span className="text-sm font-bold leading-none">{score}</span>
      <span className="text-[9px] font-semibold uppercase leading-none">fit</span>
    </div>
  );
}
