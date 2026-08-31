from __future__ import annotations

import json

from dao.interface.route_dao import RouteDao
from dao.sqlite.connection import SqliteConnectionProvider
from models.domain import Route, RouteWaypoint


class SqliteRouteDao(RouteDao):
    def __init__(self, connections: SqliteConnectionProvider) -> None:
        self._connections = connections

    def save(self, route: Route) -> None:
        waypoints_json = json.dumps(
            [
                {
                    "lat": waypoint.lat,
                    "lng": waypoint.lng,
                    "elevation_meters": waypoint.elevation_meters,
                }
                for waypoint in route.waypoints
            ]
        )
        with self._connections.connect() as connection:
            connection.execute(
                """
                INSERT INTO routes (id, job_id, waypoints_json, total_cost, landing_zone_id)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    route.id,
                    route.job_id,
                    waypoints_json,
                    route.total_cost,
                    route.landing_zone_id,
                ),
            )

    def get_by_id(self, route_id: str) -> Route | None:
        with self._connections.connect() as connection:
            row = connection.execute(
                "SELECT * FROM routes WHERE id = ?",
                (route_id,),
            ).fetchone()
        if row is None:
            return None
        return self._to_domain(row)

    def get_by_job_id(self, job_id: str) -> Route | None:
        with self._connections.connect() as connection:
            row = connection.execute(
                "SELECT * FROM routes WHERE job_id = ?",
                (job_id,),
            ).fetchone()
        if row is None:
            return None
        return self._to_domain(row)

    def _to_domain(self, row: object) -> Route:
        raw_waypoints = json.loads(row["waypoints_json"])
        return Route(
            id=row["id"],
            job_id=row["job_id"],
            waypoints=[
                RouteWaypoint(
                    lat=waypoint["lat"],
                    lng=waypoint["lng"],
                    elevation_meters=waypoint["elevation_meters"],
                )
                for waypoint in raw_waypoints
            ],
            total_cost=row["total_cost"],
            landing_zone_id=row["landing_zone_id"],
        )
