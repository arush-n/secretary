import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

load_dotenv()

class FinancialAdvisorAgent:
    """
    A class to represent a financial advisor agent.
    """

    def __init__(self):
        """
        Initializes the FinancialAdvisorAgent.
        """
        self.llm = ChatOpenAI(
            model="gemini-2.5-flash",
            api_key=os.environ.get("OPENAI_API_KEY"),
        )
        self.prompt_template = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "You are a financial advisor. Your role is to provide "
                    "general financial advice based on the user's financial "
                    "data. Do not give any stock advice.",
                ),
                (
                    "user",
                    "Here is my financial data:\n{user_financial_data}\n\n"
                    "Please provide some general financial advice.",
                ),
            ]
        )
        self.chain = self.prompt_template | self.llm

    def read_financial_data(self, file_path: str) -> str:
        """
        Reads financial data from a file.
        """
        with open(file_path, "r") as f:
            return f.read()

    def get_financial_advice(self, user_financial_data: str) -> str:
        """
        Provides financial advice based on user's financial data.
        """
        response = self.chain.invoke({"user_financial_data": user_financial_data})
        return response.content

def main():
    """
    Main function to run the financial advisor agent.
    """
    # Determine input file path from CLI arg or environment variable
    import argparse

    parser = argparse.ArgumentParser(
        description="Run FinancialAdvisorAgent on a user financial data file."
    )
    parser.add_argument(
        "file",
        nargs="?",
        help=(
            "Path to a text file containing the user's financial data. "
            "If omitted, the USER_FINANCIAL_DATA_PATH environment variable will be used."
        ),
    )
    args = parser.parse_args()

    file_path = args.file or os.environ.get("USER_FINANCIAL_DATA_PATH")
    if not file_path:
        raise SystemExit(
            "Please provide a financial data file path as a CLI argument or set USER_FINANCIAL_DATA_PATH."
        )

    agent = FinancialAdvisorAgent()
    financial_data = agent.read_financial_data(file_path)
    advice = agent.get_financial_advice(financial_data)
    print(advice)

if __name__ == "__main__":
    main()