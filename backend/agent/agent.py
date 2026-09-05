from langchain.agents import create_agent
from agent.prompts import SYSTEM_PROMPT
class CogniAgent:
    def __init__(self,llm,tools):
        self.llm = llm
        self.prompt = SYSTEM_PROMPT
        self.tools = tools
        self.agent = create_agent(
            model= self.llm,
            tools= self.tools,
            system_prompt= self.prompt
        )

    def run(self):
        return self.agent.invoke()
    
    