"""
essl_service.py
----------------
Calls the eSSL WebAPIService GetTransactionsLog SOAP endpoint for one or more
devices and parses the <strDataList> punch payload. Each device can live at its
OWN IP/URL (e.g. Inside on 192.168.8.251, Door on 192.168.8.71).

Config (.env) — two ways:

(A) Per-device URLs (use this when devices are on different IPs):
    ESSL_DEVICES=CEXJ232860602|http://192.168.8.251:85/iclock/webapiservice.asmx|Inside;JNP2244500022|http://192.168.8.71:85/iclock/webapiservice.asmx|Door
    ESSL_USERNAME=Showtime
    ESSL_PASSWORD=<rotated password>
    # format: SERIAL|URL|NAME , devices separated by ';'

(B) Shared URL (all serials on one server):
    ESSL_API_URL=http://192.168.8.251:85/iclock/webapiservice.asmx
    ESSL_SERIALS=CEXJ232860602,JNP2244500022
    ESSL_DEVICE_NAMES=CEXJ232860602=Inside,JNP2244500022=Door
    ESSL_USERNAME=Showtime
    ESSL_PASSWORD=<rotated password>

If ESSL_DEVICES is set it wins. Otherwise (B) is used. Username/password are
shared across devices.
"""
import os, re, html, logging
from datetime import datetime, timezone, timedelta
import requests

logger = logging.getLogger(__name__)
IST = timezone(timedelta(hours=5, minutes=30))
ESSL_DT_FMT = "%d-%m-%Y %H:%M:%S"

class ESSLConfigError(RuntimeError): pass
class ESSLRequestError(RuntimeError): pass

_SOAP_TEMPLATE = """<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetTransactionsLog xmlns="http://tempuri.org/">
      <FromDateTime>{from_dt}</FromDateTime>
      <ToDateTime>{to_dt}</ToDateTime>
      <SerialNumber>{serial}</SerialNumber>
      <UserName>{username}</UserName>
      <UserPassword>{password}</UserPassword>
      <strDataList>string</strDataList>
    </GetTransactionsLog>
  </soap:Body>
</soap:Envelope>"""

def _device_list():
    """Return list of {serial, url, name}."""
    devices = []
    raw = os.environ.get("ESSL_DEVICES")
    if raw:
        for entry in raw.split(";"):
            entry = entry.strip()
            if not entry:
                continue
            parts = [x.strip() for x in entry.split("|")]
            if len(parts) < 2:
                continue
            serial, url = parts[0], parts[1]
            name = parts[2] if len(parts) > 2 else serial
            devices.append({"serial": serial, "url": url, "name": name})
        return devices
    # Fallback: shared URL + serial list
    url = os.environ.get("ESSL_API_URL")
    serials_raw = os.environ.get("ESSL_SERIALS") or os.environ.get("ESSL_SERIAL")
    names = {}
    for pair in os.environ.get("ESSL_DEVICE_NAMES", "").split(","):
        if "=" in pair:
            k, v = pair.split("=", 1)
            names[k.strip()] = v.strip()
    if url and serials_raw:
        for s in serials_raw.split(","):
            s = s.strip()
            if s:
                devices.append({"serial": s, "url": url, "name": names.get(s, s)})
    return devices

def _creds():
    user = os.environ.get("ESSL_USERNAME")
    pwd = os.environ.get("ESSL_PASSWORD")
    if not user or not pwd:
        raise ESSLConfigError("Missing ESSL_USERNAME / ESSL_PASSWORD")
    return user, pwd

def _fetch_one(url, serial, user, pwd, from_dt, to_dt, timeout=30) -> str:
    body = _SOAP_TEMPLATE.format(from_dt=from_dt.strftime(ESSL_DT_FMT),
        to_dt=to_dt.strftime(ESSL_DT_FMT), serial=serial, username=user, password=pwd)
    headers = {"Content-Type": "text/xml; charset=utf-8",
               "SOAPAction": "http://tempuri.org/GetTransactionsLog"}
    try:
        resp = requests.post(url, data=body.encode("utf-8"), headers=headers, timeout=timeout)
    except requests.RequestException as e:
        raise ESSLRequestError(f"Could not reach device {serial} at {url}: {e}") from e
    if resp.status_code != 200:
        raise ESSLRequestError(f"Device {serial} returned HTTP {resp.status_code}: {resp.text[:200]}")
    m = re.search(r"<strDataList>(.*?)</strDataList>", resp.text, re.DOTALL)
    if not m:
        rm = re.search(r"<GetTransactionsLogResult>(.*?)</GetTransactionsLogResult>", resp.text, re.DOTALL)
        detail = rm.group(1) if rm else resp.text[:200]
        raise ESSLRequestError(f"Device {serial}: no <strDataList>. Result said: {detail}")
    return html.unescape(m.group(1))

def parse_punches(raw: str, serial: str = "", device: str = ""):
    punches = []
    for line in raw.splitlines():
        line = line.strip()
        if not line: continue
        parts = line.split("\t") if "\t" in line else re.split(r"\s{2,}", line)
        if len(parts) < 2: continue
        try:
            dt = datetime.strptime(parts[1].strip(), "%Y-%m-%d %H:%M:%S").replace(tzinfo=IST)
        except ValueError:
            continue
        punches.append({"user_id": parts[0].strip(), "punch_time": dt,
                        "serial": serial, "device": device or serial,
                        "extra": parts[2:] if len(parts) > 2 else [], "raw": line})
    return punches

def get_all_punches(from_dt: datetime, to_dt: datetime):
    """Query every configured device (each at its own URL). Returns
    (punches, reports). Resilient: one device failing doesn't stop the others;
    raises ESSLRequestError only if ALL fail."""
    devices = _device_list()
    if not devices:
        raise ESSLConfigError("No devices configured. Set ESSL_DEVICES or ESSL_API_URL+ESSL_SERIALS.")
    user, pwd = _creds()
    all_punches, reports, errors = [], [], []
    for d in devices:
        try:
            raw = _fetch_one(d["url"], d["serial"], user, pwd, from_dt, to_dt)
            p = parse_punches(raw, serial=d["serial"], device=d["name"])
            all_punches.extend(p)
            reports.append({"serial": d["serial"], "device": d["name"], "ok": True, "count": len(p)})
        except ESSLRequestError as e:
            logger.warning("Device %s failed: %s", d["serial"], e)
            reports.append({"serial": d["serial"], "device": d["name"], "ok": False,
                            "error": str(e), "count": 0})
            errors.append(str(e))
    if errors and len(errors) == len(devices):
        raise ESSLRequestError(" ; ".join(errors))
    return all_punches, reports

def get_punches(from_dt: datetime, to_dt: datetime):
    punches, _ = get_all_punches(from_dt, to_dt)
    return punches
