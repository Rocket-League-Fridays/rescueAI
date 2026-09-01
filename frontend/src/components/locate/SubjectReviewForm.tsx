"use client";

import { FieldRow, Panel, inputClass } from "@/components/ui";
import { fieldOrigin, type IncidentOverrides, type OverridableField } from "@/lib/incident-overrides";
import type { IncidentDetail } from "@/types/incident";

interface SubjectReviewFormProps {
  incident: IncidentDetail;
  overrides: IncidentOverrides;
  onChange(next: IncidentOverrides): void;
}

/**
 * Review layer over `KeywordTranscriptExtractor` output. Operator edits are held client-side —
 * the backend has no incident PATCH yet (see `docs/context/07-frontend-data-map.md`), so every
 * field shows whether it is still the extractor's value or the operator's.
 */
export function SubjectReviewFields({ incident, overrides, onChange }: SubjectReviewFormProps) {
  function set<K extends OverridableField>(field: K, value: IncidentOverrides[K]) {
    onChange({ ...overrides, [field]: value });
  }

  function revert(field: OverridableField) {
    const next = { ...overrides };
    delete next[field];
    onChange(next);
  }

  return (
      <div className="space-y-3">
        <FieldRow
          label="Display name"
          origin={fieldOrigin(overrides, "displayName")}
          onRevert={() => revert("displayName")}
        >
          <input
            value={incident.subject.displayName}
            onChange={(event) => set("displayName", event.target.value)}
            className={inputClass}
          />
        </FieldRow>

        <FieldRow
          label="Clothing colors"
          origin={fieldOrigin(overrides, "clothingColors")}
          onRevert={() => revert("clothingColors")}
        >
          <input
            value={incident.subject.clothingColors.join(", ")}
            placeholder="red, black"
            onChange={(event) => set("clothingColors", parseColors(event.target.value))}
            className={inputClass}
          />
          <p className="text-[12px] leading-relaxed text-ink-500">
            Comma separated. Drives the CV clothing-match score.
          </p>
        </FieldRow>

        <FieldRow
          label="Notes"
          origin={fieldOrigin(overrides, "notes")}
          onRevert={() => revert("notes")}
        >
          <textarea
            value={incident.subject.notes}
            rows={4}
            onChange={(event) => set("notes", event.target.value)}
            className={`${inputClass} resize-y`}
          />
        </FieldRow>

        <FieldRow
          label="Corridor buffer"
          origin={fieldOrigin(overrides, "corridorBufferMeters")}
          onRevert={() => revert("corridorBufferMeters")}
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={10}
              max={1000}
              step={10}
              value={incident.corridorBufferMeters}
              onChange={(event) => set("corridorBufferMeters", Number(event.target.value))}
              className={`${inputClass} w-28 font-mono text-xs`}
            />
            <span className="font-mono text-[11px] uppercase tracking-label text-ink-500">
              meters either side of {incident.trailName || "the trail"}
            </span>
          </div>
        </FieldRow>
      </div>
  );
}

export function SubjectReviewForm({ incident, overrides, onChange }: SubjectReviewFormProps) {
  return (
    <Panel title="Subject & corridor" subtitle="Extracted from the transcript — review and correct">
      <SubjectReviewFields incident={incident} overrides={overrides} onChange={onChange} />
    </Panel>
  );
}

function parseColors(value: string): string[] {
  return value
    .split(",")
    .map((color) => color.trim().toLowerCase())
    .filter((color) => color.length > 0);
}
