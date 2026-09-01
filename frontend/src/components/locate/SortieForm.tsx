"use client";

import { FormEvent, useRef, useState } from "react";

import { buttonSecondary, Panel } from "@/components/ui";

interface SortieFormProps {
  isLoading: boolean;
  disabled: boolean;
  onAttach(video: File | undefined): void;
  onRefresh(): void;
}

/**
 * Feeds the scan. Pre-recorded Mini 4K footage, either uploaded here or dropped into
 * `backend/data/inbox/` — there is no live downlink in this build.
 */
export function SortieForm({ isLoading, disabled, onAttach, onRefresh }: SortieFormProps) {
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [hasFootage, setHasFootage] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const video = videoInputRef.current?.files?.[0];
    if (!video) {
      return;
    }
    onAttach(video);
  }

  return (
    <Panel title="Attach Mini 4K sortie" subtitle="Recorded footage the scan runs against">
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          onChange={() => setHasFootage((videoInputRef.current?.files?.length ?? 0) > 0)}
          className="block w-full text-xs text-ink-200 file:mr-3 file:rounded file:border-0 file:bg-surface-hover file:px-2 file:py-1 file:text-ink-100"
        />
        <button
          type="submit"
          disabled={isLoading || disabled || !hasFootage}
          className={`${buttonSecondary} w-full`}
        >
          Run scan on footage
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={disabled}
          className="w-full text-xs font-semibold uppercase tracking-label text-ink-500 transition-colors hover:text-ink-200 disabled:opacity-40"
        >
          Refresh after inbox drop
        </button>
      </form>
    </Panel>
  );
}
