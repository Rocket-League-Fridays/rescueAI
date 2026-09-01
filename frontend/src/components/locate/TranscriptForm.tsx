"use client";

import { FormEvent } from "react";

import { buttonPrimary, inputClass, Panel } from "@/components/ui";

interface TranscriptFormProps {
  transcript: string;
  isLoading: boolean;
  isOpened: boolean;
  onTranscriptChange(value: string): void;
  onOpenIncident(): void;
}

export function TranscriptForm({
  transcript,
  isLoading,
  isOpened,
  onTranscriptChange,
  onOpenIncident,
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
          placeholder="Paste dispatch transcript here"
          className={`${inputClass} resize-y`}
        />
        <div className="flex flex-wrap gap-2">
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
