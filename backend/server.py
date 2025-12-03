from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
import logging
import asyncio
from datetime import timezone

# Initialize logging early so startup events can use `logger`
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import all database objects and dependencies from the central database module
from database import get_grid_fs, main_client, attendance_client, chat_db, stc_db
from announcements import check_scheduled_announcements

# Import new routers
from chat import router as chat_router
from attendance import router as attendance_router
from profile import router as profile_router
from admin import router as admin_router
from announcements import router as announcements_router
from meetings import router as meetings_router 
from sheets import router as sheets_router
from populate_chat_employees import populate_chat_employees # Import the function
from download_file import router as download_router

# --- Allowed Origins for CORS ---
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://showtime-consulting-employee-portal.onrender.com",
    "https://showtime-employeeportal.vercel.app",
    "https://stc-employeeportal.vercel.app"
]

# --- Custom Exception Handlers to ensure CORS headers on errors ---

async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Custom handler for HTTPException to ensure all error responses include
    the necessary CORS headers. This prevents the frontend from seeing
    a generic "Network Error" on 4xx/5xx responses.
    """
    origin = request.headers.get('origin')
    headers = getattr(exc, "headers", None) or {}
    # Mirror the Origin if present and allowed, otherwise allow all for local/dev
    if origin and origin in ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
    elif origin:
        headers["Access-Control-Allow-Origin"] = origin
    else:
        headers["Access-Control-Allow-Origin"] = "*"

    headers.setdefault("Access-Control-Allow-Credentials", "true")
    headers.setdefault("Access-Control-Allow-Methods", "*")
    headers.setdefault("Access-Control-Allow-Headers", "*")

    return JSONResponse(
        
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=headers,
    )

async def generic_exception_handler(request: Request, exc: Exception):
    """
    Catch-all handler for unhandled exceptions to return a 500 error
    with CORS headers.
    """
    logging.error(f"Unhandled exception: {exc}", exc_info=True)
    origin = request.headers.get('origin')
    headers = {}
    if origin and origin in ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
    elif origin:
        headers["Access-Control-Allow-Origin"] = origin
    else:
        headers["Access-Control-Allow-Origin"] = "*"

    headers.setdefault("Access-Control-Allow-Credentials", "true")
    headers.setdefault("Access-Control-Allow-Methods", "*")
    headers.setdefault("Access-Control-Allow-Headers", "*")

    return JSONResponse(status_code=500, content={"detail": "An internal server error occurred."}, headers=headers)

# Create the main app and register exception handlers
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register the custom exception handlers
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# --- API Routes ---
@api_router.get("/health")
async def health_check():
    return {"status": "ok"}

@api_router.get("/")
async def root():
    return {"message": "Hello World from API"}

# Corrected CORS middleware configuration
@app.get("/")
async def app_root():
    """A simple endpoint for the root URL to confirm the server is running."""
    return {"message": "Welcome to the STC Portal API. Visit /docs for documentation."}

# Include the download file router and provide the GridFS dependency
api_router.include_router(
    download_router, dependencies=[Depends(get_grid_fs)], tags=["Files"]
)
api_router.include_router(chat_router, tags=["Chat & Messaging"])
api_router.include_router(attendance_router, tags=["Attendance"])
api_router.include_router(profile_router, tags=["Users & Profiles"])
api_router.include_router(admin_router, tags=["Admin"])
api_router.include_router(announcements_router, tags=["Announcements"])
api_router.include_router(meetings_router, prefix="/meetings", tags=["Meetings"])
api_router.include_router(sheets_router, tags=["Google Sheets"])
# The WebSocket endpoint is now part of the chat_router

app.include_router(api_router)

async def setup_chat_indexes():
    try:
        # DeletedMessages auto-expire after 30 days
        await chat_db.DeletedMessages.create_index(
            "created_at",
            expireAfterSeconds=60 * 60 * 24 * 30  # 30 days
        )

        # Channel & Direct chat: auto-remove globally deleted messages after 90 days
        await chat_db.Channel_chat.create_index(
            "deleted_at",
            expireAfterSeconds=60 * 60 * 24 * 90,  # 90 days
            partialFilterExpression={"deleted_at": {"$exists": True}}
        )
        await chat_db.Direct_chat.create_index(
            "deleted_at",
            expireAfterSeconds=60 * 60 * 24 * 90,
            partialFilterExpression={"deleted_at": {"$exists": True}}
        )

        logging.info("TTL indexes created for DeletedMessages (30d) and deleted messages (90d)")
    except Exception as e:
        logging.error(f"Failed to create TTL indexes: {e}")

async def setup_ap_mapping_indexes():
    """Creates indexes on the ap_mapping collection to speed up queries."""
    try:
        collection = stc_db["ap_mapping"]
        # Create individual indexes on the fields used for filtering
        await collection.create_index("Zone")
        await collection.create_index("District")
        await collection.create_index("Parliament Constituency")
        await collection.create_index("Assembly Constituency")
        logging.info("Indexes created for ap_mapping collection.")
    except Exception as e:
        logging.error(f"Failed to create ap_mapping indexes: {e}")

async def setup_ap_mapping_indexes():
    """Creates indexes on the ap_mapping collection to speed up queries."""
    try:
        collection = stc_db["ap_mapping"]
        # Create individual indexes on the fields used for filtering
        await collection.create_index("Zone")
        await collection.create_index("District")
        await collection.create_index("Parliament Constituency")
        await collection.create_index("Assembly Constituency")
        logging.info("Indexes created for ap_mapping collection.")
    except Exception as e:
        logging.error(f"Failed to create ap_mapping indexes: {e}")

@app.on_event("startup")
async def startup_event():
    try:
        await main_client.admin.command('ping')
        await attendance_client.admin.command('ping')
        logger.info("MongoDB connections successful.")

        # Setup background tasks and indexes
        await setup_chat_indexes()
        await setup_ap_mapping_indexes()

        asyncio.create_task(check_scheduled_announcements())
        await populate_chat_employees() # Run the script on startup
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}")
        logger.info("Continuing without MongoDB - WebSocket functionality will work without database persistence")

# logger already initialized above
