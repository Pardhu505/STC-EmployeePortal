import logging
import json
import base64
import re
import urllib.parse
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from passlib.context import CryptContext

from database import stc_db
from models import (
    PasswordChangeRequest,
    get_user_info_with_collection,
)

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def get_current_admin_user(authorization: Optional[str] = Header(None, alias="Authorization")):
    """
    Dependency to get and validate the current admin user from a token.
    This checks if the user associated with the token is an admin.
    If no token is provided, it returns None. If a token is provided but invalid, it raises an error.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token_str = authorization.split(" ")[1]
    logging.info(f"Admin auth attempt with token: {token_str[:100]}...") # Log token safely

    user_email_from_token = None
    try:
        # The token is a Base64-encoded JSON string of the user object.
        # First, decode from Base64, then parse the JSON.
        decoded_token = base64.b64decode(token_str).decode('utf-8')
        user_data_from_token = json.loads(decoded_token)
        user_email_from_token = user_data_from_token.get("email") if isinstance(user_data_from_token, dict) else None
    except (json.JSONDecodeError, base64.binascii.Error, AttributeError, TypeError) as e:
        logging.warning(f"Admin auth failed: Could not decode or parse token. Error: {e}. Token: {token_str[:100]}...")
        raise HTTPException(status_code=401, detail="Invalid token format.")

    if not user_email_from_token:
        logging.warning("Admin auth failed: Could not extract email from token.")
        raise HTTPException(status_code=401, detail="Invalid token: email missing.")

    user, _ = await get_user_info_with_collection(stc_db, user_email_from_token)

    if not user:
        logging.warning(f"Admin auth failed: User '{user_email_from_token}' not found in database")
        raise HTTPException(status_code=401, detail="User not found or token is invalid")

    # Check if the user exists and has an admin designation.
    # Also check the 'isAdmin' flag for robustness.
    designation = user.get("designation", "").lower().strip()
    if user.get("isAdmin") or "admin" in designation or "director" in designation:
        logging.info(f"Admin access granted for user: {user_email_from_token}")
        return user

    raise HTTPException(status_code=403, detail="User is not an administrator")


# --- Admin Routes ---

class AdminUserUpdate(BaseModel):
    """
    Pydantic model for admin updates. All fields are optional.
    """
    name: Optional[str] = None
    email: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    team: Optional[str] = None
    empCode: Optional[str] = None

    class Config:
        extra = 'ignore'

class AdminUserUpdate(AdminUserUpdate): # Inherits from the model in models.py
    pass

class AdminPasswordReset(BaseModel):
    new_password: str

@router.put("/admin/users/{original_email}/details")
async def admin_update_user_details(
    original_email: str, 
    user_data: AdminUserUpdate, 
    admin_user: dict = Depends(get_current_admin_user)
):
    """
    Admin endpoint to update a user's details.
    """
    decoded_email = urllib.parse.unquote(original_email)
    user, collection = await get_user_info_with_collection(stc_db, decoded_email)

    if not user or collection is None:
        raise HTTPException(status_code=404, detail="User not found")

    update_payload = user_data.model_dump(exclude_unset=True)

    if not update_payload:
        raise HTTPException(status_code=400, detail="No update data provided.")

    # If the email is being changed, we need to handle it carefully
    new_email = update_payload.get("email")
    if new_email and new_email.lower() != decoded_email.lower():
        # Check if the new email is already taken
        existing_user, _ = await get_user_info_with_collection(stc_db, new_email)
        if existing_user:
            raise HTTPException(status_code=400, detail="New email is already in use.")
        # Update the 'id' field as well if it's based on email
        update_payload['id'] = new_email

    await collection.update_one(
        {"email": re.compile(f"^{re.escape(decoded_email)}$", re.IGNORECASE)},
        {"$set": update_payload}
    )

    logging.info(f"Admin '{admin_user.get('email')}' updated details for user '{decoded_email}'.")
    return {"message": f"User {decoded_email} updated successfully."}

@router.delete("/admin/users/{email}")
async def admin_delete_user(email: str, admin_user: dict = Depends(get_current_admin_user)):
    """
    Admin endpoint to permanently delete a user.
    """
    decoded_email = urllib.parse.unquote(email)
    user, collection = await get_user_info_with_collection(stc_db, decoded_email)

    if not user or collection is None:
        raise HTTPException(status_code=404, detail="User not found")

    result = await collection.delete_one({"email": re.compile(f"^{re.escape(decoded_email)}$", re.IGNORECASE)})

    if result.deleted_count > 0:
        logging.info(f"Admin '{admin_user.get('email')}' permanently deleted user '{decoded_email}'.")
        return {"message": f"User {decoded_email} has been permanently deleted."}
    
    raise HTTPException(status_code=500, detail="Failed to delete user.")

@router.post("/admin/users/{email}/reset-password")
async def admin_reset_password(
    email: str, 
    password_data: AdminPasswordReset, 
    admin_user: dict = Depends(get_current_admin_user)
):
    """
    Admin endpoint to reset a user's password.
    """
    decoded_email = urllib.parse.unquote(email)
    # We pass an empty current_password because the check will be bypassed by is_admin_reset=True
    # The admin_user dependency ensures this is an authorized action.
    try:
        user, collection = await get_user_info_with_collection(stc_db, decoded_email, include_hash=True)

        if not user or collection is None:
            raise HTTPException(status_code=404, detail="User not found")

        # Hash the new password
        new_password_hash = pwd_context.hash(password_data.new_password)

        # Update the password in the database
        result = await collection.update_one(
            {"email": re.compile(f"^{re.escape(decoded_email)}$", re.IGNORECASE)},
            {"$set": {"password_hash": new_password_hash}}
        )

        if result.modified_count > 0:
            logging.info(f"Admin '{admin_user.get('email')}' reset password for user '{decoded_email}'.")
            return {"message": "Password updated successfully"}
        
        raise HTTPException(status_code=500, detail="Failed to update password, user found but no changes made.")

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error during admin password reset for {decoded_email}: {e}")
        raise HTTPException(status_code=500, detail="Failed to change password.")
