from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker,DeclarativeBase
from config.settings import DATABASE_URL
import os

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set")

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(
    bind = engine,
    autoflush=False,
    autocommit = False
)

class Base(DeclarativeBase):
    pass
