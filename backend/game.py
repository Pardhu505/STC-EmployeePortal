"""
game.py
-------
Leaderboard for the Ganesh Chaturthi "Modak Quest" game.

Scores are stored per employee (keyed on their email, taken from the logged-in
user - not from the request body - so a score can't be posted under someone
else's name). Only a player's BEST score is kept.

Endpoints
    POST /api/game/score        { score, modaks }  -> records/updates the best
    GET  /api/game/leaderboard?limit=500           -> all players, rank order
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from database import attendance_db
from models import get_current_user

router = APIRouter()
scores = attendance_db["game_scores"]


class ScoreIn(BaseModel):
    score: int
    modaks: int = 0


async def ensure_game_indexes():
    try:
        await scores.create_index("email", unique=True, name="uniq_player")
        await scores.create_index([("score", -1)], name="score_desc")
    except Exception as e:
        logging.warning("game index setup: %s", e)


@router.post("/game/score")
async def submit_score(body: ScoreIn, user=Depends(get_current_user)):
    """Record a finished run. Keeps only the player's highest score."""
    email = (user.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(400, "No email on your profile.")
    if body.score < 0 or body.score > 1_000_000:
        raise HTTPException(400, "Invalid score.")

    name = user.get("name") or email.split("@")[0]
    now = datetime.now(timezone.utc)

    existing = await scores.find_one({"email": email})
    best = int(existing.get("score", 0)) if existing else 0

    if body.score > best:
        await scores.update_one(
            {"email": email},
            {"$set": {"email": email, "name": name, "score": int(body.score),
                      "modaks": int(body.modaks), "updated_at": now},
             "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        improved = True
        best = int(body.score)
    else:
        # still refresh the display name / last played
        await scores.update_one({"email": email},
                                {"$set": {"name": name, "last_played": now}}, upsert=True)
        improved = False

    rank = await scores.count_documents({"score": {"$gt": best}}) + 1
    return {"best": best, "improved": improved, "rank": rank}


@router.get("/game/leaderboard")
async def leaderboard(limit: int = Query(500, ge=1, le=2000), user=Depends(get_current_user)):
    """All players in rank order (paged by limit), plus where the caller stands."""
    top = []
    cur = scores.find({"score": {"$gt": 0}}, {"_id": 0, "name": 1, "score": 1, "modaks": 1, "email": 1}) \
                .sort("score", -1).limit(limit)
    async for d in cur:
        top.append(d)

    me_email = (user.get("email") or "").strip().lower()
    my = await scores.find_one({"email": me_email}, {"_id": 0, "score": 1, "modaks": 1})
    my_best = int(my.get("score", 0)) if my else 0
    my_rank = (await scores.count_documents({"score": {"$gt": my_best}}) + 1) if my_best > 0 else None

    out = []
    for i, d in enumerate(top, start=1):
        out.append({
            "rank": i,
            "name": d.get("name") or "—",
            "score": int(d.get("score", 0)),
            "modaks": int(d.get("modaks", 0)),
            "me": (d.get("email") or "").lower() == me_email,
        })
    total = await scores.count_documents({"score": {"$gt": 0}})
    return {"leaderboard": out, "my_best": my_best, "my_rank": my_rank, "total": total}
