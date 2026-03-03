import json
import os
from datetime import timedelta
from typing import List

from fastapi import (
    FastAPI, Depends, HTTPException, status,
    UploadFile, File, WebSocket, WebSocketDisconnect
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from models import Base, User, Score, Message, UserCreate, UserResponse, ScoreResponse, Token, LeaderboardEntry
from auth import (
    verify_password, get_password_hash,
    create_access_token, get_current_username,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from face_logic import analyze_face

# ── DB Setup ─────────────────────────────────────────────────────────────────
# Use DATABASE_URL env var in production (PostgreSQL), fall back to SQLite locally
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./facerank.db")

# Render PostgreSQL URLs start with "postgres://" — SQLAlchemy needs "postgresql://"
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine       = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="FaceRank API", version="1.0.0")

# Allow local dev + production frontend URL
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        FRONTEND_URL,
        # Allow Vercel previews
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ── Auth Routes ───────────────────────────────────────────────────────────────

@app.post("/register", response_model=UserResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == user_in.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    db_user = User(
        username=user_in.username,
        hashed_password=get_password_hash(user_in.password),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": token, "token_type": "bearer"}

@app.get("/me", response_model=UserResponse)
def get_me(username: str = Depends(get_current_username), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ── Analysis Route ────────────────────────────────────────────────────────────

@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    username: str = Depends(get_current_username),
    db: Session   = Depends(get_db),
):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    contents = await file.read()
    result   = analyze_face(contents)

    if result is None:
        raise HTTPException(status_code=422, detail="No face detected in image")

    # Save score (store as 0-100 scale)
    db_score = Score(
        total_score=result["total_score"],
        details=result["scores"],
        user_id=user.id,
    )
    db.add(db_score)
    db.commit()

    return result

# ── Leaderboard Route ─────────────────────────────────────────────────────────

@app.get("/leaderboard", response_model=List[LeaderboardEntry])
def leaderboard(db: Session = Depends(get_db)):
    # Best score per user
    from sqlalchemy import func
    subq = (
        db.query(Score.user_id, func.max(Score.total_score).label("best_score"))
        .group_by(Score.user_id)
        .subquery()
    )
    rows = (
        db.query(User.username, subq.c.best_score, Score.created_at)
        .join(subq, User.id == subq.c.user_id)
        .join(Score, (Score.user_id == subq.c.user_id) & (Score.total_score == subq.c.best_score))
        .order_by(subq.c.best_score.desc())
        .limit(50)
        .all()
    )
    return [
        LeaderboardEntry(
            rank=i + 1,
            username=row.username,
            total_score=row.best_score,
            created_at=row.created_at,
        )
        for i, row in enumerate(rows)
    ]

@app.get("/leaderboard/user/{uname}")
def user_best_score(uname: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == uname).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    best = db.query(Score).filter(Score.user_id == user.id).order_by(Score.total_score.desc()).first()
    if not best:
        return {"username": uname, "total_score": None, "rank": None}
    # Get rank
    from sqlalchemy import func
    subq = (
        db.query(Score.user_id, func.max(Score.total_score).label("best"))
        .group_by(Score.user_id)
        .subquery()
    )
    rank_count = (
        db.query(subq)
        .filter(subq.c.best > best.total_score)
        .count()
    ) + 1
    return {"username": uname, "total_score": best.total_score, "rank": rank_count}

# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/")
def health():
    return {"status": "ok", "app": "FaceRank API v1.0"}

# ── WebSocket Chat ────────────────────────────────────────────────────────────

class ChatManager:
    def __init__(self):
        self.connections: dict[str, WebSocket] = {}  # username → ws

    async def connect(self, username: str, ws: WebSocket):
        await ws.accept()
        self.connections[username] = ws

    def disconnect(self, username: str):
        self.connections.pop(username, None)

    async def broadcast(self, payload: dict):
        dead = []
        for uname, ws in self.connections.items():
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                dead.append(uname)
        for d in dead:
            self.connections.pop(d, None)

    def online_users(self):
        return list(self.connections.keys())

manager = ChatManager()

@app.websocket("/ws/chat/{username}")
async def chat_ws(websocket: WebSocket, username: str):
    await manager.connect(username, websocket)
    await manager.broadcast({
        "type": "system",
        "message": f"🔥 {username} joined the chat",
        "users": manager.online_users(),
    })
    try:
        while True:
            text = await websocket.receive_text()
            await manager.broadcast({
                "type": "message",
                "from": username,
                "message": text,
                "users": manager.online_users(),
            })
    except WebSocketDisconnect:
        manager.disconnect(username)
        await manager.broadcast({
            "type": "system",
            "message": f"👋 {username} left the chat",
            "users": manager.online_users(),
        })
