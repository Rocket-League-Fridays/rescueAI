from fastapi import Depends, Header, HTTPException, Request, status

from core.config import Settings
from services.interface.service_factory import ServiceFactory
from services.job_service import JobService
from tasks.async_workers import JobProcessor


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_service_factory(request: Request) -> ServiceFactory:
    return request.app.state.service_factory


def get_job_processor(request: Request) -> JobProcessor:
    return request.app.state.job_processor


def get_job_service(
    factory: ServiceFactory = Depends(get_service_factory),
) -> JobService:
    return factory.create_job_service()


def require_api_key(
    settings: Settings = Depends(get_settings),
    x_api_key: str | None = Header(default=None),
) -> None:
    if settings.api_key is None:
        return
    if x_api_key != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to authorize request: invalid or missing API key",
        )
