from models.domain import GeoPoint
from services.intake.transcript_extractor import KeywordTranscriptExtractor
from services.locate.likely_locations import score_likely_locations


def _line() -> list[GeoPoint]:
    return [
        GeoPoint(lat=40.24555 + index * 0.0004, lng=-111.62815 + index * 0.0005)
        for index in range(16)
    ]


def test_empty_trail_returns_nothing() -> None:
    assert score_likely_locations([], GeoPoint(40.25, -111.62), 60, "lost hiker") == []


def test_beyond_time_cap_is_dropped() -> None:
    trail = _line()
    pls = trail[0]
    far = score_likely_locations(trail, pls, 1, "lost on the trail")
    assert all(location.distance_from_pls_meters < 80 for location in far)


def test_viewpoint_and_left_trail_boost_upper_vertices() -> None:
    trail = _line()
    pls = trail[2]
    plain = score_likely_locations(trail, pls, 90, "lost on the trail")
    cued = score_likely_locations(
        trail,
        pls,
        90,
        "He left the trail at a viewpoint uphill past the Y itself.",
    )
    assert cued
    assert cued[0].score >= (plain[0].score if plain else 0)
    assert any("viewpoint" in location.reason for location in cued)


def test_decision_points_get_off_trail_hypothesis() -> None:
    trail = [
        GeoPoint(lat=40.24555, lng=-111.62815),
        GeoPoint(lat=40.24600, lng=-111.62750),
        GeoPoint(lat=40.24600, lng=-111.62640),
        GeoPoint(lat=40.24720, lng=-111.62600),
    ]
    scored = score_likely_locations(trail, trail[0], 120, "Josh started from the trailhead two hours ago.")
    assert any("decision point" in location.reason for location in scored)


def test_extractor_reads_trailhead_start_and_two_hours() -> None:
    extracted = KeywordTranscriptExtractor().extract(
        "His name is Josh. He started the hike two hours ago from the Y trailhead."
    )
    assert extracted.started_from_trailhead is True
    assert extracted.missing_minutes == 120


def test_extractor_does_not_treat_above_trailhead_as_start() -> None:
    extracted = KeywordTranscriptExtractor().extract(
        "Lost Scout on the Y Mountain trail above the Y trailhead. His name is Josh."
    )
    assert extracted.started_from_trailhead is False


def test_extractor_reads_hour_later() -> None:
    extracted = KeywordTranscriptExtractor().extract(
        "Separated near the switchbacks about an hour later. His name is Josh."
    )
    assert extracted.missing_minutes == 60


def test_extractor_reads_clock_span() -> None:
    extracted = KeywordTranscriptExtractor().extract(
        "Started around 4 p.m. Last contact around 5:50 p.m. His name is Josh."
    )
    assert extracted.missing_minutes == 110


def test_extractor_leaves_time_unknown_without_cues() -> None:
    extracted = KeywordTranscriptExtractor().extract(
        "His name is Calvin. Green waders near 40.3884811, -111.5447873."
    )
    assert extracted.missing_minutes is None
