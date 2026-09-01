"use client";

import { FormEvent } from "react";

import { Panel, inputClass } from "@/components/ui";

interface TranscriptFormProps {
  transcript: string;
  isLoading: boolean;
  isOpened: boolean;
  onTranscriptChange(value: string): void;
  onOpenIncident(): void;
  onLoadFixtureTranscript(): void;
  onLoadMockSortie(): void;
}

export function TranscriptForm({
  transcript,
  isLoading,
  isOpened,
  onTranscriptChange,
  onOpenIncident,
  onLoadFixtureTranscript,
  onLoadMockSortie,
}: TranscriptFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onOpenIncident();
  }

  return (
    <Panel
      title="Distress intake"
      subtitle="Transcript in — the extractor pulls subject, clothing, and trail"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={transcript}
          onChange={(event) => onTranscriptChange(event.target.value)}
          rows={7}
          placeholder="Paste the 911 / Scout leader transcript"
          className={`${inputClass} resize-y`}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onLoadFixtureTranscript}
            className="flex-1 rounded border border-olive-600 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-olive-200 hover:border-olive-400"
          >
            Load Josh / Y fixture
          </button>
          <button
            type="submit"
            disabled={isLoading || !transcript.trim()}
            className="flex-1 rounded bg-amber-400 px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-tactical-950 disabled:opacity-50"
          >
            {isOpened ? "Re-open incident" : "Open incident"}
          </button>
        </div>
        <button
          type="button"
          onClick={onLoadMockSortie}
          className="w-full rounded border border-dashed border-olive-700 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-olive-500 hover:border-olive-500 hover:text-olive-300"
        >
          Dev · load mock sortie
        </button>
      </form>
    </Panel>
  );
}
