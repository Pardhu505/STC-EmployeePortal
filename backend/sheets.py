import gspread
from google.oauth2.service_account import Credentials
import pandas as pd
import re
import os
import json

def _get_gid_from_url(url):
    """Extracts the gid from a Google Sheets URL."""
    match = re.search(r'[#&]gid=(\d+)', url)
    if match:
        return int(match.group(1))
    return 0

def get_data_from_sheet(spreadsheet_url, sheet_name=None):
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
            worksheet = sheet.get_worksheet_by_id(gid)
        except gspread.exceptions.WorksheetNotFound:
            # Fallback to the first sheet if gid is not found
            worksheet = sheet.get_worksheet(0)
    else:
        worksheet = sheet.worksheet(sheet_name)

    data = worksheet.get_all_records()
    df = pd.DataFrame(data)
    return df.to_dict(orient='records')
