from sqlalchemy import String,ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from db.database import Base
class Patient(Base):
    __tablename__ = "patients"

    id : Mapped[int]  = mapped_column(
        primary_key=True,
        autoincrement=True
    )

    name : Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    caretaker_id : Mapped[str] = mapped_column(
        ForeignKey("caretakers.unique_id"),
        nullable= False
    )
    
    phone : Mapped[str] = mapped_column(
        String(10),
        nullable=False
    )

    location : Mapped[str] = mapped_column(
        String(50),
        nullable= False
    )


