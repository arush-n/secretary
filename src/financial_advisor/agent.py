from dotenv import load_dotenv
from .financial_advisor import FinancialAdvisorAgent as IntegratedFinancialAdvisor

load_dotenv()


class FinancialAdvisorAgent:
    """Compatibility wrapper that delegates to the integrated FinancialAdvisorAgent.

    This keeps the old import path (`src.financial_advisor.agent.FinancialAdvisorAgent`)
    working while using the newer implementation in `financial_advisor.py` which
    integrates expert agents and Gemini.
    """

    def __init__(self, agent_type: str = "warren_buffett"):
        # Delegate to the integrated implementation
        self._impl = IntegratedFinancialAdvisor(agent_type=agent_type)

    def read_financial_data(self, file_path: str) -> str:
        return self._impl.read_financial_data(file_path)

    def get_financial_advice(self, user_financial_data: str) -> str:
        return self._impl.get_financial_advice(user_financial_data)