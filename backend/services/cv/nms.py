from __future__ import annotations

from services.interface.person_detector import RawDetection


def iou(left: RawDetection, right: RawDetection) -> float:
    ax2 = left.x + left.width
    ay2 = left.y + left.height
    bx2 = right.x + right.width
    by2 = right.y + right.height
    inter_w = max(0.0, min(ax2, bx2) - max(left.x, right.x))
    inter_h = max(0.0, min(ay2, by2) - max(left.y, right.y))
    inter = inter_w * inter_h
    union = left.width * left.height + right.width * right.height - inter
    if union <= 0:
        return 0.0
    return inter / union


def non_max_suppression(boxes: list[RawDetection], threshold: float = 0.45) -> list[RawDetection]:
    ordered = sorted(boxes, key=lambda box: box.confidence, reverse=True)
    kept: list[RawDetection] = []
    while ordered:
        candidate = ordered.pop(0)
        kept.append(candidate)
        ordered = [box for box in ordered if iou(candidate, box) < threshold]
    return kept
