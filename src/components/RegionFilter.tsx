import { CITIES } from "@/lib/geo";

const REGIONS = [...new Set(CITIES.map((c) => c.region))];

export function RegionFilter({ from, to, fromLabel, toLabel }: { from?: string; to?: string; fromLabel: string; toLabel: string }) {
  return (
    <form className="card mb-4 flex flex-wrap items-end gap-3 p-4" method="get">
      <div className="min-w-44 flex-1">
        <label>{fromLabel}</label>
        <select name="from" defaultValue={from ?? ""}>
          <option value="">Any region</option>
          {REGIONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      <div className="min-w-44 flex-1">
        <label>{toLabel}</label>
        <select name="to" defaultValue={to ?? ""}>
          <option value="">Any region</option>
          {REGIONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      <button className="btn-secondary">Filter</button>
    </form>
  );
}

export function citiesIn(region?: string): string[] | undefined {
  return region ? CITIES.filter((c) => c.region === region).map((c) => c.name) : undefined;
}
