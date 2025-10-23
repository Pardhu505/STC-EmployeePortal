from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from bson import ObjectId
import os

router = APIRouter()

# --- Database Connection for GridFS ---
# This setup ensures the router has its own context for the database

attendance_mongo_url = os.environ.get("ATTENDANCE_MONGO_URL")

attendance_client = AsyncIOMotorClient(attendance_mongo_url, tlsAllowInvalidCertificates=True)
chat_db = attendance_client['Internal_communication']
grid_fs = AsyncIOMotorGridFSBucket(chat_db)



@router.get("/api/files/download/{file_id}")
async def download_file(file_id: str):
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
