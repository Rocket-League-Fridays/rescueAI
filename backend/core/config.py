from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="SAR_",
        env_file=".env",
        extra="ignore",
    )

    database_path: str = Field(default="data/sar.db")
    artifacts_dir: str = Field(default="data/artifacts")
    ingest_dir: str = Field(default="data/inbox")
    ingest_watch_enabled: bool = Field(default=True)
    ingest_poll_seconds: float = Field(default=2.0, ge=0)
    ingest_settle_seconds: float = Field(default=2.0, ge=0)
    frame_stride: int = Field(default=15, ge=1)
    max_frames: int = Field(default=40, ge=1)
    jpeg_quality: int = Field(default=85, ge=1, le=100)
    sahi_tile_size: int = Field(default=640, ge=32)
    sahi_overlap: float = Field(default=0.2, ge=0, lt=1)
    camera_hfov_degrees: float = Field(default=82.0, gt=0, lt=180)
    default_lat: float = Field(default=40.2338, ge=-90, le=90)
    default_lng: float = Field(default=-111.6585, ge=-180, le=180)
    default_altitude_meters: float = Field(default=120.0)
    default_heading_degrees: float = Field(default=0.0, ge=0, le=360)
    api_key: str | None = Field(default=None)
    cors_origins: str = Field(default="http://localhost:3000")
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)

    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
