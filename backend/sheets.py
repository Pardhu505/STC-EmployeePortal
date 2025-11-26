import gsheets
import re

def _get_gid_from_url(url):
    """Extracts the gid from a Google Sheets URL."""
    match = re.search(r'[#&]gid=(\d+)', url)
    if match:
        return int(match.group(1))
    return 0  # Default to the first sheet

def get_data_from_sheet(spreadsheet_url, sheet_name=None):
    """
    Connects to Google Sheets and fetches data from a specific sheet.
    """
    # The service account key is expected to be in an environment variable.
    gs = gsheets.connect()
    sheet = gs.url(spreadsheet_url)

    if sheet_name is None:
        gid = _get_gid_from_url(spreadsheet_url)
        try:
            worksheet = sheet.worksheet(gid=gid)
        except Exception:
            # Fallback to the first sheet if gid is not found
            worksheet = sheet.worksheet(0)
    else:
        worksheet = sheet.worksheet(sheet_name)

    data = worksheet.to_frame()
    return data.to_dict(orient='records')

if __name__ == '__main__':
    # Example usage for testing
    rlb_url = "https://docs.google.com/spreadsheets/d/1nHT_7GwWg5WsPT89xzpCfMFBw3bxjGaTagrP2FLz-_Y/edit?gid=2026344191#gid=2026344191"
    ulb_url = "https://docs.google.com/spreadsheets/d/1gVxO92Rh1b9s1FcRYiTAB3W0GaCWJ7XkT6nYoJjz6lA/edit?gid=2088390302#gid=2088390302"

    # It's not clear from the prompt what the sheet names are, so I'll assume the first sheet.
    # I might need to clarify this with the user later.
    rlb_data = get_data_from_sheet(rlb_url, 0)
    ulb_data = get_data_from_sheet(ulb_url, 0)

    print("RLB Data:")
    print(rlb_data)
    print("\nULB Data:")
    print(ulb_data)
