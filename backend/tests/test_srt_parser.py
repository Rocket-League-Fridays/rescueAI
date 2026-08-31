from services.ingest.srt_parser import mid_sample, parse_dji_srt
from tests.video_fixtures import DJI_SRT_FIXTURE


def test_parse_dji_srt_extracts_gps_and_gimbal() -> None:
    samples = parse_dji_srt(DJI_SRT_FIXTURE)
    assert len(samples) == 2
    assert samples[0].lat == 40.2338
    assert samples[0].lng == -111.6585
    assert samples[0].altitude_meters == 120.0
    assert samples[0].pitch_degrees == -45.0
    assert samples[1].altitude_meters == 125.5


def test_mid_sample_picks_middle_block() -> None:
    samples = parse_dji_srt(DJI_SRT_FIXTURE)
    middle = mid_sample(samples)
    assert middle is not None
    assert middle.lat == 40.234
