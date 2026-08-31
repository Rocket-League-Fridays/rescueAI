import numpy as np

from services.cv.clothing_score import clothing_match_score
from services.cv.nms import non_max_suppression
from services.interface.person_detector import RawDetection


def test_red_patch_scores_high_for_red_hint() -> None:
    image = np.zeros((40, 40, 3), dtype=np.uint8)
    image[:, :] = (0, 0, 220)
    assert clothing_match_score(image, ["red"]) > 0.5
    assert clothing_match_score(image, ["blue"]) < 0.1


def test_nms_drops_overlapping_lower_confidence() -> None:
    kept = non_max_suppression(
        [
            RawDetection(x=0, y=0, width=20, height=20, confidence=0.9),
            RawDetection(x=2, y=2, width=20, height=20, confidence=0.4),
            RawDetection(x=80, y=80, width=10, height=10, confidence=0.8),
        ],
        threshold=0.3,
    )
    assert len(kept) == 2
    assert kept[0].confidence == 0.9
