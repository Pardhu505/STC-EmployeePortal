import logging
import re
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional

from fastapi import APIRouter, HTTPException, Body

from database import attendance_db, stc_db
from models import EmployeeAttendance, ManagerReportRequest, serialize_document

router = APIRouter()

async def find_manager_details_by_code(emp_code: str, stc_db):
    manager = None
    collection_names = await stc_db.list_collection_names()
    team_collections = [stc_db[name] for name in collection_names]
    emp_code_regex = re.compile(f"^{re.escape(emp_code)}$", re.IGNORECASE)

    for collection in team_collections:
        manager = await collection.find_one({"$or": [{"empCode": emp_code_regex}, {"Emp code": emp_code_regex}]})
        if manager:
            break

    if not manager:
        return {"managerName": None, "managerId": None, "team": []}

    manager_name = manager.get("name") or manager.get("Name", "Unknown Manager")
    manager_designation = (manager.get("designation") or manager.get("Designation", "")).lower().strip()

    team_list = []
    is_manager_by_designation = "manager" in manager_designation

    if manager_name:
        for collection in team_collections:
            manager_name_regex = re.compile(f"^{re.escape(manager_name)}$", re.IGNORECASE)
            team_members = await collection.find(
                {"reviewer": manager_name_regex},
                {"_id": 0, "password_hash": 0}
            ).to_list(length=None)

            for emp in team_members:
                emp_email = emp.get("email") or emp.get("Email ID")
                if emp_email and not any(e.get("email") == emp_email for e in team_list):
                    team_list.append({
                        "Name": emp.get("name") or emp.get("Name"),
                        "empCode": emp.get("empCode") or emp.get("Emp code", ""),
                        "Designation": emp.get("designation") or emp.get("Designation", ""),
                        "Reviewer": emp.get("reviewer") or emp.get("Reviewer", ""),
                        "email": emp_email
                    })

    if not is_manager_by_designation and not team_list and "director" not in manager_designation:
        return {"managerName": None, "managerId": None, "team": []}

    manager_id = manager.get("empCode") or manager.get("Emp code")
    if not any(e.get("empCode") == manager_id for e in team_list if e.get("empCode")):
        team_list.insert(0, {
            "Name": manager_name,
            "empCode": manager_id or "",
            "Designation": manager_designation,
            "Reviewer": manager.get("reviewer") or manager.get("Reviewer", ""),
            "email": manager.get("email") or manager.get("Email ID")
        })

    return {"managerName": manager_name, "managerId": manager_id, "team": team_list}

@router.post("/attendance-report")
async def save_attendance_report(employees: List[EmployeeAttendance] = Body(...)):
    try:
        for employee_data in employees:
            employee_dict = employee_data.model_dump()
            existing_employee = await attendance_db.Attendance.find_one({"empCode": employee_data.empCode})
            if existing_employee:
                await attendance_db.Attendance.update_one(
                    {"empCode": employee_data.empCode},
                    {"$push": {"dailyRecords": {"$each": employee_dict['dailyRecords']}}}
                )
            else:
                await attendance_db.Attendance.insert_one(employee_dict)
        return {"message": "Attendance data saved or updated successfully"}
    except Exception as e:
        logging.error(f"Error saving attendance data: {e}")
        raise HTTPException(status_code=500, detail=f"Error saving data: {e}")

@router.get("/attendance-report")
async def get_attendance_report(view_type: Optional[str] = None, year: Optional[int] = None, month: Optional[int] = None, date: Optional[str] = None):
    try:
        pipeline = []
        if view_type == 'month' and year and month:
            pipeline.extend([
                {"$unwind": "$dailyRecords"},
                {"$match": {
                    "dailyRecords.date": {
                        "$gte": datetime(year, month, 1, tzinfo=timezone.utc),
                        "$lt": datetime(year, month + 1, 1, tzinfo=timezone.utc) if month < 12 else datetime(year + 1, 1, 1, tzinfo=timezone.utc)
                    }
                }},
                {"$group": {
                    "_id": "$empCode", "empName": {"$first": "$empName"}, "dailyRecords": {"$push": "$dailyRecords"},
                    "P": {"$sum": {"$cond": [{"$eq": ["$dailyRecords.status", "P"]}, 1, 0]}},
                    "A": {"$sum": {"$cond": [{"$eq": ["$dailyRecords.status", "A"]}, 1, 0]}},
                    "H": {"$sum": {"$cond": [{"$in": ["$dailyRecords.status", ["H", "Holiday"]]}, 1, 0]}},
                    "L": {"$sum": {"$cond": [{"$and": [{"$eq": ["$dailyRecords.status", "P"]}, {"$ne": ["$dailyRecords.lateBy", "00:00"]}, {"$ne": ["$dailyRecords.lateBy", None]}]}, 1, 0]}}
                }},
                {"$project": {"_id": 0, "empCode": "$_id", "empName": 1, "dailyRecords": 1, "P": 1, "A": 1, "H": 1, "L": 1}}
            ])
        elif view_type == 'day' and date:
            try:
                target_date = datetime.strptime(date, '%Y-%m-%d')
                pipeline.append({"$project": {"empCode": 1, "empName": 1, "dailyRecords": {"$filter": {"input": "$dailyRecords", "as": "record", "cond": {"$and": [{"$eq": [{"$year": "$$record.date"}, target_date.year]}, {"$eq": [{"$month": "$$record.date"}, target_date.month]}, {"$eq": [{"$dayOfMonth": "$$record.date"}, target_date.day]}]}}}}})
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

        records = await attendance_db.Attendance.aggregate(pipeline).to_list(length=None) if pipeline else await attendance_db.Attendance.find().to_list(length=None)
        return {"data": serialize_document(records), "count": len(records)}
    except Exception as e:
        logging.error(f"Failed to fetch attendance report: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch attendance data: {e}")

@router.get("/attendance-report/user/{employee_code}")
async def get_user_attendance_report(employee_code: str, view_type: str, year: int = None, month: int = None, date: str = None):
    try:
        pipeline: List[Dict] = [{"$match": {"empCode": employee_code}}]
        
        if view_type == 'month' and year and month:
            pipeline.append({"$project": {"empCode": "$empCode", "empName": "$empName", "dailyRecords": {"$filter": {"input": "$dailyRecords", "as": "record", "cond": {"$and": [{"$eq": [{"$year": "$$record.date"}, year]}, {"$eq": [{"$month": "$$record.date"}, month]}]}}}}})
        elif view_type == 'day' and date:
            target_date = datetime.strptime(date, '%Y-%m-%d')
            pipeline.append({"$project": {"empCode": "$empCode", "empName": "$empName", "dailyRecords": {"$filter": {"input": "$dailyRecords", "as": "record", "cond": {"$and": [{"$eq": [{"$year": "$$record.date"}, target_date.year]}, {"$eq": [{"$month": "$$record.date"}, target_date.month]}, {"$eq": [{"$dayOfMonth": "$$record.date"}, target_date.day]}]}}}}})
        elif view_type == 'week' and date:
            target_date = datetime.strptime(date, '%Y-%m-%d')
            start_of_week = target_date - timedelta(days=target_date.weekday())
            end_of_week = start_of_week + timedelta(days=6)
            pipeline.append({"$project": {"empCode": "$empCode", "empName": "$empName", "dailyRecords": {"$filter": {"input": "$$ROOT.dailyRecords", "as": "record", "cond": {"$and": [{"$gte": ["$$record.date", start_of_week]}, {"$lte": ["$$record.date", end_of_week]}]}}}}})
        else:
            raise HTTPException(status_code=400, detail="Invalid query parameters.")

        employee_data = await attendance_db.Attendance.aggregate(pipeline).to_list(length=None)
        if not employee_data:
            raise HTTPException(status_code=404, detail=f"No attendance data found for employee {employee_code} and the specified period.")

        return serialize_document(employee_data[0])
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    except Exception as e:
        logging.error(f"Failed to fetch attendance report for user: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch attendance data: {e}")

@router.get("/manager/{manager_code}/team")
async def get_manager_team(manager_code: str):
    try:
        details = await find_manager_details_by_code(manager_code, stc_db)
        if not details["managerName"]:
            raise HTTPException(status_code=404, detail="Manager not found")
        return details
    except Exception as e:
        logging.error(f"Failed to get manager team: {e}")
        raise HTTPException(status_code=500, detail="Failed to get manager team")

@router.post("/attendance-report/manager")
async def get_manager_attendance_report(request: ManagerReportRequest):
    try:
        team_employee_codes = request.team_emp_codes
        if not team_employee_codes:
            return {"teamRecords": []}

        coll = attendance_db["Attendance"]
        pipeline = [{"$match": {"empCode": {"$in": team_employee_codes}}}]

        if request.reportType == "day" and request.date and request.endDate:
            start_date = datetime.fromisoformat(request.date.split('T')[0] + 'T00:00:00.000Z')
            end_date = datetime.fromisoformat(request.endDate.split('T')[0] + 'T23:59:59.999Z')
            pipeline += [
                {"$unwind": "$dailyRecords"},
                {"$match": {"dailyRecords.date": {"$gte": start_date, "$lte": end_date}}},
                {"$group": {"_id": "$empCode", "empName": {"$first": "$empName"}, "dailyRecords": {"$push": "$dailyRecords"}}},
                {"$project": {"_id": 0, "empCode": "$_id", "empName": 1, "dailyRecords": 1}}
            ]
        elif request.reportType == "month" and request.year and request.month:
            start = datetime(request.year, request.month, 1)
            end = (start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            pipeline += [
                {"$unwind": "$dailyRecords"},
                {"$match": {"dailyRecords.date": {"$gte": start.replace(tzinfo=timezone.utc), "$lte": end.replace(tzinfo=timezone.utc)}}},
                {"$group": {
                    "_id": "$empCode", "empName": {"$first": "$empName"},
                    "P": {"$sum": {"$cond": [{"$eq": ["$dailyRecords.status", "P"]}, 1, 0]}},
                    "A": {"$sum": {"$cond": [{"$eq": ["$dailyRecords.status", "A"]}, 1, 0]}},
                    "L": {"$sum": {"$cond": {"if": {"$gt": ["$dailyRecords.lateBy", "00:00"]}, "then": 1, "else": 0}}},
                    "dailyRecords": {"$push": "$dailyRecords"}
                }},
                {"$project": {"_id": 0, "empCode": "$_id", "empName": 1, "P": 1, "A": 1, "L": 1, "dailyRecords": 1}},
            ]
        else:
            raise HTTPException(status_code=400, detail="Invalid query parameters.")

        records = await coll.aggregate(pipeline).to_list(length=None)
        return {"teamRecords": records}
    except Exception as e:
        logging.error(f"Manager report failed: {e}")
        raise HTTPException(status_code=500, detail=f"Manager report failed: {e}")