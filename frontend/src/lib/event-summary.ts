const EXTRACTOR_PLACEHOLDER =
  "Keyword extract from distress transcript (no LLM required).";

/** First one or two sentences of the distress call — the operator-facing event brief. */
export function summarizeTranscript(transcript: string): string {
  const trimmed = transcript.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return "No transcript on this incident.";
  }
  const matches = trimmed.match(/[^.!?]+[.!?]+/g);
  if (!matches || matches.length === 0) {
    return trimmed;
  }
  return matches
    .slice(0, 2)
    .map((part) => part.trim())
    .join(" ");
}

export function isExtractorPlaceholder(notes: string): boolean {
  return notes.trim() === EXTRACTOR_PLACEHOLDER;
}
