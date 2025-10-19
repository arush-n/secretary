from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import google.generativeai as genai
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
import numpy as np

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configure Gemini API
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

@app.route('/get-dashboard-data', methods=['GET'])
def get_dashboard_data():
    try:
        # Mock dashboard data for demo purposes
        dashboard_data = {
            'net_worth': {
                'current': 19550.98,
                'change': 873.35,
                'change_percent': 4.7
            },
            'budget': {
                'income': {
                    'current': 5410.00,
                    'budget': 5265.75,
                    'status': 'on_track'
                },
                'expenses': {
                    'current': 3237.83,
                    'budget': 3720.00,
                    'status': 'under_budget'
                },
                'savings': {
                    'current': 1300.00,
                    'budget': 1324.93,
                    'status': 'under_budget'
                }
            },
            'assets_liabilities': {
                'assets': {
                    'total': 29960.98,
                    'breakdown': {
                        'checking': 6329.00,
                        'savings': 5000.00,
                        'investments': 18631.98
                    }
                },
                'liabilities': {
                    'total': 10410.00,
                    'breakdown': {
                        'credit_cards': 410.00,
                        'loans': 10000.00
                    }
                }
            },
            'transactions': [
                {
                    '_id': '68f3e64a9683f20dd519e4ec',
                    'amount': -25.50,
                    'description': 'Coffee at Starbucks',
                    'purchase_date': '2024-10-15',
                    'status': 'executed'
                },
                {
                    '_id': '68f3e64d9683f20dd519e4ee',
                    'amount': -89.99,
                    'description': 'Grocery shopping at Whole Foods',
                    'purchase_date': '2024-10-14',
                    'status': 'executed'
                },
                {
                    '_id': '68f3e6529683f20dd519e4ef',
                    'amount': -15.75,
                    'description': 'Uber ride to downtown',
                    'purchase_date': '2024-10-13',
                    'status': 'executed'
                },
                {
                    '_id': '68f3e6529683f20dd519e4f0',
                    'amount': -1600.00,
                    'description': 'Rent payment',
                    'purchase_date': '2024-10-12',
                    'status': 'executed'
                },
                {
                    '_id': '68f3e6529683f20dd519e4f1',
                    'amount': -95.00,
                    'description': 'Verizon Mobile bill',
                    'purchase_date': '2024-10-11',
                    'status': 'executed'
                }
            ]
        }
        
        return jsonify(dashboard_data)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get-transactions', methods=['GET'])
def get_transactions():
    try:
        customer_id = request.args.get('customerId')
        nessie_api_key = os.getenv('NESSIE_API_KEY')
        
        if not customer_id or not nessie_api_key:
            return jsonify({'error': 'Missing customerId or API key'}), 400
        
        # Get customer accounts
        accounts_url = f"http://api.nessieisreal.com/customers/{customer_id}/accounts?key={nessie_api_key}"
        accounts_response = requests.get(accounts_url)
        
        if accounts_response.status_code != 200:
            return jsonify({'error': f'Failed to fetch accounts: {accounts_response.status_code} - {accounts_response.text}'}), 500
        
        accounts_data = accounts_response.json()
        
        # Find primary checking account
        checking_account = None
        for account in accounts_data:
            if account.get('type') == 'Checking':
                checking_account = account
                break
        
        if not checking_account:
            return jsonify({'error': 'No checking account found'}), 404
        
        account_id = checking_account['_id']
        
        # Get transactions for the account
        transactions_url = f"http://api.nessieisreal.com/accounts/{account_id}/purchases?key={nessie_api_key}"
        transactions_response = requests.get(transactions_url)
        
        if transactions_response.status_code != 200:
            return jsonify({'error': 'Failed to fetch transactions'}), 500
        
        transactions = transactions_response.json()
        return jsonify(transactions)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get-ai-summary', methods=['POST'])
def get_ai_summary():
    try:
        data = request.get_json()
        transactions = data.get('transactions', [])
        
        if not transactions:
            return jsonify({'error': 'No transactions provided'}), 400
        
        # Initialize Gemini model
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Create the prompt
        prompt = f"""Analyze these bank transactions and return ONLY a valid JSON object with this exact structure:

{{
  "categorized_transactions": [
    {{
      "_id": "transaction_id",
      "amount": 25.50,
      "description": "Coffee at Starbucks",
      "purchase_date": "2024-10-15",
      "category": "Food & Drink"
    }}
  ],
  "summary": "Brief 2-3 sentence summary of spending habits and saving tip"
}}

Categories: Food & Drink, Shopping, Transport, Bills & Utilities, Entertainment, Groceries, General Merchandise, Income, Other

Transactions to analyze:
{transactions}"""
        
        # Send to Gemini API
        response = model.generate_content(prompt)
        
        # Parse the response
        try:
            import json
            import re
            
            # Clean the response text - remove markdown code blocks if present
            response_text = response.text.strip()
            if response_text.startswith('```json'):
                response_text = response_text[7:]  # Remove ```json
            if response_text.startswith('```'):
                response_text = response_text[3:]   # Remove ```
            if response_text.endswith('```'):
                response_text = response_text[:-3] # Remove trailing ```
            
            response_text = response_text.strip()
            result = json.loads(response_text)
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            print(f"Cleaned response text: {response_text}")
            result = {
                'categorized_transactions': transactions,
                'summary': 'Unable to analyze transactions at this time.'
            }
        except Exception as e:
            print(f"Error parsing Gemini response: {e}")
            print(f"Response text: {response.text}")
            result = {
                'categorized_transactions': transactions,
                'summary': 'Unable to analyze transactions at this time due to API quota limits.'
            }
        
        return jsonify(result)
        
    except Exception as e:
        # Provide a meaningful fallback summary when AI is unavailable
        fallback_result = {
            'categorized_transactions': transactions,
            'summary': 'Based on your recent transactions, you have regular spending on dining and transportation. Consider tracking these categories to optimize your budget. AI analysis temporarily unavailable.'
        }
        return jsonify(fallback_result)

# New helper functions for budget calendar
def detect_recurring_charges(transactions):
    """Detect recurring monthly charges"""
    recurring = []
    merchants = {}
    
    for t in transactions:
        merchant = t.get('description', '').lower()
        amount = t.get('amount', 0)
        
        if merchant not in merchants:
            merchants[merchant] = []
        merchants[merchant].append({'amount': amount, 'date': t.get('purchase_date', t.get('transaction_date', ''))})
    
    # Check for recurring patterns
    for merchant, charges in merchants.items():
        if len(charges) >= 2:
            amounts = [c['amount'] for c in charges]
            avg_amount = sum(amounts) / len(amounts)
            
            # Check if amounts are similar (±15%)
            is_similar = all(abs(amt - avg_amount) / avg_amount <= 0.15 for amt in amounts if avg_amount > 0)
            
            if is_similar and avg_amount > 50:  # Likely a bill
                # Mark as recurring
                for t in transactions:
                    if t.get('description', '').lower() == merchant:
                        t['isFixed'] = True
                        recurring.append(t)
    
    return recurring

def simple_linear_regression(days, amounts):
    """Simple linear regression for spending prediction"""
    if len(days) < 2:
        return 0, 0
    
    n = len(days)
    x = np.array(days)
    y = np.array(amounts)
    
    # Calculate slope and intercept
    x_mean = np.mean(x)
    y_mean = np.mean(y)
    
    numerator = np.sum((x - x_mean) * (y - y_mean))
    denominator = np.sum((x - x_mean) ** 2)
    
    if denominator == 0:
        return y_mean, 0
    
    slope = numerator / denominator
    intercept = y_mean - slope * x_mean
    
    return slope, intercept

@app.route('/api/nessie/transactions', methods=['POST'])
def get_nessie_transactions():
    try:
        data = request.get_json()
        account_id = data.get('accountId')
        month = data.get('month')
        year = data.get('year')
        
        nessie_api_key = os.getenv('NESSIE_API_KEY')
        
        if not account_id or not nessie_api_key:
            return jsonify({'error': 'Missing accountId or API key'}), 400
        
        # Fetch transactions from Nessie
        url = f"http://api.nessieisreal.com/accounts/{account_id}/purchases?key={nessie_api_key}"
        response = requests.get(url)
        
        if response.status_code != 200:
            return jsonify({'error': 'Failed to fetch from Nessie'}), 500
        
        raw_transactions = response.json()
        
        # Normalize transactions
        transactions = []
        for t in raw_transactions:
            trans_date = t.get('purchase_date', t.get('transaction_date', ''))
            trans_month = int(trans_date.split('-')[1]) if trans_date else 0
            trans_year = int(trans_date.split('-')[0]) if trans_date else 0
            
            # Filter to requested month
            if trans_month == month and trans_year == year:
                transactions.append({
                    'id': t.get('_id', ''),
                    'date': trans_date,
                    'amount': abs(t.get('amount', 0)),
                    'merchant': t.get('merchant_id', 'Unknown'),
                    'description': t.get('description', 'Purchase'),
                    'type': t.get('type', 'debit')
                })
        
        # Detect recurring charges
        fixed_charges = detect_recurring_charges(transactions)
        
        # Build daily spending for regression (exclude fixed charges)
        today = datetime.now().day
        daily_spend = {}
        
        for t in transactions:
            day = int(t['date'].split('-')[2])
            if day <= today:
                if not t.get('isFixed'):
                    daily_spend[day] = daily_spend.get(day, 0) + t['amount']
        
        # Run regression
        days = sorted(daily_spend.keys())
        amounts = [daily_spend[d] for d in days]
        
        slope, intercept = simple_linear_regression(days, amounts)
        
        # Predict future days
        predictions = {}
        days_in_month = 31  # Simplified
        for day in range(today + 1, days_in_month + 1):
            predicted = max(0, slope * day + intercept)
            predictions[day] = round(predicted, 2)
        
        return jsonify({
            'transactions': transactions,
            'fixedCharges': fixed_charges,
            'predictions': predictions
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/gemini/advice', methods=['POST'])
def get_budget_advice():
    try:
        data = request.get_json()
        leeway = data.get('leeway', 0)
        context = data.get('context', {})
        
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        prompt = f"""You have ${leeway:.2f} remaining in your monthly budget. 

Budget: ${context.get('budget', 0):.2f}
Projected spending: ${context.get('projectedTotal', 0):.2f}
Risk tolerance: {context.get('riskTolerance', 'moderate')}

Provide a 1-2 sentence suggestion on whether to save this surplus or invest it. Be concise and actionable. Do not endorse specific products."""
        
        response = model.generate_content(prompt)
        suggestion = response.text.strip()
        
        return jsonify({'suggestion': suggestion})
        
    except Exception as e:
        fallback = f"With ${leeway:.2f} remaining, consider saving it in a high-yield savings account for emergencies or investing in diversified index funds for long-term growth."
        return jsonify({'suggestion': fallback})

@app.route('/get-recurring-expenses', methods=['GET'])
def get_recurring_expenses():
    try:
        customer_id = request.args.get('customerId')
        
        # Mock recurring expenses data
        recurring_expenses = [
            {
                "id": "rec-1",
                "name": "Mortgage Payment",
                "amount": 1650.00,
                "category": "Housing",
                "frequency": "monthly",
                "next_date": "2025-11-01"
            },
            {
                "id": "rec-2",
                "name": "Car Insurance",
                "amount": 156.00,
                "category": "Insurance",
                "frequency": "monthly",
                "next_date": "2025-10-25"
            },
            {
                "id": "rec-3",
                "name": "Car Payment",
                "amount": 425.00,
                "category": "Transportation",
                "frequency": "monthly",
                "next_date": "2025-10-28"
            },
            {
                "id": "rec-4",
                "name": "Water & Sewer Bill",
                "amount": 89.00,
                "category": "Utilities",
                "frequency": "monthly",
                "next_date": "2025-10-22"
            },
            {
                "id": "rec-5",
                "name": "Electric Bill",
                "amount": 191.99,
                "category": "Utilities",
                "frequency": "monthly",
                "next_date": "2025-10-30"
            },
            {
                "id": "rec-6",
                "name": "Verizon Mobile",
                "amount": 95.00,
                "category": "Phone",
                "frequency": "monthly",
                "next_date": "2025-11-05"
            },
            {
                "id": "rec-7",
                "name": "Internet - Comcast",
                "amount": 79.99,
                "category": "Utilities",
                "frequency": "monthly",
                "next_date": "2025-11-10"
            },
            {
                "id": "rec-8",
                "name": "Netflix",
                "amount": 15.49,
                "category": "Subscriptions",
                "frequency": "monthly",
                "next_date": "2025-10-20"
            },
            {
                "id": "rec-9",
                "name": "Spotify Premium",
                "amount": 10.99,
                "category": "Subscriptions",
                "frequency": "monthly",
                "next_date": "2025-10-19"
            },
            {
                "id": "rec-10",
                "name": "Disney+",
                "amount": 13.99,
                "category": "Subscriptions",
                "frequency": "monthly",
                "next_date": "2025-11-08"
            },
            {
                "id": "rec-11",
                "name": "Amazon Prime",
                "amount": 14.99,
                "category": "Subscriptions",
                "frequency": "monthly",
                "next_date": "2025-10-27"
            },
            {
                "id": "rec-12",
                "name": "Planet Fitness",
                "amount": 24.99,
                "category": "Fitness",
                "frequency": "monthly",
                "next_date": "2025-10-21"
            }
        ]
        
        total_monthly = sum(exp['amount'] for exp in recurring_expenses)
        
        return jsonify({
            'recurring_expenses': recurring_expenses,
            'total_monthly': round(total_monthly, 2)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get-transaction-history', methods=['GET'])
def get_transaction_history():
    try:
        customer_id = request.args.get('customerId')
        limit = int(request.args.get('limit', 100))
        page = int(request.args.get('page', 1))
        use_nessie = request.args.get('use_nessie', 'false').lower() == 'true'
        
        nessie_api_key = os.getenv('NESSIE_API_KEY')
        
        # Try to use Nessie API first, fallback to mock data
        if use_nessie and nessie_api_key and customer_id:
            try:
                # Get customer accounts
                accounts_url = f"http://api.nessieisreal.com/customers/{customer_id}/accounts?key={nessie_api_key}"
                accounts_response = requests.get(accounts_url)
                
                if accounts_response.status_code == 200:
                    accounts_data = accounts_response.json()
                    
                    # Find primary checking account
                    checking_account = None
                    for account in accounts_data:
                        if account.get('type') == 'Checking':
                            checking_account = account
                            break
                    
                    if checking_account:
                        account_id = checking_account['_id']
                        
                        # Get transactions for the account
                        transactions_url = f"http://api.nessieisreal.com/accounts/{account_id}/purchases?key={nessie_api_key}"
                        transactions_response = requests.get(transactions_url)
                        
                        if transactions_response.status_code == 200:
                            nessie_transactions = transactions_response.json()
                            
                            # Transform Nessie data to our format
                            transformed_transactions = []
                            for idx, t in enumerate(nessie_transactions):
                                # Categorize based on description
                                category = categorize_transaction(t.get('description', ''))
                                
                                transformed_transactions.append({
                                    'id': t.get('_id', f'nessie-{idx}'),
                                    'date': t.get('purchase_date', ''),
                                    'description': t.get('description', 'Unknown Transaction'),
                                    'amount': -float(t.get('amount', 0)),  # Make expenses negative
                                    'category': category,
                                    'status': t.get('status', 'executed')
                                })
                            
                            # Sort by date (newest first)
                            transformed_transactions.sort(key=lambda x: x['date'], reverse=True)
                            
                            # Apply pagination
                            start_idx = (page - 1) * limit
                            end_idx = start_idx + limit
                            paginated_transactions = transformed_transactions[start_idx:end_idx]
                            
                            return jsonify({
                                'transactions': paginated_transactions,
                                'total_count': len(transformed_transactions),
                                'source': 'nessie'
                            })
            except Exception as e:
                print(f"Nessie API error: {e}")
                # Fall through to mock data
        
        # Mock transactions data (fallback) - Updated to match current month and person's profile
        from datetime import datetime, timedelta
        
        today = datetime.now()
        mock_transactions = []
        
        # Generate realistic transactions for the past 30 days
        base_transactions = [
            # Recent transactions (last 5 days)
            {"description": "Starbucks Coffee", "amount": -6.75, "category": "food"},
            {"description": "Uber Ride", "amount": -24.50, "category": "transport"},
            {"description": "Whole Foods Market", "amount": -127.83, "category": "food"},
            {"description": "Amazon Purchase", "amount": -89.99, "category": "shopping"},
            {"description": "Shell Gas Station", "amount": -65.00, "category": "transport"},
            
            # Mid-range transactions
            {"description": "Target Shopping", "amount": -78.42, "category": "shopping"},
            {"description": "Chipotle Mexican Grill", "amount": -15.85, "category": "food"},
            {"description": "CVS Pharmacy", "amount": -32.50, "category": "healthcare"},
            {"description": "Netflix Subscription", "amount": -15.99, "category": "entertainment"},
            {"description": "Spotify Premium", "amount": -10.99, "category": "entertainment"},
            {"description": "Uber Eats", "amount": -28.75, "category": "food"},
            {"description": "AMC Movie Theater", "amount": -45.00, "category": "entertainment"},
            
            # Bills and recurring expenses (matches recurring expenses tab)
            {"description": "Rent Payment", "amount": -1450.00, "category": "housing"},
            {"description": "Verizon Wireless", "amount": -95.00, "category": "utilities"}, 
            {"description": "Pacific Gas & Electric", "amount": -125.00, "category": "utilities"},
            {"description": "Geico Insurance", "amount": -180.00, "category": "other"},
            {"description": "LA Fitness", "amount": -45.00, "category": "healthcare"},
            
            # More daily spending
            {"description": "Safeway Grocery", "amount": -95.67, "category": "food"},
            {"description": "Joe & The Juice", "amount": -8.50, "category": "food"},
            {"description": "Lyft Ride", "amount": -18.75, "category": "transport"},
            {"description": "Best Buy", "amount": -156.99, "category": "shopping"},
            {"description": "Panera Bread", "amount": -12.45, "category": "food"},
            {"description": "7-Eleven", "amount": -7.85, "category": "other"},
            {"description": "McDonald's", "amount": -9.75, "category": "food"},
            
            # Income
            {"description": "Salary Deposit - Tech Corp", "amount": 6500.00, "category": "income"},
            {"description": "Freelance Payment", "amount": 850.00, "category": "income"},
        ]
        
        # Distribute transactions across the past 30 days
        for i, transaction in enumerate(base_transactions):
            days_ago = i % 25  # Spread across 25 days
            transaction_date = (today - timedelta(days=days_ago)).strftime('%Y-%m-%d')
            
            mock_transactions.append({
                "id": f"demo-{i+1}",
                "date": transaction_date,
                "description": transaction["description"],
                "amount": transaction["amount"],
                "category": transaction["category"],
                "status": "executed"
            })
        
        # Add a few more recent transactions to fill out the data
        for i in range(15):
            days_ago = i % 7
            transaction_date = (today - timedelta(days=days_ago)).strftime('%Y-%m-%d')
            
            daily_expenses = [
                {"description": "Coffee Shop", "amount": -5.25, "category": "food"},
                {"description": "Public Transit", "amount": -3.50, "category": "transport"},
                {"description": "Lunch Spot", "amount": -14.75, "category": "food"},
                {"description": "Convenience Store", "amount": -12.50, "category": "other"},
                {"description": "Food Truck", "amount": -11.00, "category": "food"},
            ]
            
            expense = daily_expenses[i % len(daily_expenses)]
            mock_transactions.append({
                "id": f"daily-{i+1}",
                "date": transaction_date,
                "description": expense["description"],
                "amount": expense["amount"],
                "category": expense["category"],
                "status": "executed"
            })
        
        # Sort by date (newest first)
        mock_transactions.sort(key=lambda x: x['date'], reverse=True)
        
        # Calculate pagination
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_transactions = mock_transactions[start_idx:end_idx]
        
        return jsonify({
            'transactions': paginated_transactions,
            'total_count': len(mock_transactions),
            'source': 'mock'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def categorize_transaction(description):
    """Simple categorization based on transaction description"""
    desc = description.lower()
    
    if any(word in desc for word in ['starbucks', 'coffee', 'restaurant', 'food', 'grocery', 'whole foods', 'chipotle']):
        return 'food'
    elif any(word in desc for word in ['uber', 'lyft', 'gas', 'parking', 'transport']):
        return 'transport'
    elif any(word in desc for word in ['netflix', 'spotify', 'movie', 'entertainment']):
        return 'entertainment'
    elif any(word in desc for word in ['amazon', 'target', 'shopping', 'store']):
        return 'shopping'
    elif any(word in desc for word in ['electric', 'phone', 'bill', 'utility']):
        return 'utilities'
    elif any(word in desc for word in ['pharmacy', 'medical', 'health', 'gym']):
        return 'healthcare'
    elif any(word in desc for word in ['salary', 'deposit', 'income', 'payroll']):
        return 'income'
    else:
        return 'other'

if __name__ == '__main__':
    app.run(debug=True, port=5001)
