import json
import logging
import os
import re
from typing import Any, Dict, List, Optional, Union

import gspread
import pandas as pd
from fastapi import APIRouter, HTTPException, File, UploadFile, Query, Depends
from google.oauth2.service_account import Credentials
from dotenv import load_dotenv
from gspread.exceptions import WorksheetNotFound
from pydantic import BaseModel

# Import the database connection from your central database module
from database import main_db, chat_db, stc_db

# Explicitly load .env from the same directory as this script
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=dotenv_path)


def _get_gid_from_url(url: str) -> int:
    """Extracts the gid from a Google Sheets URL."""
    match = re.search(r'[#&]gid=(\d+)', url)
    if match:
        return int(match.group(1))
    return 0

def get_data_from_sheet(
    spreadsheet_url: str, sheet_name: Optional[Union[str, int]] = None
) -> List[Dict[str, Any]]:
    """
    Connects to Google Sheets using gspread and fetches data.
    """
    creds_json_str = os.getenv("GOOGLE_SHEETS_CREDENTIALS")
    if not creds_json_str:
        raise ValueError("GOOGLE_SHEETS_CREDENTIALS environment variable not set.")

    creds_info = json.loads(creds_json_str)

    scopes = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
    ]

    credentials = Credentials.from_service_account_info(creds_info, scopes=scopes)
    gc = gspread.authorize(credentials)

    sheet = gc.open_by_url(spreadsheet_url)

    if sheet_name is None:
        gid = _get_gid_from_url(spreadsheet_url)
        try:
            worksheet = sheet.get_worksheet_by_id(gid)  # type: ignore
        except WorksheetNotFound:
            # Fallback to the first sheet if gid is not found
            worksheet = sheet.get_worksheet(0)
    else:
        worksheet = sheet.worksheet(str(sheet_name))

    data = worksheet.get_all_records()
    df = pd.DataFrame(data)
    return df.to_dict(orient='records')


# --- FastAPI Router for Sheets ---

router = APIRouter()


class SheetRequest(BaseModel):
    url: str
    sheet_name: Optional[Union[str, int]] = None


@router.post("/sheets/data")
async def get_sheet_data_endpoint(request: SheetRequest):
    """
    Fetches data from a Google Sheet.
    The service account key should be set as GOOGLE_SHEETS_CREDENTIALS environment variable.
    """
    try:
        data = get_data_from_sheet(request.url, request.sheet_name)
        return data
    except Exception as e:
        logging.error(f"Failed to fetch sheet data: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch sheet data: {str(e)}")

# --- FastAPI Router for Excel File Mapping ---

COLLECTION_NAME = "ap_mapping"

@router.post("/upload-ap-mapping", tags=["Excel Data Mapping"])
async def upload_ap_mapping_data(file: UploadFile = File(...)):
    """
    Accepts an Excel file (.xlsx, .xls), reads its content, and replaces
    the data in the 'ap_mapping' MongoDB collection within the 'stc_portal' database.
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an Excel file.")

    try:
        df = pd.read_excel(file.file)
        data = df.to_dict('records')

        if not data:
            raise HTTPException(status_code=400, detail="The uploaded Excel file is empty or could not be read.")

        # Use the 'stc_db' which points to the 'STC_Employees' database as per your database.py
        # Or if you have a different DB for this, like 'main_db', you can use that.
        # Let's assume it belongs in the same DB group as STC_Employees.
        collection = stc_db[COLLECTION_NAME]
        
        await collection.delete_many({})
        await collection.insert_many(data)

        return {"message": f"Successfully uploaded and processed {len(data)} records from {file.filename}."}

    except Exception as e:
        logging.error(f"An error occurred while processing the Excel file: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An error occurred while processing the file: {str(e)}")


@router.get("/ap-mapping-data", tags=["Excel Data Mapping"])
async def get_ap_mapping_data(
    Zone: Optional[str] = Query(None),
    District: Optional[str] = Query(None),
    Parliament_Constituency: Optional[str] = Query(None, alias="Parliament Constituency"),
    Assembly_Constituency: Optional[str] = Query(None, alias="Assembly Constituency")
):
    """
    Fetches AP mapping data from the database, with optional filtering.
    """
    # Use case-insensitive regex for matching to handle variations in user input.
    # re.escape is used to treat user input as a literal string and prevent regex injection.
    query = {}
    if Zone and Zone.strip():
        query["Zone"] = {"$regex": f"^{re.escape(Zone)}$", "$options": "i"}
    if District and District.strip():
        query["District"] = {"$regex": f"^{re.escape(District)}$", "$options": "i"}
    if Parliament_Constituency and Parliament_Constituency.strip():
        query["Parliament Constituency"] = {
            "$regex": f"^{re.escape(Parliament_Constituency)}$", "$options": "i"
        }
    if Assembly_Constituency and Assembly_Constituency.strip():
        query["Assembly Constituency"] = {
            "$regex": f"^{re.escape(Assembly_Constituency)}$", "$options": "i"
        }

    # Use the same database connection as the upload endpoint
    collection = stc_db[COLLECTION_NAME]
    
    # Fetch data from MongoDB, excluding the internal '_id' field
    cursor = collection.find(query, {'_id': 0})
    results = await cursor.to_list(length=None)

    return results

