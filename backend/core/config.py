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
    api_key: str | None = Field(default=None)
    cors_origins: str = Field(default="http://localhost:3000")
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)

    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
