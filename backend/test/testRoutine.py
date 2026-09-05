from db.database import SessionLocal
from datetime import date
from sqlalchemy import select
from models.Routines import DailyRoutine
db = SessionLocal()

try:
    today = date.today()
    routines = db.scalars(
        select(DailyRoutine).where(
            DailyRoutine.patient_id == 1
        )
    ).all() #db.scalar executes a query and returns only single object
    #db.scalars() is used to get mutiple objects
    for i in routines:
        print(i.title)
        print(i.description)
except Exception as e:
    db.rollback()
    print(e)

finally:
    db.close()