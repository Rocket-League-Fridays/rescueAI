from __future__ import annotations

from datetime import datetime

from dao.interface.telemetry_dao import TelemetryDao
from dao.sqlite.connection import SqliteConnectionProvider
from models.domain import DroneTelemetry, GeoBounds, GeoPoint, GimbalOrientation


class SqliteTelemetryDao(TelemetryDao):
    def __init__(self, connections: SqliteConnectionProvider) -> None:
        self._connections = connections

    def save(self, telemetry: DroneTelemetry) -> None:
        with self._connections.connect() as connection:
            connection.execute(
                """
                INSERT INTO telemetry (
                    id, position_lat, position_lng,
                    bounds_sw_lat, bounds_sw_lng, bounds_ne_lat, bounds_ne_lng,
                    altitude_meters, heading_degrees,
                    gimbal_pitch, gimbal_yaw, gimbal_roll,
                    timestamp_utc, speed_mps, battery_percent
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    telemetry.id,
                    telemetry.position.lat,
                    telemetry.position.lng,
                    telemetry.bounds.south_west.lat,
                    telemetry.bounds.south_west.lng,
                    telemetry.bounds.north_east.lat,
                    telemetry.bounds.north_east.lng,
                    telemetry.altitude_meters,
                    telemetry.heading_degrees,
                    telemetry.gimbal.pitch_degrees,
                    telemetry.gimbal.yaw_degrees,
                    telemetry.gimbal.roll_degrees,
                    telemetry.timestamp_utc.isoformat(),
                    telemetry.speed_mps,
                    telemetry.battery_percent,
                ),
            )

    def get_by_id(self, telemetry_id: str) -> DroneTelemetry | None:
        with self._connections.connect() as connection:
            row = connection.execute(
                "SELECT * FROM telemetry WHERE id = ?",
                (telemetry_id,),
            ).fetchone()
        if row is None:
            return None
        return DroneTelemetry(
            id=row["id"],
            position=GeoPoint(lat=row["position_lat"], lng=row["position_lng"]),
            bounds=GeoBounds(
                south_west=GeoPoint(lat=row["bounds_sw_lat"], lng=row["bounds_sw_lng"]),
                north_east=GeoPoint(lat=row["bounds_ne_lat"], lng=row["bounds_ne_lng"]),
            ),
            altitude_meters=row["altitude_meters"],
            heading_degrees=row["heading_degrees"],
            gimbal=GimbalOrientation(
                pitch_degrees=row["gimbal_pitch"],
                yaw_degrees=row["gimbal_yaw"],
                roll_degrees=row["gimbal_roll"],
            ),
            timestamp_utc=datetime.fromisoformat(row["timestamp_utc"]),
            speed_mps=row["speed_mps"],
            battery_percent=row["battery_percent"],
        )
