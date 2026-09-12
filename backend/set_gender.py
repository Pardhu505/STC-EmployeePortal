"""
set_gender.py
-------------
Set an employee's gender so the winner scene shows the right devotee.

The scene is chosen from the champion's stored gender. Employee records have no
gender field yet, so everyone defaults to 'male'. Use this to fill it in for
specific people now; longer term add a 'gender' column to the users Google Sheet
and run sync_users_from_sheet.py.

Usage (on the server, from backend/):
    python set_gender.py female vidya.kolati@showtimeconsulting.in
    python set_gender.py female a@x.in b@x.in c@x.in
    python set_gender.py male  someone@x.in

Updates BOTH the employee record (used for future score submissions) and the
existing leaderboard row (so the scene changes immediately).
"""
import sys, asyncio
from database import stc_db, attendance_db

async def main():
    if len(sys.argv) < 3 or sys.argv[1] not in ("male", "female"):
        print(__doc__); sys.exit(1)
    gender = sys.argv[1]
    emails = [e.strip().lower() for e in sys.argv[2:]]
    scores = attendance_db["game_scores"]
    for email in emails:
        users = 0
        for c in await stc_db.list_collection_names():
            if c.startswith("system."):
                continue
            r = await stc_db[c].update_one(
                {"email": {"$regex": f"^{email}$", "$options": "i"}},
                {"$set": {"gender": gender}})
            users += r.modified_count
        r2 = await scores.update_one({"email": email}, {"$set": {"gender": gender}})
        print(f"{email}: employee records updated={users}, leaderboard row updated={r2.modified_count}")

asyncio.get_event_loop().run_until_complete(main())
