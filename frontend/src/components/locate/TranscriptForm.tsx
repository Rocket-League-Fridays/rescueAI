"use client";

import { type ChangeEvent, type FormEvent, useRef, useState } from "react";

import { buttonPrimary, buttonSecondary, inputClass, Panel } from "@/components/ui";

interface TranscriptFormProps {
  transcript: string;
  isLoading: boolean;
  isOpened: boolean;
  onTranscriptChange(value: string): void;
  onOpenIncident(): void;
  onTranscribeAudio(file: File): Promise<void>;
}

export function TranscriptForm({
  transcript,
  isLoading,
  isOpened,
  onTranscriptChange,
  onOpenIncident,
  onTranscribeAudio,
}: TranscriptFormProps) {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const busy = isLoading || isTranscribing;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onOpenIncident();
  }

  function handleAudioSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setIsTranscribing(true);
    void onTranscribeAudio(file).finally(() => setIsTranscribing(false));
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
          disabled={busy}
          placeholder="Paste dispatch transcript here, or upload a call"
          className={`${inputClass} resize-y`}
        />
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
          className="hidden"
          onChange={handleAudioSelected}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => audioInputRef.current?.click()}
            disabled={busy}
            className={`${buttonSecondary} flex-1`}
          >
            {isTranscribing ? "Transcribing…" : "Upload call / audio"}
          </button>
          <button
            type="submit"
            disabled={busy || !transcript.trim()}
            className={`${buttonPrimary} flex-1`}
          >
            {isOpened ? "Re-open incident" : "Open incident"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
