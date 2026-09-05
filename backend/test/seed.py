from datetime import date, time

from db.database import SessionLocal
from models.CareTaker import CareTaker
from models.Patient import Patient
from models.Routines import DailyRoutine


db = SessionLocal()

try:
    # Create caretaker
    caretaker = CareTaker(
        unique_id="CT0001",
        name="John Doe",
        email="john@example.com",
        phone="9876543210",
        location="Bangalore",
    )

    db.add(caretaker)
    db.flush()

    # Create patient
    patient = Patient(
        name="Alice Doe",
        caretaker_id=caretaker.unique_id,
        phone="9123456780",
        location="Bangalore",
    )

    db.add(patient)
    db.flush()

    # Create daily routines
    routine1 = DailyRoutine(
        patient_id=patient.id,
        title="Morning Exercise",
        description="30 minutes of light exercise",
        createdAt=date.today(),
        routine_time=time(7, 0),
    )

    routine2 = DailyRoutine(
        patient_id=patient.id,
        title="Breakfast",
        description="Have a healthy breakfast",
        createdAt=date.today(),
        routine_time=time(8, 0),
    )

    routine3 = DailyRoutine(
        patient_id=patient.id,
        title="Medication",
        description="Take morning medication",
        createdAt=date.today(),
        routine_time=time(9, 0),
    )

    db.add_all([
        routine1,
        routine2,
        routine3,
    ])

    db.commit()

    print("Dummy data inserted successfully!")

except Exception as e:
    db.rollback()
    print("Error:", e)

finally:
    db.close()