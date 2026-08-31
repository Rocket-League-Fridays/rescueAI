from __future__ import annotations

import math

from models.domain import Artifact, BoundingBox, Detection, DroneTelemetry, GeoPoint
from services.interface.georeferencer import DetectionGeoreferencer

_METERS_PER_DEG_LAT = 111_320.0


class PinholeGeoreferencer(DetectionGeoreferencer):
    """Approximate pixel-to-ground using a flat-earth pinhole model. Not DEM-accurate."""

    def __init__(self, camera_hfov_degrees: float) -> None:
        self._hfov_radians = math.radians(camera_hfov_degrees)

    def apply(
        self,
        detections: list[Detection],
        telemetry: DroneTelemetry,
        frames: list[Artifact],
        frame_poses: dict[int, DroneTelemetry] | None = None,
    ) -> list[Detection]:
        frames_by_id = {frame.id: frame for frame in frames}
        annotated: list[Detection] = []
        for detection in detections:
            frame = frames_by_id.get(detection.frame_id) if detection.frame_id else None
            pose = _pose_for_frame(telemetry, frame, frame_poses)
            width, height = _frame_size(frame)
            detection.ground_point = project_bbox_center(
                bbox=detection.bbox,
                frame_width=width,
                frame_height=height,
                telemetry=pose,
                hfov_radians=self._hfov_radians,
            )
            annotated.append(detection)
        return annotated


def project_bbox_center(
    bbox: BoundingBox,
    frame_width: int,
    frame_height: int,
    telemetry: DroneTelemetry,
    hfov_radians: float,
) -> GeoPoint | None:
    if frame_width <= 0 or frame_height <= 0:
        return None
    altitude = telemetry.altitude_meters
    if altitude <= 0:
        return None
    vfov = 2.0 * math.atan(math.tan(hfov_radians / 2.0) * (frame_height / frame_width))
    look_down = max(math.radians(5.0), math.radians(-telemetry.gimbal.pitch_degrees))
    ground_width = 2.0 * altitude * math.tan(hfov_radians / 2.0) / math.sin(look_down)
    ground_height = 2.0 * altitude * math.tan(vfov / 2.0) / math.sin(look_down)
    meters_per_px_x = ground_width / frame_width
    meters_per_px_y = ground_height / frame_height

    center_x = bbox.x + bbox.width / 2.0
    center_y = bbox.y + bbox.height / 2.0
    east = (center_x - frame_width / 2.0) * meters_per_px_x
    north = (frame_height / 2.0 - center_y) * meters_per_px_y

    heading = math.radians(telemetry.heading_degrees + telemetry.gimbal.yaw_degrees)
    east_r = east * math.cos(heading) + north * math.sin(heading)
    north_r = -east * math.sin(heading) + north * math.cos(heading)

    lat0 = telemetry.position.lat
    lng0 = telemetry.position.lng
    lat = lat0 + north_r / _METERS_PER_DEG_LAT
    denom = _METERS_PER_DEG_LAT * max(0.2, math.cos(math.radians(lat0)))
    lng = lng0 + east_r / denom
    return GeoPoint(lat=_clamp(lat, -90, 90), lng=_clamp(lng, -180, 180))


def _pose_for_frame(
    telemetry: DroneTelemetry,
    frame: Artifact | None,
    frame_poses: dict[int, DroneTelemetry] | None,
) -> DroneTelemetry:
    if frame is None or frame.frame_index is None or not frame_poses:
        return telemetry
    return frame_poses.get(frame.frame_index, telemetry)


def _frame_size(frame: Artifact | None) -> tuple[int, int]:
    if frame is None or frame.width is None or frame.height is None:
        return 3840, 2160
    return frame.width, frame.height


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))
