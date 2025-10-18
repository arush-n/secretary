from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import google.generativeai as genai
import os
from dotenv import load_dotenv

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
                'summary': 'Unable to analyze transactions at this time.'
            }
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
