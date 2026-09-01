const EXTRACTOR_PLACEHOLDER =
  "Keyword extract from distress transcript (no LLM required).";

const COLOR =
  "red|orange|yellow|green|blue|purple|black|white|gray|grey|brown|pink";
const MODIFIER = "bright|dark|small|large|grade";
const GARMENT =
  "rain jacket|hiking pants|jacket|pants|hoodie|waders|day\\s*pack|backpack|pack|shirt|hat";
const GARMENT_RE = new RegExp(
  `\\b(?:(?:${MODIFIER}|${COLOR})\\s+)+(?:${GARMENT})\\b`,
  "gi",
);

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

function prettyGarment(phrase: string): string {
  const cleaned = phrase
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bgrade\b/g, "gray")
    .replace(/day pack/g, "daypack");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function joinPhrases(phrases: string[]): string {
  if (phrases.length === 1) {
    return phrases[0] ?? "";
  }
  if (phrases.length === 2) {
    return `${phrases[0]} and ${phrases[1]}`;
  }
  return `${phrases.slice(0, -1).join(", ")}, and ${phrases[phrases.length - 1]}`;
}

/** Clothing / condition brief. Used when the stored notes are the old extractor disclaimer. */
export function describeSubjectFromTranscript(transcript: string): string {
  const lowered = transcript.toLowerCase();
  const garments: string[] = [];
  for (const match of lowered.matchAll(GARMENT_RE)) {
    const phrase = prettyGarment(match[0] ?? "");
    if (phrase && !garments.includes(phrase)) {
      garments.push(phrase);
    }
  }
  const parts: string[] = [];
  if (garments.length > 0) {
    parts.push(`${joinPhrases(garments)}.`);
  }
  if (/\b(?:ankle|sprain|injur|immobile|moving slow)\b/.test(lowered)) {
    parts.push("Recent injury, likely slow or immobile.");
  }
  if (/\b(?:no|not|n't|without|didn't|does not|doesn't)\b.{0,28}\bovernight\b/.test(lowered)) {
    parts.push("No overnight gear.");
  }
  if (/\bdropped call\b|\bno working phone\b|\bphone is dead\b/.test(lowered)) {
    parts.push("No working phone.");
  }
  return parts.join(" ");
}

export function displaySubjectNotes(notes: string, transcript: string): string {
  if (isExtractorPlaceholder(notes) || notes.trim() === "") {
    return describeSubjectFromTranscript(transcript);
  }
  return notes.trim();
}
