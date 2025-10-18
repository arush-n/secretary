# src/financial_advisor/stock_advisor.py
import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from ..agents.aswath_damodaran import aswath_damodaran_agent
from ..agents.ben_graham import ben_graham_agent
from ..agents.bill_ackman import bill_ackman_agent
from ..agents.cathie_wood import cathie_wood_agent
from ..agents.charlie_munger import charlie_munger_agent
from ..agents.michael_burry import michael_burry_agent
from ..agents.mohnish_pabrai import mohnish_pabrai_agent
from ..agents.peter_lynch import peter_lynch_agent
from ..agents.phil_fisher import phil_fisher_agent
from ..agents.rakesh_jhunjhunwala import rakesh_jhunjhunwala_agent
from ..agents.stanley_druckenmiller import stanley_druckenmiller_agent
from ..agents.warren_buffett import warren_buffett_agent
from ..graph.state import AgentState
import datetime

load_dotenv()

class StockAdvisorAgent:
    """
    A class to represent a stock advisor agent.
    """

    def __init__(self, agent_type="warren_buffett"):
        """
        Initializes the StockAdvisorAgent.
        """
        self.llm = ChatOpenAI(
            model="gemini-2.5-flash",
            api_key=os.environ.get("GEMINI_API_KEY"),
        )
        self.agent_type = agent_type
        self.agent_func = self._get_agent_function()
        print("StockAdvisor instantiated: True")


    def get_stock_advice(self, ticker: str) -> str:
        """
        Provides stock advice for a given ticker.
        """
        if not self.agent_func:
            return "Invalid agent type."

        # Create a mock state for the agent
        state = AgentState(
            messages=[],
            data={
                "tickers": [ticker],
                "start_date": (datetime.datetime.now() - datetime.timedelta(days=365)).strftime("%Y-%m-%d"),
                "end_date": datetime.datetime.now().strftime("%Y-%m-%d"),
                "portfolio": {"cash": 100000.0},
                "analyst_signals": {}
            },
            metadata={"show_reasoning": True}
        )
        result = self.agent_func(state)
        return result['messages'][-1].content


    def _get_agent_function(self):
        agents = {
            "aswath_damodaran": aswath_damodaran_agent,
            "ben_graham": ben_graham_agent,
            "bill_ackman": bill_ackman_agent,
            "cathie_wood": cathie_wood_agent,
            "charlie_munger": charlie_munger_agent,
            "michael_burry": michael_burry_agent,
            "mohnish_pabrai": mohnish_pabrai_agent,
            "peter_lynch": peter_lynch_agent,
            "phil_fisher": phil_fisher_agent,
            "rakesh_jhunjhunwala": rakesh_jhunjhunwala_agent,
            "stanley_druckenmiller": stanley_druckenmiller_agent,
            "warren_buffett": warren_buffett_agent,
        }
        return agents.get(self.agent_type)