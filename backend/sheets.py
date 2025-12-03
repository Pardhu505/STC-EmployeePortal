import json
import logging
import os
import re
from typing import Any, Dict, List, Optional, Union

import gspread
import pandas as pd
from fastapi import APIRouter, HTTPException
from google.oauth2.service_account import Credentials
from dotenv import load_dotenv
from gspread.exceptions import WorksheetNotFound
from pydantic import BaseModel

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