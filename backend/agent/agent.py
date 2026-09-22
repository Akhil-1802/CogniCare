"""Backward-compatible wrapper. New code should use agent.orchestrator."""
from agent.orchestrator import AgentOrchestrator, orchestrator  # noqa: F401


class CogniAgent:
    """Legacy stub kept so old imports don't break."""

    def __init__(self, llm=None, tools=None):
        self.llm = llm
        self.tools = tools or []
        self.orchestrator = AgentOrchestrator()

    def run(self, patient_id: str = "", message: str = ""):
        if not patient_id or not message:
            return {"response": "CogniAgent ready. Use orchestrator.chat(patient_id, message)."}
        return self.orchestrator.chat(patient_id, message)
