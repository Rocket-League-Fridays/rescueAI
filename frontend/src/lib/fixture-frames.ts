import type { BoundingBox, Detection } from "@/types/telemetry";

/**
 * Frame imagery for the committed fixture.
 *
 * The fixture has no recorded sortie behind it, so there are no real frame bytes to serve. These
 * are drawn rather than photographed: a synthetic nadir frame at the fixture's own resolution, and
 * the same frame with detection boxes placed from the fixture's actual bbox pixels. That keeps the
 * evidence panes exercising the real code path (artifact -> content url -> img) without shipping
 * binaries or pretending to be a real capture — the frame is stamped SIMULATED so a screenshot of
 * it can never be mistaken for evidence.
 */

const FRAME_WIDTH = 3840;
const FRAME_HEIGHT = 2160;

export const FIXTURE_FRAME_ARTIFACT_ID = "fixture-frame-000412";
export const FIXTURE_ANNOTATED_ARTIFACT_ID = "fixture-annotated-000412";
export const FIXTURE_FRAME_INDEX = 412;
export const FIXTURE_FRAME_WIDTH = FRAME_WIDTH;
export const FIXTURE_FRAME_HEIGHT = FRAME_HEIGHT;

const BOX_COLOR: Record<string, string> = {
  subject: "#ffb020",
  person: "#4ea8de",
  other: "#6b7a8f",
};

/** Terrain is faked with layered noise-ish polygons — deterministic, so the frame never flickers. */
function terrain(): string {
  const ridges: string[] = [];
  for (let band = 0; band < 7; band += 1) {
    const baseY = 260 + band * 300;
    const points: string[] = [`0,${FRAME_HEIGHT}`, `0,${baseY}`];
    for (let x = 0; x <= FRAME_WIDTH; x += 160) {
      const wobble =
        Math.sin((x / FRAME_WIDTH) * 6.1 + band * 1.7) * 62 +
        Math.sin((x / FRAME_WIDTH) * 17.3 + band * 3.1) * 24;
      points.push(`${x},${(baseY + wobble).toFixed(1)}`);
    }
    points.push(`${FRAME_WIDTH},${FRAME_HEIGHT}`);
    // Near bands read brighter than far ones, which is what gives the frame its sense of depth.
    const shade = 34 + band * 13;
    ridges.push(
      `<polygon points="${points.join(" ")}" fill="rgb(${shade},${shade + 14},${shade + 6})" />`,
    );
  }
  return ridges.join("");
}

function scree(): string {
  const dots: string[] = [];
  for (let i = 0; i < 420; i += 1) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(i * 78.233) * 12345.6789) % 1;
    const cx = Math.abs(x) * FRAME_WIDTH;
    const cy = Math.abs(y) * FRAME_HEIGHT;
    const r = 3 + (Math.abs(x * y) * 100) % 9;
    dots.push(
      `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(1)}" ` +
        `fill="rgb(122,126,108)" opacity="0.4" />`,
    );
  }
  return dots.join("");
}

function trailRibbon(): string {
  return (
    `<path d="M 250 2050 C 900 1820, 1250 1560, 1700 1420 S 2500 1180, 3100 980" ` +
    `fill="none" stroke="rgb(150,142,116)" stroke-width="26" opacity="0.65" />`
  );
}

function chrome(label: string): string {
  return (
    `<rect x="0" y="0" width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}" fill="none" ` +
    `stroke="rgb(255,255,255)" stroke-opacity="0.06" stroke-width="8" />` +
    `<g font-family="ui-monospace, Menlo, monospace" font-size="46" fill="rgb(210,216,222)" opacity="0.75">` +
    `<text x="56" y="96">${label}</text>` +
    `<text x="56" y="${FRAME_HEIGHT - 56}">AGL 118.5 M · HDG 214.7 · GIMBAL -62.5</text>` +
    `<text x="${FRAME_WIDTH - 56}" y="96" text-anchor="end">SIMULATED FIXTURE FRAME</text>` +
    `</g>`
  );
}

function detectionBox(box: BoundingBox, color: string, caption: string): string {
  const { x, y, width, height } = box;
  const tick = 34;
  return (
    `<g>` +
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${color}" fill-opacity="0.1" ` +
    `stroke="${color}" stroke-width="7" />` +
    `<path d="M ${x - tick} ${y} h ${tick} M ${x} ${y - tick} v ${tick}" stroke="${color}" stroke-width="7" fill="none" />` +
    `<rect x="${x}" y="${y - 66}" width="${Math.max(caption.length * 25, 200)}" height="58" fill="${color}" />` +
    `<text x="${x + 14}" y="${y - 24}" font-family="ui-monospace, Menlo, monospace" font-size="40" ` +
    `fill="rgb(10,12,14)" font-weight="700">${caption}</text>` +
    `</g>`
  );
}

function toDataUri(body: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}" ` +
    `width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}">` +
    `<rect width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}" fill="rgb(18,22,20)" />` +
    body +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const base = terrain() + scree() + trailRibbon();

export function fixtureFrameDataUri(): string {
  return toDataUri(base + chrome("FRAME 000412 · 2026-08-30T18:42:11Z"));
}

export function fixtureAnnotatedFrameDataUri(detections: Detection[]): string {
  const boxes = detections
    .filter((detection) => detection.frameId === "frame_000412")
    .map((detection, index) => {
      const isSubject = index === 0 && detection.className === "person";
      const color = isSubject ? BOX_COLOR.subject : BOX_COLOR[detection.className] ?? BOX_COLOR.other;
      const caption = `${detection.className.toUpperCase()} ${(detection.confidence * 100).toFixed(0)}%`;
      return detectionBox(detection.bbox, color, caption);
    })
    .join("");
  return toDataUri(base + boxes + chrome("FRAME 000412 · SAHI + YOLO"));
}
