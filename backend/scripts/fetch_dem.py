"""Fetch a cached USGS 3DEP elevation tile for the demo corridor.

Run once; the result is committed. Nothing at request time touches the network,
which is the point — see D17 in docs/context/01-decisions.md.

    python scripts/fetch_dem.py
"""

from __future__ import annotations

import json
import math
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np

SAMPLES_URL = (
    "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples"
)
PAD_DEGREES = 0.005
CELL_METERS = 10.0
METERS_PER_DEG_LAT = 111_320.0
BATCH = 500
PAUSE_SECONDS = 0.15

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.intake.incident_service import resolve_demo_dir  # noqa: E402
from services.intake.trail_catalog import TrailCatalog  # noqa: E402


def fetch_batch(points: list[list[float]]) -> list[float]:
    body = urllib.parse.urlencode(
        {
            "geometry": json.dumps({"points": points, "spatialReference": {"wkid": 4326}}),
            "geometryType": "esriGeometryMultipoint",
            "returnFirstValueOnly": "true",
            "f": "json",
        }
    ).encode()
    with urllib.request.urlopen(urllib.request.Request(SAMPLES_URL, data=body), timeout=90) as response:
        payload = json.loads(response.read())
    samples = payload.get("samples")
    if samples is None:
        raise RuntimeError(f"3DEP returned no samples: {payload}")
    by_id = {int(sample["locationId"]): sample for sample in samples}
    values = []
    for index in range(len(points)):
        sample = by_id.get(index)
        raw = sample.get("value") if sample else None
        values.append(float(raw) if raw not in (None, "") else math.nan)
    return values


def main() -> None:
    demo_dir = Path(resolve_demo_dir("demo"))
    trail = TrailCatalog(str(demo_dir)).load_line("Y Mountain Trail")

    lat0 = min(p.lat for p in trail) - PAD_DEGREES
    lat1 = max(p.lat for p in trail) + PAD_DEGREES
    lng0 = min(p.lng for p in trail) - PAD_DEGREES
    lng1 = max(p.lng for p in trail) + PAD_DEGREES
    dlat = CELL_METERS / METERS_PER_DEG_LAT
    dlng = CELL_METERS / (METERS_PER_DEG_LAT * math.cos(math.radians((lat0 + lat1) / 2)))
    lats = np.arange(lat0, lat1 + dlat, dlat)
    lngs = np.arange(lng0, lng1 + dlng, dlng)

    points = [[float(lng), float(lat)] for lat in lats for lng in lngs]
    print(f"sampling {len(lats)}x{len(lngs)} = {len(points):,} points at ~{CELL_METERS:.0f} m")

    values: list[float] = []
    started = time.perf_counter()
    for index in range(0, len(points), BATCH):
        values.extend(fetch_batch(points[index : index + BATCH]))
        print(f"  {min(index + BATCH, len(points)):>6}/{len(points)}", end="\r")
        time.sleep(PAUSE_SECONDS)

    elevation = np.array(values, dtype=float).reshape(len(lats), len(lngs))
    missing = int(np.isnan(elevation).sum())
    if missing:
        raise RuntimeError(f"{missing} points came back empty; refusing to cache a holed DEM")

    out = demo_dir / "y_mountain_dem.npz"
    np.savez_compressed(
        out,
        elevation=np.round(elevation, 1).astype(np.float32),
        lat0=np.array(float(lats[0])),
        lng0=np.array(float(lngs[0])),
        dlat=np.array(float(dlat)),
        dlng=np.array(float(dlng)),
    )
    print(
        f"\nwrote {out} ({out.stat().st_size // 1024} KB), "
        f"elevation {elevation.min():.0f}..{elevation.max():.0f} m in "
        f"{time.perf_counter() - started:.0f}s"
    )


if __name__ == "__main__":
    main()
