from sqlalchemy import ForeignKey,String,Date,Time
from sqlalchemy.orm import Mapped,mapped_column
from db.database import Base
from datetime import date,time

class DailyRoutine(Base):
    __tablename__ = "daily_routines"

    id : Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    patient_id : Mapped[int] = mapped_column(
        ForeignKey("patients.id"),
        nullable=False
    )

    title : Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    description : Mapped[str] = mapped_column(
        String[100],
    )

    createdAt : Mapped[date]  = mapped_column(
        Date,
        nullable=False
    )

    routine_time : Mapped[time] = mapped_column(
        Time,
        nullable=False
    )
