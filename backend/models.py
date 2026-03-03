from sqlalchemy import Column, ForeignKey, Integer, String, Float, JSON, DateTime
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime
from pydantic import BaseModel
from pydantic import ConfigDict
from typing import Optional, Dict, List

Base = declarative_base()

# ── ORM Models ──────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at    = Column(DateTime, default=datetime.utcnow)

    scores   = relationship("Score",   back_populates="owner", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="owner", cascade="all, delete-orphan")

class Score(Base):
    __tablename__ = "scores"
    id          = Column(Integer, primary_key=True, index=True)
    total_score = Column(Float,   nullable=False)
    details     = Column(JSON,    nullable=True)  # individual category scores
    created_at  = Column(DateTime, default=datetime.utcnow)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)

    owner = relationship("User", back_populates="scores")

class Message(Base):
    __tablename__ = "messages"
    id         = Column(Integer, primary_key=True, index=True)
    content    = Column(String,  nullable=False)
    timestamp  = Column(DateTime, default=datetime.utcnow)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)

    owner = relationship("User", back_populates="messages")


# ── Pydantic Schemas (Pydantic v2) ───────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    created_at: datetime

class ScoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    total_score: float
    details: Optional[Dict[str, float]] = None
    created_at: datetime
    user_id: int
    username: Optional[str] = None   # populated manually in endpoint

class LeaderboardEntry(BaseModel):
    rank: int
    username: str
    total_score: float
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
