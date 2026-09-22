from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.auth import auth_router
from routes.patientAuth import patient_auth_router
from routes.reminders import reminders_router
from routes.assistant import assistant_router
from routes.caretaker_ai import caretaker_ai_router
from routes.notifications import notifications_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(patient_auth_router)
app.include_router(reminders_router)
app.include_router(assistant_router)
app.include_router(caretaker_ai_router)
app.include_router(notifications_router)


@app.get("/")
def home():
    return "Working"