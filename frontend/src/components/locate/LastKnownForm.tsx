"use client";

import { useEffect, useState } from "react";

import { FieldRow, Panel, inputClass } from "@/components/ui";
import type { LastKnownSource } from "@/lib/incident-overrides";
import type { LastKnownPosition } from "@/types/search";
import type { GeoPoint } from "@/types/telemetry";

interface LastKnownFormProps {
  lastKnown: LastKnownPosition;
  source: LastKnownSource;
  onChange(position: LastKnownPosition): void;
  onRevert(): void;
}

/**
 * The approximate position the search is planned around. Two-way bound with the map pin: drag
 * the pin and these boxes follow; type here and the pin moves.
 */
export function LastKnownForm({ lastKnown, source, onChange, onRevert }: LastKnownFormProps) {
  const [latText, setLatText] = useState(lastKnown.point.lat.toFixed(5));
  const [lngText, setLngText] = useState(lastKnown.point.lng.toFixed(5));

  useEffect(() => {
    setLatText(lastKnown.point.lat.toFixed(5));
    setLngText(lastKnown.point.lng.toFixed(5));
  }, [lastKnown.point.lat, lastKnown.point.lng]);

  function commitCoordinates() {
    const point = parsePoint(latText, lngText);
    if (point) {
      onChange({ ...lastKnown, point });
    } else {
      setLatText(lastKnown.point.lat.toFixed(5));
      setLngText(lastKnown.point.lng.toFixed(5));
    }
  }

  return (
    <Panel
      title="Last known position"
      subtitle="Approximate — drag the map pin or type coordinates"
    >
      <div className="space-y-3">
        <FieldRow
          label="Coordinates"
          origin={source === "edited" ? "edited" : source === "assumed" ? "assumed" : "extracted"}
          onRevert={onRevert}
        >
          <div className="grid grid-cols-2 gap-2">
            <input
              value={latText}
              inputMode="decimal"
              onChange={(event) => setLatText(event.target.value)}
              onBlur={commitCoordinates}
              className={`${inputClass} font-mono text-xs`}
              aria-label="Latitude"
            />
            <input
              value={lngText}
              inputMode="decimal"
              onChange={(event) => setLngText(event.target.value)}
              onBlur={commitCoordinates}
              className={`${inputClass} font-mono text-xs`}
              aria-label="Longitude"
            />
          </div>
        </FieldRow>

        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <label
              htmlFor="last-known-radius"
              className="font-mono text-[11px] uppercase tracking-label text-ink-400"
            >
              Uncertainty radius
            </label>
            <span className="font-mono text-xs text-ink-100">
              {Math.round(lastKnown.radiusMeters)} m
            </span>
          </div>
          <input
            id="last-known-radius"
            type="range"
            min={50}
            max={1500}
            step={25}
            value={lastKnown.radiusMeters}
            onChange={(event) =>
              onChange({ ...lastKnown, radiusMeters: Number(event.target.value) })
            }
            className="w-full accent-accent-400"
          />
          <p className="text-[12px] leading-relaxed text-ink-500">
            Sets the area the search pattern has to cover.
          </p>
        </div>

        {source === "assumed" ? (
          <p className="rounded border border-line-soft bg-surface-sunken px-2 py-1.5 text-[12px] leading-relaxed text-ink-500">
            No position came from the transcript — the corridor midpoint is standing in. Correct it
            before planning.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

function parsePoint(latText: string, lngText: string): GeoPoint | null {
  const lat = Number(latText);
  const lng = Number(lngText);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { lat, lng };
}
