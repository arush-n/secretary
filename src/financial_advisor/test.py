# src/financial_advisor/test.py
import sys
from pathlib import Path

# When running this test as a script, make sure the repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.financial_advisor.agent import FinancialAdvisorAgent
from src.financial_advisor.stock_advisor import StockAdvisorAgent

def run_financial_advisor_test():
    """
    Test function to run the financial advisor agents.
    """
    # Test the general financial advisor (general-purpose, file-based)
    general_advisor = FinancialAdvisorAgent()
    # Create a dummy financial data file for testing

    financial_data = general_advisor.read_financial_data("dummy_financial_data.txt")
    # Pass only the file contents; advisor will provide general financial guidance
    advice = general_advisor.get_financial_advice(financial_data)
    print("--- General Financial Advice ---")
    print(advice)

    # Test the stock advisor
    stock_advisor = StockAdvisorAgent(agent_type="warren_buffett")
    stock_advice = stock_advisor.get_stock_advice("AAPL")
    print("\n--- Stock Advice (Warren Buffett) ---")
    print(stock_advice)


if __name__ == "__main__":
    run_financial_advisor_test()