"use client";

import { FormEvent } from "react";

import { buttonPrimary, buttonSecondary, inputClass, Panel } from "@/components/ui";

interface TranscriptFormProps {
  transcript: string;
  isLoading: boolean;
  isOpened: boolean;
  onTranscriptChange(value: string): void;
  onOpenIncident(): void;
  onLoadFixtureTranscript(): void;
}

export function TranscriptForm({
  transcript,
  isLoading,
  isOpened,
  onTranscriptChange,
  onOpenIncident,
  onLoadFixtureTranscript,
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
            className={`${buttonSecondary} flex-1`}
          >
            Load Josh / Y fixture
          </button>
          <button
            type="submit"
            disabled={isLoading || !transcript.trim()}
            className={`${buttonPrimary} flex-1`}
          >
            {isOpened ? "Re-open incident" : "Open incident"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
