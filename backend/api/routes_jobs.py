from fastapi import APIRouter, Depends, HTTPException, status

from api.dependencies import get_job_service, require_api_key
from models.schemas import JobDetailOut
from services.job_service import JobService

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get(
    "/{job_id}",
    response_model=JobDetailOut,
    dependencies=[Depends(require_api_key)],
)
def get_job(job_id: str, job_service: JobService = Depends(get_job_service)) -> JobDetailOut:
    detail = job_service.get_job_detail(job_id)
    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Failed to load job: job {job_id} does not exist",
        )
    return detail
