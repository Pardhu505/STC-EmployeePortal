"""
essl_office_agent.py
---------------------
Runs INSIDE your office network (on any always-on Windows/Linux box that can
reach the eSSL devices). It polls BOTH devices and writes punches to the SAME
MongoDB Atlas your AWS portal uses. The AWS portal then serves them with
ESSL_SOURCE=store (it never talks to the devices itself).

Install (once):
    pip install requests pymongo python-dotenv

Put an .env next to this file:
    ATTENDANCE_MONGO_URL=<same Atlas string the portal uses>
    ESSL_API_URL=http://192.168.8.251:85/iclock/webapiservice.asmx
    ESSL_SERIALS=CEXJ232860602,JNP2244500022
    ESSL_USERNAME=Showtime
    ESSL_PASSWORD=<rotated password>
    ESSL_DEVICE_NAMES=CEXJ232860602=Inside,JNP2244500022=Door
    ESSL_POLL_SECONDS=120

Run:
    python essl_office_agent.py

Keep it running via Windows Task Scheduler (at startup) or a Linux systemd
service. It reuses essl_service.py, so keep that file alongside this one.
"""
import os, sys, time, logging
from datetime import datetime, timedelta

from pymongo import MongoClient, UpdateOne
from dotenv import load_dotenv
from essl_service import get_all_punches, IST, ESSLConfigError, ESSLRequestError

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("essl-office-agent")

POLL = int(os.environ.get("ESSL_POLL_SECONDS", "120"))
MONGO_URL = os.environ.get("ATTENDANCE_MONGO_URL")
if not MONGO_URL:
    log.error("ATTENDANCE_MONGO_URL not set"); sys.exit(1)

client = MongoClient(MONGO_URL, tlsAllowInvalidCertificates=True)
col = client["employee_attendance"]["biometric_punches"]
try:
    col.drop_index("uniq_punch")
except Exception:
    pass
col.create_index([("user_id", 1), ("punch_time", 1), ("serial", 1)],
                 unique=True, name="uniq_punch_dev")

def sync_once():
    now = datetime.now(IST)
    start = now - timedelta(hours=6)   # rolling window, catches late rows
    try:
        punches, reports = get_all_punches(start, now)
    except ESSLConfigError as e:
        log.error("Config error: %s", e); return
    except ESSLRequestError as e:
        log.warning("All devices unreachable: %s", e); return
    for r in reports:
        if not r.get("ok"):
            log.warning("Device %s offline: %s", r.get("device"), r.get("error"))
    if not punches:
        log.info("No punches in window."); return
    ops = [UpdateOne(
        {"user_id": p["user_id"], "punch_time": p["punch_time"], "serial": p["serial"]},
        {"$setOnInsert": {"user_id": p["user_id"], "punch_time": p["punch_time"],
                          "serial": p["serial"], "device": p["device"],
                          "extra": p["extra"], "source": "essl"}},
        upsert=True) for p in punches]
    res = col.bulk_write(ops, ordered=False)
    log.info("window %s..%s fetched=%d new=%d",
             start.strftime("%H:%M"), now.strftime("%H:%M"), len(punches), res.upserted_count)

if __name__ == "__main__":
    log.info("office agent started; polling every %ds", POLL)
    while True:
        sync_once()
        time.sleep(POLL)
