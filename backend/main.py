from fastapi import FastAPI
from routes.caretakerRoute import caretaker_route
from routes.patientRoute import patient_router
app = FastAPI()


app.include_router(patient_router)
app.include_router(caretaker_route)

@app.get("/")
def home():
    return "Working"