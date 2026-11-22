import type { MatchResult } from "@/lib/matching";
import { km, php } from "@/lib/format";

export function MatchFacts({ match }: { match: MatchResult }) {
  return (
    <div className="text-xs text-slate-600">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <span>Loaded {km(match.loadedKm)}</span>
        <span>+{km(match.detourKm)} detour</span>
        {match.roroCrossings > 0 && <span>RoRo crossing incl.</span>}
        <span>
          Suggested <b className="text-ink">{php(match.suggestedRate)}</b> (regular ≈ {php(match.marketRate)})
        </span>
      </div>
      <ul className="mt-1 list-inside list-disc text-slate-500">
        {match.reasons.slice(0, 3).map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  );
}
