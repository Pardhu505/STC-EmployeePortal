from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from bson import ObjectId

# Import the dependency from the new central database module
from .database import get_grid_fs

router = APIRouter()

@router.get("/files/download/{file_id}")
async def download_file(
    file_id: str, grid_fs: AsyncIOMotorGridFSBucket = Depends(get_grid_fs)
):
    try:
        # Convert string ID to BSON ObjectId
        gridfs_id = ObjectId(file_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file ID format.")

    try:
        # Open a download stream from GridFS
        download_stream = await grid_fs.open_download_stream(gridfs_id)

        # Get metadata to set headers correctly
        content_type = download_stream.metadata.get("contentType", "application/octet-stream")
        filename = download_stream.filename

        # Use StreamingResponse to send the file chunk by chunk
        return StreamingResponse(download_stream, media_type=content_type, headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\""
        })
    except Exception as e:
        # This will catch errors if the file_id is not found in GridFS
        raise HTTPException(status_code=404, detail=f"File not found: {e}")
