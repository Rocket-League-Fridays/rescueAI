from __future__ import annotations

from dao.interface.detection_dao import DetectionDao
from dao.sqlite.connection import SqliteConnectionProvider
from models.domain import BoundingBox, Detection, DetectionClassName, GeoPoint


class SqliteDetectionDao(DetectionDao):
    def __init__(self, connections: SqliteConnectionProvider) -> None:
        self._connections = connections

    def save(self, detection: Detection) -> None:
        self.save_all([detection])

    def save_all(self, detections: list[Detection]) -> None:
        if not detections:
            return
        with self._connections.connect() as connection:
            connection.executemany(
                """
                INSERT INTO detections (
                    id, job_id, class_name, bbox_x, bbox_y, bbox_width, bbox_height,
                    confidence, frame_id, ground_lat, ground_lng, clothing_match_score
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        detection.id,
                        detection.job_id,
                        detection.class_name.value,
                        detection.bbox.x,
                        detection.bbox.y,
                        detection.bbox.width,
                        detection.bbox.height,
                        detection.confidence,
                        detection.frame_id,
                        None if detection.ground_point is None else detection.ground_point.lat,
                        None if detection.ground_point is None else detection.ground_point.lng,
                        detection.clothing_match_score,
                    )
                    for detection in detections
                ],
            )

    def get_by_id(self, detection_id: str) -> Detection | None:
        with self._connections.connect() as connection:
            row = connection.execute(
                "SELECT * FROM detections WHERE id = ?",
                (detection_id,),
            ).fetchone()
        if row is None:
            return None
        return self._to_domain(row)

    def list_by_job_id(self, job_id: str) -> list[Detection]:
        with self._connections.connect() as connection:
            rows = connection.execute(
                "SELECT * FROM detections WHERE job_id = ?",
                (job_id,),
            ).fetchall()
        return [self._to_domain(row) for row in rows]

    def _to_domain(self, row: object) -> Detection:
        return Detection(
            id=row["id"],
            job_id=row["job_id"],
            class_name=DetectionClassName(row["class_name"]),
            bbox=BoundingBox(
                x=row["bbox_x"],
                y=row["bbox_y"],
                width=row["bbox_width"],
                height=row["bbox_height"],
            ),
            confidence=row["confidence"],
            frame_id=row["frame_id"],
            ground_point=_ground_point_from_row(row),
            clothing_match_score=_score_from_row(row),
        )


def _ground_point_from_row(row: object) -> GeoPoint | None:
    lat = row["ground_lat"]
    lng = row["ground_lng"]
    if lat is None or lng is None:
        return None
    return GeoPoint(lat=lat, lng=lng)


def _score_from_row(row: object) -> float:
    keys = row.keys()
    if "clothing_match_score" not in keys:
        return 0.0
    value = row["clothing_match_score"]
    return 0.0 if value is None else float(value)
