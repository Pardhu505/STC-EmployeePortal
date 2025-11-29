import logging
import re
import base64
import urllib.parse
import json
from datetime import datetime, timezone
from typing import Optional


from fastapi import APIRouter, HTTPException, Depends, Body, Header, Request, File, UploadFile
from passlib.context import CryptContext

from database import stc_db, chat_db, grid_fs, get_grid_fs, sanitize_team
from models import (
    UserProfileUpdate, LoginRequest, SignupRequest, PasswordChangeRequest, AdminUserUpdate,
    AdminPasswordReset, Employee, EmployeeCreate, get_user_info_with_collection, get_current_admin_user,
    serialize_document, TEAMS
) 
from chat import manager

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
@router.post("/login")
async def login(request: LoginRequest):
    # Search across all team collections by id or email
    collection_names = await stc_db.list_collection_names()
    team_collections = [stc_db[name] for name in collection_names]
    user = None
    for collection in team_collections:
        # Try by id first
        user = await collection.find_one({"id": request.identifier})
        if user:
            break
        # Then by email
        user = await collection.find_one({"email": request.identifier})
        if user:
            break

    if not user:
        raise HTTPException(status_code=400, detail="Invalid credentials")
    password_hash = user.get("password_hash")
    if not password_hash:
        raise HTTPException(status_code=400, detail="Invalid credentials")
    if not pwd_context.verify(request.password, password_hash):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    # --- ADDED: Check if the user account is active ---
    # If 'active' is False, deny login. Treat missing 'active' field as active.
    if user.get("active") is False:
        raise HTTPException(status_code=403, detail="Account is deactivated. Please contact an administrator.")

    # Set user status to online and broadcast it immediately upon successful login
    user_id = user.get("email") or user.get("id")
    await manager.broadcast_status(user_id, "online")

    user_data = {k: v for k, v in user.items() if k != "password_hash"}    
    user_data = serialize_document(user_data)
    
    # Ensure profilePicture is included, even if it's null
    if 'profilePicture' not in user_data:
        user_data['profilePicture'] = None
    return user_data



@router.post("/signup")
async def signup(request: SignupRequest):
    if len(request.password) > 72:
        raise HTTPException(status_code=400, detail="Password cannot exceed 72 characters.")

    # Add validation for email format
    if not re.match(r"[^@]+@[^@]+\.[^@]+", request.email):
        raise HTTPException(status_code=400, detail="Password cannot exceed 72 characters.")

    if request.team not in TEAMS:
        raise HTTPException(status_code=400, detail=f"Invalid team. Must be one of: {', '.join(TEAMS)}")

    # Check existence across all team collections
    collection_names = await stc_db.list_collection_names()
    team_collections = [stc_db[name] for name in collection_names]
    existing = None
    for collection in team_collections:
        existing = await collection.find_one({"email": request.email})
        if existing:
            break

    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    hashed = pwd_context.hash(request.password)
    
    # Set department: use provided or fallback to team
    dept = request.department if request.department else request.team
    # Set designation: use provided or default
    desig = request.designation if request.designation else "Employee"
    
    # --- Calculate Reviewer ---
    new_reviewer = "Not Assigned"
    try:
        # 1. Define the reviewer hierarchy maps
        reporting_manager_reviewers_map = {
            "Research": "Alimpan Banerjee , Anant Tiwari", "Media": "Anant Tiwari", "Data": "Anant Tiwari",
            "Digital Production": "Anant Tiwari", "Digital Communication": "Anant Tiwari", "Propagation": "Lokesh Mathur",
            "Neagitive Propagation": "Anant Tiwari", "Digital Marketing/Networking": "Saumitra, Anurag", "HIVE": "Anant Tiwari",
            "Campaign": "Anant Tiwari, Alimpan Banerjee", "Soul Central": "Alimpan Banerjee", "Field Team AP-1": "Alimpan Banerjee",
            "Field Team AP-2": "Alimpan Banerjee", "Field Team TG": "Alimpan Banerjee", "PMU": "Alimpan Banerjee",
            "Directors Team-1": "Anant Tiwari, Alimpan Banerjee", "Directors Team-2": "Anant Tiwari, Alimpan Banerjee",
            "Directors Team-3": "Anant Tiwari, Alimpan Banerjee", "HR": "Robbin Sharma, Anant Tiwari, Alimpan Banerjee, Khushboo Sharma",
            "Operations": "Robbin Sharma, Anant Tiwari, Alimpan Banerjee, Khushboo Sharma", "System Admin": "Management"
        }

        # 2. Find the reporting manager for the new user's team
        team_reporting_manager = None
        all_collections = await stc_db.list_collection_names()
        for name in all_collections:
            collection = stc_db[name]
            # Find a user in the same team with the designation of "reporting manager"
            manager = await collection.find_one({
                "team": request.team,
                "designation": {"$regex": "reporting manager", "$options": "i"}
            })
            if manager:
                team_reporting_manager = manager.get("name")
                break
        
        # 3. Assign reviewer based on designation
        if desig.lower().strip() == "reporting manager":
            # The new user is a reporting manager, their reviewer is from the map.
            new_reviewer = reporting_manager_reviewers_map.get(request.team, "Management")
        elif desig.lower().strip() == "employee":
            # The new user is an employee, their reviewer is their team's reporting manager.
            if team_reporting_manager:
                new_reviewer = team_reporting_manager
            else:
                logging.warning(f"No reporting manager found for team '{request.team}' during signup for {request.email}.")
        
        if not new_reviewer:
            new_reviewer = "Not Assigned"

    except Exception as e:
        logging.error(f"Error calculating reviewer during signup for {request.email}: {e}")

    # Handle date of birth
    dob = None
    if request.date_of_birth:
        try:
            dob = datetime.strptime(request.date_of_birth, '%Y-%m-%d').replace(tzinfo=timezone.utc)
        except ValueError:
            logging.warning(f"Invalid date_of_birth format during signup: {request.date_of_birth}")

    employee_data = EmployeeCreate(
        id=request.email,
        name=request.name,
        email=request.email,
        designation=desig,
        department=dept,
        team=request.team,
        empCode=request.empCode,
        phone=request.phone,
        emergency_contact=request.emergency_contact,
        date_of_birth=dob,
        profilePicture=request.profilePicture,
        password_hash=hashed,
        reviewer=new_reviewer # Assign the calculated reviewer
    )
    
    # Insert into team-specific collection (auto-creates if missing)
    team_collection = stc_db[sanitize_team(request.team)]
    await team_collection.insert_one(employee_data.model_dump())

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

@router.get("/employees/search")
async def search_employees_by_name(query: str):
    """
    Searches for employees by name for autocomplete/suggestion features. Performs a
    case-insensitive search for names that contain the query string.
    """
    if not query:
        return []

    search_regex = re.compile(f"{re.escape(query)}", re.IGNORECASE)
    matching_employees = []
    
    collection_names = await stc_db.list_collection_names()
    for name in collection_names:
        if name.startswith('system.'):
            continue
        collection = stc_db[name]
        # Search in both 'name' and 'Name' fields for flexibility
        async for user in collection.find({"$or": [{"name": search_regex}, {"Name": search_regex}]}, {"_id": 0, "password_hash": 0}):
            matching_employees.append(user)
            
    return serialize_document(matching_employees)

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

@router.get("/employees/work-details")
async def get_employees_work_details(email: Optional[str] = None):
    """
    Gets all employees and enriches their data with reviewer info.
    If an email is provided, it returns the details for only that employee.
    """
    try:
        # Collect all employees from all collections
        all_employees_dict = {}
        collection_names = await stc_db.list_collection_names()
        for name in collection_names:
            try:
                collection = stc_db[name]
                users = await collection.find({}, {"_id": 0, "password_hash": 0}).to_list(None)
                for user in users:
                    if user.get("email"):
                        all_employees_dict[user["email"]] = user
            except Exception as e:
                logging.warning(f"Could not fetch employees from {name}: {e}")

        all_employees = list(all_employees_dict.values())

        # Create a map of employee names to their full data for easy lookup
        employee_by_name = {emp.get("name"): emp for emp in all_employees if emp.get("name")}
        # Create a map of Zonal Managers to their reviewers
        zonal_manager_reviewers = {name: data.get("reviewer") for name, data in employee_by_name.items() if data.get("designation", "").lower().strip() == "zonal managers"}

        # Define the specific reviewers for each team's reporting manager
        reporting_manager_reviewers = {
            "Research": "Alimpan Banerjee, Anant Tiwari",
            "Media": "Anant Tiwari",
            "Data": "Anant Tiwari",
            "Digital Production": "Anant Tiwari",
            "Digital Communication": "Anant Tiwari",
            "Propagation": "Lokesh Mathur",
            "Neagitive Propagation": "Anant Tiwari",
            "Digital Marketing/Networking": "Saumitra, Anurag",
            "HIVE": "Anant Tiwari",
            "Campaign": "Anant Tiwari, Alimpan Banerjee",
            "Soul Central": "Alimpan Banerjee",
            "Field Team AP-1": "Alimpan Banerjee",
            "Field Team AP-2": "Alimpan Banerjee",
            "Field Team TG": "Alimpan Banerjee",
            "PMU": "Alimpan Banerjee",
            "Directors Team-1": "Anant Tiwari, Alimpan Banerjee",
            "Directors Team-2": "Anant Tiwari, Alimpan Banerjee",
            "Directors Team-3": "Anant Tiwari, Alimpan Banerjee",
            "HR": "Robbin Sharma, Anant Tiwari, Alimpan Banerjee, Khushboo Sharma",
            "Operations": "Robbin Sharma, Anant Tiwari, Alimpan Banerjee, Khushboo Sharma",
            "System Admin": "Management"
        }

        # Create a map of each team to its reporting manager(s).
        reporting_managers_by_team = {}
        for emp in all_employees:
            designation = emp.get("designation", "").lower()
            team_name = emp.get("team")
            if designation == "reporting manager" and team_name:
                if team_name not in reporting_managers_by_team:
                    reporting_managers_by_team[team_name] = []
                reporting_managers_by_team[team_name].append(emp.get("name"))

        processed_employees = []
        for emp in all_employees:
            enriched_emp = emp.copy()
            designation = enriched_emp.get("designation", "").lower().strip()
            team = enriched_emp.get("team")
            reviewer = enriched_emp.get("reviewer") # Keep existing reviewer if present
            original_reviewer = reviewer  # For logging

            # Step 1: Handle specific role assignments first.
            if designation == "reporting manager":
                # Assign specific reviewers based on the manager's team.
                enriched_emp["reviewer"] = reporting_manager_reviewers.get(team, "Management")
            
            # Step 2: Handle hierarchical assignments for employees and zonal managers.
            elif designation in ["employee", "zonal manager", "zonal managers"]:
                # Only assign a reviewer if one isn't already set.
                if not reviewer:
                    # If an employee's reviewer is a Zonal Manager, get the ZM's reviewer.
                    if designation == "employee" and reviewer and reviewer in zonal_manager_reviewers:
                        enriched_emp["reviewer"] = zonal_manager_reviewers.get(reviewer)
                        print(f"Re-assigning reviewer for '{enriched_emp.get('name')}': from ZM '{reviewer}' to '{enriched_emp['reviewer']}'")
                    elif team and team in reporting_managers_by_team:
                        enriched_emp["reviewer"] = ", ".join(sorted(reporting_managers_by_team[team]))
            
            # Step 3: Final fallback for any unassigned reviewers.
            # This covers directors and any other roles.
            # It also catches employees/ZMs whose teams have no reporting manager.
            if not enriched_emp.get("reviewer"):
                enriched_emp["reviewer"] = "Not Assigned"
            
            if enriched_emp.get("reviewer") != original_reviewer:
                print(f"Reviewer for '{enriched_emp.get('name')}' ({designation}) changed from '{original_reviewer}' to '{enriched_emp.get('reviewer')}'")

            processed_employees.append(enriched_emp)

        # If an email is provided, filter for that user
        if email:
            user_details = next((e for e in processed_employees if e.get("email") == email), None)
            # Always return an array, even if it's a single user or empty
            if user_details:
                return serialize_document([user_details])
            else:
                return []
        
        return serialize_document(processed_employees)
    except Exception as e:
        logging.error(f"Error fetching work-details: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch employees work details")

async def _update_all_employee_reviewers_logic():
    """
    Core logic to calculate and update the 'reviewer' field for all employees.
    This helper function is used by both the signup process and the admin endpoint.
    """
    try:
        # 1. Collect all employees from all team collections
        all_employees_dict = {}
        collection_names = await stc_db.list_collection_names()
        for name in collection_names:
            collection = stc_db[name]
            users = await collection.find({}, {"_id": 0, "password_hash": 0}).to_list(None)
            for user in users:
                if user.get("email"):
                    all_employees_dict[user["email"]] = user

        all_employees = list(all_employees_dict.values())

        # 2. Calculate reviewers
        employee_by_name = {emp.get("name"): emp for emp in all_employees if emp.get("name")}
        zonal_manager_reviewers = {name: data.get("reviewer") for name, data in employee_by_name.items() if data.get("designation", "").lower().strip() == "zonal managers"}

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
            if designation == "reporting manager" and team_name:
                if team_name not in reporting_managers_by_team:
                    reporting_managers_by_team[team_name] = []
                reporting_managers_by_team[team_name].append(emp.get("name"))

        updated_count = 0
        for emp in all_employees:
            new_reviewer = emp.get("reviewer") # Start with existing
            designation = emp.get("designation", "").lower().strip()
            team = emp.get("team")

            if designation == "reporting manager":
                new_reviewer = reporting_manager_reviewers.get(team, "Management")
            elif designation in ["employee", "zonal manager", "zonal managers"]:
                # Assign a reviewer if one isn't set or is the default placeholder.
                current_reviewer = emp.get("reviewer")
                if not current_reviewer or current_reviewer == "Not Assigned":
                    if designation == "employee" and current_reviewer and current_reviewer in zonal_manager_reviewers:
                        new_reviewer = zonal_manager_reviewers.get(emp.get("reviewer"))
                    elif team and team in reporting_managers_by_team:
                        new_reviewer = ", ".join(sorted(reporting_managers_by_team[team]))

            if not new_reviewer:
                new_reviewer = "Not Assigned"

            # 3. Update the employee record in the database if the reviewer has changed
            if new_reviewer != emp.get("reviewer"):
                _user, collection = await get_user_info_with_collection(stc_db, emp["email"])
                if collection:
                    result = await collection.update_one(
                        {"email": emp["email"]},
                        {"$set": {"reviewer": new_reviewer}}
                    )
                    if result.modified_count > 0:
                        updated_count += 1
                        logging.info(f"Updated reviewer for {emp['name']} to '{new_reviewer}'")

        return updated_count
    except Exception as e:
        logging.error(f"Error updating employee reviewers: {e}", exc_info=True)
        # Re-raise the exception so the caller can handle it
        raise

@router.post("/employees/update-reviewers", status_code=200)
async def update_all_employee_reviewers():
    """
    Administrative endpoint to trigger the calculation and update of the 'reviewer'
    field for all employees in the database.
    """
    try:
        updated_count = await _update_all_employee_reviewers_logic()
        return {"message": f"Reviewer update process completed. {updated_count} employees updated."}
    except Exception:
        # The error is already logged by the helper function
        raise HTTPException(status_code=500, detail="An internal error occurred while updating employee reviewers.")

@router.put("/users/me/deactivate")
@router.delete("/users/me")
async def deactivate_self( authorization: str = Header(..., alias="Authorization"),):
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
