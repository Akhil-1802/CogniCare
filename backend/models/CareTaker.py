from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from db.database import Base

class CareTaker(Base):
    __tablename__ = "caretakers"

    id : Mapped[int]  = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    unique_id : Mapped[str] = mapped_column(
        String(6),
        nullable=False,
        unique=True
    )

    name : Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    email : Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )


    phone : Mapped[str] = mapped_column(
        String(10),
        nullable=False
    )

    location : Mapped[str] = mapped_column(
        String(50),
        nullable= False
    )


