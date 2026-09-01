"use client";

import { buttonPrimary, inputClass, Panel } from "@/components/ui";
import type { SearchParameters } from "@/presenter/LocatePresenter";
import { SEARCH_PATTERN_LABELS, type SearchPatternKind } from "@/types/search";

const PATTERNS: SearchPatternKind[] = ["corridor_sweep", "expanding_box", "parallel_track"];

interface SearchParamsFormProps {
  parameters: SearchParameters;
  isPlanning: boolean;
  disabled: boolean;
  onChange(next: SearchParameters): void;
  onPlan(): void;
}

/** The request the search planner is called with. Mirrors `SearchPlanRequest` field for field. */
export function SearchParamsForm({
  parameters,
  isPlanning,
  disabled,
  onChange,
  onPlan,
}: SearchParamsFormProps) {
  return (
    <Panel title="Scan parameters" subtitle="Sent to the search planner as SearchPlanRequest">
      <div className="space-y-3">
        <div className="space-y-1">
          <label
            htmlFor="pattern"
            className="font-mono text-[11px] uppercase tracking-label text-ink-400"
          >
            Pattern
          </label>
          <select
            id="pattern"
            value={parameters.patternKind}
            onChange={(event) =>
              onChange({ ...parameters, patternKind: event.target.value as SearchPatternKind })
            }
            className={inputClass}
          >
            {PATTERNS.map((pattern) => (
              <option key={pattern} value={pattern}>
                {SEARCH_PATTERN_LABELS[pattern]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label
              htmlFor="altitude"
              className="font-mono text-[11px] uppercase tracking-label text-ink-400"
            >
              Altitude AGL
            </label>
            <div className="flex items-center gap-1">
              <input
                id="altitude"
                type="number"
                min={30}
                max={120}
                step={5}
                value={parameters.altitudeAglMeters}
                onChange={(event) =>
                  onChange({ ...parameters, altitudeAglMeters: Number(event.target.value) })
                }
                className={inputClass}
              />
              <span className="font-mono text-xs text-ink-500">m</span>
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="overlap"
              className="font-mono text-[11px] uppercase tracking-label text-ink-400"
            >
              Overlap
            </label>
            <div className="flex items-center gap-1">
              <input
                id="overlap"
                type="number"
                min={0}
                max={90}
                step={5}
                value={parameters.overlapPercent}
                onChange={(event) =>
                  onChange({ ...parameters, overlapPercent: Number(event.target.value) })
                }
                className={inputClass}
              />
              <span className="font-mono text-xs text-ink-500">%</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onPlan}
          disabled={disabled || isPlanning}
          className={`${buttonPrimary} w-full`}
        >
          {isPlanning ? "Planning…" : "Plan search route"}
        </button>
        <p className="text-[12px] leading-relaxed text-ink-500">
          Higher overlap means tighter transects and a longer flight.
        </p>
      </div>
    </Panel>
  );
}
