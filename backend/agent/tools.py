from langchain.tools import tool
from agent.tools_impl import get_patient_routine


@tool
def getRoutine(patient_id: str, reminder_date: str = ""):
    """Fetch the patient's daily routine (appointments, medicines, activities) from the database."""
    return get_patient_routine(patient_id, reminder_date or None)

