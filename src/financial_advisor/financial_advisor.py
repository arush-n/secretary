# src/financial_advisor/financial_advisor.py
import os
from dotenv import load_dotenv
from ..graph.state import AgentState
import datetime
from pydantic import BaseModel, Field
from ..utils.llm import call_llm


class IntegratedAdvice(BaseModel):
    advice: str = Field(description="Full integrated financial advice")
    actionable_steps: str = Field(description="Concrete, prioritized next steps")

load_dotenv()


class FinancialAdvisorAgent:
    """General financial advisor that delegates to named expert agents.

    This class uses the same agent experts as `StockAdvisorAgent` and calls
    them directly. The agents themselves use the project's Gemini helpers
    (via `src.utils.llm`) so no OpenAI client is required here.
    """

    # Short persona instructions for each advisor. These capture style and
    # worldview without instructing about stocks or tickers.
    PERSONA_MAP: dict[str, str] = {
        "aswath_damodaran": "A careful valuation professor who explains numbers clearly and emphasizes intrinsic value and margin of safety in plain language.",
        "ben_graham": "A conservative value investor who prioritizes safety of principal, margin of safety, and disciplined, evidence-based choices.",
        "bill_ackman": "A direct, activist-minded advisor who focuses on clarity, decisive recommendations, and practical remediation steps.",
        "cathie_wood": "A growth-oriented, optimistic thinker who looks for long-term trends and innovation while discussing risk management.",
        "charlie_munger": "A crisp, multidisciplinary thinker who favors rational decision-making and clear heuristics for choices.",
        "michael_burry": "A skeptical, data-driven analyst who highlights downside risks and the importance of conservative assumptions.",
        "mohnish_pabrai": "A focused value investor who prefers simplicity, checklists, and concentrated, high-conviction choices explained plainly.",
        "peter_lynch": "A practical, approachable advisor who uses common-sense examples and emphasizes understanding what you own and doing homework.",
        "phil_fisher": "A qualitative-focused thinker who values deep research into business quality and long-term potential, explained in accessible terms.",
        "rakesh_jhunjhunwala": "A pragmatic, opportunistic investor voice with emphasis on conviction, local market context, and risk management.",
        "stanley_druckenmiller": "A macro-aware advisor who thinks in terms of big-picture economic forces and practical portfolio implications.",
        "warren_buffett": "A calm, patient voice emphasizing long-term planning, financial prudence, simplicity, and common-sense steps for most households.",
    }

    def __init__(self, agent_type: str = "warren_buffett"):
        # agent_type selects the persona for tone/style; the advisor will not give
        # stock picks or ticker-specific investment advice.
        self.agent_type = agent_type or "warren_buffett"
        print("FinancialAdvisor instantiated: True")

    def read_financial_data(self, file_path: str) -> str:
        """Reads financial data from a file."""
        with open(file_path, "r") as f:
            return f.read()

    def get_financial_advice(self, user_input: str, user_financial_data: str | None = None) -> str:
        """Provide advice in the selected persona.

        Parameters:
        - user_input: the user's typed prompt/question. This is the primary input the
          advisor should respond to.
        - user_financial_data: optional additional context (contents of a file)
          the user may provide to help craft personalized guidance.

        Backwards compatibility: previously callers supplied only the file contents
        to this function; passing that string as `user_input` still works.
        """
        # The FinancialAdvisor focuses on general personal finance guidance only.
        # Use the selected persona to set the tone but DO NOT provide stock picks.
        persona = self.PERSONA_MAP.get(self.agent_type, self.PERSONA_MAP["warren_buffett"])

        # Build a prompt that uses the user's typed input as the question and the
        # persona only as the requested response style. We avoid embedding any
        # internal instructions that look like a user prompt — the user's input
        # should drive the response.
        prompt_parts = [
            f"Respond in the voice and style of the following persona (do NOT give stock picks or ticker advice): {persona}",
            "You are a helpful, practical personal finance advisor. Answer the user's question below succinctly and provide actionable next steps when appropriate.",
            f"USER PROMPT:\n{user_input}",
        ]

        if user_financial_data:
            prompt_parts.append(f"ADDITIONAL CONTEXT (do not invent data):\n{user_financial_data}")

        prompt_parts.append("Return a JSON object with keys 'advice' (string) and 'actionable_steps' (string - numbered list).")

        prompt = "\n\n".join(prompt_parts)

        try:
            integrated = call_llm(prompt=prompt, pydantic_model=IntegratedAdvice, agent_name="general_advisor")
            return f"{integrated.advice}\n\nNext steps:\n{integrated.actionable_steps}"
        except Exception as e:
            return (
                "Unable to run integrated guidance: returning simple general advice.\n\n"
                "1) Build a 3-6 month emergency fund in an accessible savings account.\n"
                "2) Use surplus cash to pay down highest-interest debt first.\n"
                "3) Automate retirement contributions to capture employer match.\n"
                f"(Error: {e})"
            )

    # No agent lookups needed for general advisor