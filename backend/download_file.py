from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pathlib import Path

router = APIRouter()

@router.get("/files/download/{filename}")
async def download_file(filename: str, original_filename: str = Query(None)):
    uploads_dir = Path(__file__).parent / "uploads"
    file_path = uploads_dir / filename

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    # Use original filename if provided, otherwise use the stored filename
    download_filename = original_filename if original_filename else filename

    return FileResponse(
        path=file_path,
        filename=download_filename,
        media_type='application/octet-stream',
        headers={"Content-Disposition": f"attachment; filename=\"{download_filename}\""}
    )
