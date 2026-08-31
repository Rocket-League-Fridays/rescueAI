from __future__ import annotations

from dao.interface.landing_zone_dao import LandingZoneDao
from dao.sqlite.connection import SqliteConnectionProvider
from models.domain import GeoBounds, GeoPoint, LandingZone


class SqliteLandingZoneDao(LandingZoneDao):
    def __init__(self, connections: SqliteConnectionProvider) -> None:
        self._connections = connections

    def save(self, landing_zone: LandingZone) -> None:
        self.save_all([landing_zone])

    def save_all(self, landing_zones: list[LandingZone]) -> None:
        if not landing_zones:
            return
        with self._connections.connect() as connection:
            connection.executemany(
                """
                INSERT INTO landing_zones (
                    id, job_id, centroid_lat, centroid_lng,
                    bounds_sw_lat, bounds_sw_lng, bounds_ne_lat, bounds_ne_lng,
                    max_slope_degrees, area_sq_ft, canopy_fraction,
                    suitability_score, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        landing_zone.id,
                        landing_zone.job_id,
                        landing_zone.centroid.lat,
                        landing_zone.centroid.lng,
                        landing_zone.bounds.south_west.lat,
                        landing_zone.bounds.south_west.lng,
                        landing_zone.bounds.north_east.lat,
                        landing_zone.bounds.north_east.lng,
                        landing_zone.max_slope_degrees,
                        landing_zone.area_sq_ft,
                        landing_zone.canopy_fraction,
                        landing_zone.suitability_score,
                        landing_zone.notes,
                    )
                    for landing_zone in landing_zones
                ],
            )

    def get_by_id(self, landing_zone_id: str) -> LandingZone | None:
        with self._connections.connect() as connection:
            row = connection.execute(
                "SELECT * FROM landing_zones WHERE id = ?",
                (landing_zone_id,),
            ).fetchone()
        if row is None:
            return None
        return self._to_domain(row)

    def list_by_job_id(self, job_id: str) -> list[LandingZone]:
        with self._connections.connect() as connection:
            rows = connection.execute(
                "SELECT * FROM landing_zones WHERE job_id = ?",
                (job_id,),
            ).fetchall()
        return [self._to_domain(row) for row in rows]

    def _to_domain(self, row: object) -> LandingZone:
        return LandingZone(
            id=row["id"],
            job_id=row["job_id"],
            centroid=GeoPoint(lat=row["centroid_lat"], lng=row["centroid_lng"]),
            bounds=GeoBounds(
                south_west=GeoPoint(lat=row["bounds_sw_lat"], lng=row["bounds_sw_lng"]),
                north_east=GeoPoint(lat=row["bounds_ne_lat"], lng=row["bounds_ne_lng"]),
            ),
            max_slope_degrees=row["max_slope_degrees"],
            area_sq_ft=row["area_sq_ft"],
            canopy_fraction=row["canopy_fraction"],
            suitability_score=row["suitability_score"],
            notes=row["notes"],
        )
