from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import ValidationError

from api.dependencies import get_job_processor, get_job_service, require_api_key
from models.schemas import CreateJobRequest, DroneTelemetryIn, JobOut
from services.job_service import JobService
from tasks.async_workers import JobProcessor

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


@router.post(
    "",
    response_model=JobOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_api_key)],
)
def create_job_from_telemetry(
    request: CreateJobRequest,
    background_tasks: BackgroundTasks,
    job_service: JobService = Depends(get_job_service),
    processor: JobProcessor = Depends(get_job_processor),
) -> JobOut:
    job = job_service.create_job(request)
    background_tasks.add_task(processor.process_job, job.id)
    return JobOut.from_domain(job)


@router.post(
    "/upload",
    response_model=JobOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_api_key)],
)
def create_job_with_video(
    background_tasks: BackgroundTasks,
    telemetry: str = Form(...),
    incident_id: str | None = Form(default=None),
    video: UploadFile | None = File(default=None),
    job_service: JobService = Depends(get_job_service),
    processor: JobProcessor = Depends(get_job_processor),
) -> JobOut:
    try:
        request = CreateJobRequest(
            telemetry=DroneTelemetryIn.model_validate_json(telemetry),
            incident_id=incident_id,
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.errors(),
        ) from exc

    video_bytes = video.file.read() if video is not None else None
    job = job_service.create_job(
        request,
        video_bytes=video_bytes,
        video_filename=video.filename if video is not None else None,
        video_content_type=video.content_type if video is not None else None,
    )
    background_tasks.add_task(processor.process_job, job.id)
    return JobOut.from_domain(job)
