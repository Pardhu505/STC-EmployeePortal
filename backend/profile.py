import logging
import re
import base64
import urllib.parse
import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, Body, Header, Request, File, UploadFile
from passlib.context import CryptContext

from database import stc_db, chat_db, grid_fs, get_grid_fs, sanitize_team
from models import (
    UserProfileUpdate, LoginRequest, SignupRequest, PasswordChangeRequest, AdminUserUpdate,
    AdminPasswordReset, Employee, get_user_info_with_collection, get_current_admin_user,
    serialize_document, TEAMS
)

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@router.post("/login")
async def login(request: LoginRequest):
    user, _ = await get_user_info_with_collection(stc_db, request.identifier, include_hash=True)

    if not user or not user.get("password_hash") or not pwd_context.verify(request.password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    if user.get("active") is False:
        raise HTTPException(status_code=403, detail="Account is deactivated. Please contact an administrator.")

    user_data = {k: v for k, v in user.items() if k != "password_hash"}
    user_data = serialize_document(user_data)
    
    if 'profilePicture' not in user_data:
        user_data['profilePicture'] = None
    return user_data

@router.post("/signup")
async def signup(request: SignupRequest):
    if len(request.password) > 72:
        raise HTTPException(status_code=400, detail="Password cannot exceed 72 characters.")
    if not re.match(r"[^@]+@[^@]+\.[^@]+", request.email):
        raise HTTPException(status_code=400, detail="Invalid email format.")
    if request.team not in TEAMS:
        raise HTTPException(status_code=400, detail=f"Invalid team. Must be one of: {', '.join(TEAMS)}")

    existing_user, _ = await get_user_info_with_collection(stc_db, request.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")

    hashed_password = pwd_context.hash(request.password)
    
    new_employee = {
        "id": request.email,
        "name": request.name,
        "email": request.email,
        "designation": request.designation or "Employee",
        "department": request.department or request.team,
        "team": request.team,
        "empCode": request.empCode,
        "password_hash": hashed_password,
        "phone": request.phone,
        "emergency_contact": request.emergency_contact,
        "date_of_birth": request.date_of_birth,
        "profilePicture": request.profilePicture,
        "active": True,
        "reviewer": "Not Assigned" # Placeholder, can be updated later
    }
    
    team_collection = stc_db[sanitize_team(request.team)]
    await team_collection.insert_one(new_employee)

    return {"message": "User created successfully"}

@router.put("/users/{email}/profile")
async def update_user_profile(email: str, profile_data: UserProfileUpdate):
    user, collection = await get_user_info_with_collection(stc_db, email)
    if not user or collection is None:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = profile_data.model_dump(exclude_unset=True)
    if 'date_of_birth' in update_data and isinstance(update_data['date_of_birth'], str):
        try:
            dob_str = update_data['date_of_birth']
            update_data['date_of_birth'] = datetime.strptime(dob_str.split('T')[0], '%Y-%m-%d').replace(tzinfo=timezone.utc)
        except (ValueError, TypeError):
            logging.warning(f"Could not parse date_of_birth: {update_data['date_of_birth']}")

    new_email = update_data.get("email")
    if new_email and new_email.lower() != email.lower():
        existing_user, _ = await get_user_info_with_collection(stc_db, new_email)
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already in use.")
        update_data['id'] = new_email

    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided.")

    await collection.update_one(
        {"email": re.compile(f"^{re.escape(email)}$", re.IGNORECASE)},
        {"$set": update_data}
    )

    if new_email and new_email.lower() != email.lower():
        await chat_db.employees.update_one(
            {"email": re.compile(f"^{re.escape(email)}$", re.IGNORECASE)},
            {"$set": {"email": new_email, "id": new_email}}
        )

    final_email_to_find = new_email or email
    updated_user = await collection.find_one(
        {"email": re.compile(f"^{re.escape(final_email_to_find)}$", re.IGNORECASE)},
        {"_id": 0, "password_hash": 0}
    )
    return serialize_document(updated_user)

@router.put("/users/me/reset-password")
async def user_reset_password(request: PasswordChangeRequest = Body(...), authorization: str = Header(..., alias="Authorization")):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token_str = authorization.split(" ")[1]
    try:
        decoded_token_bytes = base64.b64decode(token_str)
        decoded_token = decoded_token_bytes.decode('utf-8')
        user_data = json.loads(decoded_token)
        user_email = user_data.get("email")
        logging.info(f"Successfully decoded token for user: {user_email}")
    except (base64.binascii.Error, UnicodeDecodeError) as e:
        logging.error(f"Token decoding failed (Base64 or UTF-8 issue) for token: {token_str[:50]}... Error: {e}")
        raise HTTPException(status_code=400, detail="Invalid token format (decoding failed).")
    except json.JSONDecodeError as e:
        logging.error(f"Token JSON parsing failed for token: {decoded_token[:50]}... Error: {e}")
        raise HTTPException(status_code=400, detail="Invalid token format (JSON parsing failed).")
    except Exception as e: # Catch any other unexpected errors during token processing
        logging.error(f"Unexpected error during token processing: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail="Invalid token.")

    if not user_email:
        logging.warning(f"Invalid token: 'email' field missing from decoded user data: {user_data}")
        raise HTTPException(status_code=400, detail="Invalid token: no email found")

    user, collection = await get_user_info_with_collection(stc_db, user_email, include_hash=True)
    if not user or collection is None:
        raise HTTPException(status_code=404, detail="User not found")

    stored_hash = user.get("password_hash")
    if not stored_hash:
        raise HTTPException(status_code=500, detail="User account is missing password information. Please contact an administrator.")
    if not pwd_context.verify(request.current_password, stored_hash):
        raise HTTPException(status_code=403, detail="Current password is incorrect")

    new_hash = pwd_context.hash(request.new_password)
    await collection.update_one(
        {"email": re.compile(f"^{re.escape(user_email)}$", re.IGNORECASE)},
        {"$set": {"password_hash": new_hash}}
    )
    return {"message": "Password reset successful"}

@router.get("/employees")
async def get_all_employees():
    all_employees = {}
    sanitized_team_names = [sanitize_team(team) for team in TEAMS]
    for name in sanitized_team_names:
        try:
            collection = stc_db[name]
            users = await collection.find({}, {"_id": 0, "password_hash": 0}).to_list(None)
            for user in users:
                if user.get("email"):
                    all_employees[user["email"]] = user
        except Exception as e:
            logging.warning(f"Could not fetch from collection {name}: {e}")
    return serialize_document(list(all_employees.values()))

@router.get("/employees/email/{email}")
async def get_employee_by_email(email: str):
    user, _ = await get_user_info_with_collection(stc_db, email)
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    return serialize_document(user)

@router.put("/employees/{employee_id}/profile-picture", status_code=200)
async def update_profile_picture(employee_id: str, body: UserProfileUpdate):
    user, collection = await get_user_info_with_collection(stc_db, employee_id)
    if not user or collection is None:
        raise HTTPException(status_code=404, detail="Employee not found")

    await collection.update_one(
        {"$or": [{"id": employee_id}, {"email": employee_id}]},
        {"$set": {"profilePicture": body.profilePicture}}
    )
    updated_user = await collection.find_one(
        {"$or": [{"id": employee_id}, {"email": employee_id}]},
        {"_id": 0, "password_hash": 0}
    )
    return serialize_document(updated_user)

@router.delete("/employees/{employee_id}/profile-picture", status_code=200)
async def remove_profile_picture(employee_id: str):
    user, collection = await get_user_info_with_collection(stc_db, employee_id)
    if not user or collection is None:
        raise HTTPException(status_code=404, detail="Employee not found")

    await collection.update_one(
        {"$or": [{"id": employee_id}, {"email": employee_id}]},
        {"$set": {"profilePicture": None}}
    )
    updated_user = await collection.find_one(
        {"$or": [{"id": employee_id}, {"email": employee_id}]},
        {"_id": 0, "password_hash": 0}
    )
    return serialize_document(updated_user)

@router.get("/employees/work-details/")
async def get_employees_work_details(email: str | None = None):
    """
    Gets all employees and enriches their data with reviewer info.
    If an email is provided, it returns the details for only that employee.
    """
    try:
        all_employees_dict = {}
        sanitized_team_names = [sanitize_team(team) for team in TEAMS]
        for name in sanitized_team_names:
            try:
                collection = stc_db[name]
                users = await collection.find({}, {"_id": 0, "password_hash": 0}).to_list(None)
                for user in users:
                    if user.get("email"):
                        all_employees_dict[user["email"]] = user
            except Exception as e:
                logging.warning(f"Could not fetch employees from {name}: {e}")

        all_employees = list(all_employees_dict.values())

        reporting_manager_reviewers = {
            "Research": "Alimpan Banerjee, Anant Tiwari", "Media": "Anant Tiwari", "Data": "Anant Tiwari",
            "Digital Production": "Anant Tiwari", "Digital Communication": "Anant Tiwari", "Propagation": "Lokesh Mathur",
            "Neagitive Propagation": "Anant Tiwari", "Digital Marketing/Networking": "Saumitra, Anurag", "HIVE": "Anant Tiwari",
            "Campaign": "Anant Tiwari, Alimpan Banerjee", "Soul Central": "Alimpan Banerjee", "Field Team AP-1": "Alimpan Banerjee",
            "Field Team AP-2": "Alimpan Banerjee", "Field Team TG": "Alimpan Banerjee", "PMU": "Alimpan Banerjee",
            "Directors Team-1": "Anant Tiwari, Alimpan Banerjee", "Directors Team-2": "Anant Tiwari, Alimpan Banerjee",
            "Directors Team-3": "Anant Tiwari, Alimpan Banerjee", "HR": "Robbin Sharma, Anant Tiwari, Alimpan Banerjee, Khushboo Sharma",
            "Operations": "Robbin Sharma, Anant Tiwari, Alimpan Banerjee, Khushboo Sharma", "System Admin": "Management"
        }

        reporting_managers_by_team = {}
        for emp in all_employees:
            designation = emp.get("designation", "").lower()
            team_name = emp.get("team")
            if "reporting manager" in designation and team_name:
                if team_name not in reporting_managers_by_team:
                    reporting_managers_by_team[team_name] = []
                reporting_managers_by_team[team_name].append(emp.get("name"))

        processed_employees = []
        for emp in all_employees:
            enriched_emp = emp.copy()
            designation = enriched_emp.get("designation", "").lower().strip()
            team = enriched_emp.get("team")
            
            new_reviewer = enriched_emp.get("reviewer")

            if "reporting manager" in designation:
                new_reviewer = reporting_manager_reviewers.get(team, "Management")
            elif designation in ["employee", "zonal manager", "zonal managers"]:
                if not new_reviewer: # Only assign if one isn't already set
                    if team and team in reporting_managers_by_team:
                        new_reviewer = ", ".join(sorted(reporting_managers_by_team[team]))
            
            if not new_reviewer:
                new_reviewer = "Not Assigned"
            
            enriched_emp["reviewer"] = new_reviewer
            processed_employees.append(enriched_emp)

        if email:
            user_details = next((e for e in processed_employees if e.get("email") == email), None)
            if user_details:
                return serialize_document([user_details])
            else:
                return []
        
        return serialize_document(processed_employees)
    except Exception as e:
        logging.error(f"Error fetching work-details: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch employees work details")
    
@router.put("/users/me/deactivate")
@router.delete("/users/me")
async def deactivate_self(
    authorization: str = Header(..., alias="Authorization"),
):
    """
    Allows a currently authenticated user to deactivate their own account.
    Allows a currently authenticated user to permanently delete their own account.
    The user is identified via their Authorization token.
    """
    try:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        token_str = authorization.split(" ")[1]
        decoded_token = base64.b64decode(token_str).decode('utf-8')
        user_data_from_token = json.loads(decoded_token)
        user_email = user_data_from_token.get("email")

        if not user_email:
            raise HTTPException(status_code=401, detail="Invalid token: user email missing.")

        # Find the user and their collection to mark them as inactive
        user, collection = await get_user_info_with_collection(stc_db, user_email)

        if not user or collection is None:
            raise HTTPException(status_code=404, detail="User not found.")

        # Soft delete: Mark the user as inactive instead of deleting them.
        result = await collection.update_one(
            {"email": re.compile(f"^{re.escape(user_email)}$", re.IGNORECASE)},
            {"$set": {"active": False}}
        )

        if result.modified_count > 0:
            logging.info(f"User {user_email} has deactivated their own account.")
            return {"message": "Your account has been successfully deactivated."}
        
        # This can happen if the account is already inactive
        raise HTTPException(status_code=400, detail="Account could not be deactivated. It may already be inactive.")

    except Exception as e:
        logging.error(f"Error during self-deactivation for token: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during account deactivation.")
