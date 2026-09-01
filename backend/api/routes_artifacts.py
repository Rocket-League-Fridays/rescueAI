from fastapi import APIRouter, Depends, HTTPException, Response, status

from api.dependencies import get_job_service, require_api_key
from services.job_service import JobService

router = APIRouter(prefix="/artifacts", tags=["artifacts"])


@router.get(
    "/{artifact_id}/content",
    dependencies=[Depends(require_api_key)],
)
def get_artifact_content(
    artifact_id: str,
    job_service: JobService = Depends(get_job_service),
) -> Response:
    content = job_service.get_artifact_content(artifact_id)
    if content is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Failed to load artifact: artifact {artifact_id} does not exist",
        )
    payload, mime_type = content
    return Response(
        content=payload,
        media_type=mime_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )
