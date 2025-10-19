from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import google.generativeai as genai
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
from collections import defaultdict

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configure Gemini API
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

NESSIE_API_KEY = os.getenv('NESSIE_API_KEY')
NESSIE_BASE_URL = "http://api.nessieisreal.com"

# ========== NEW: Categories and Tags Management ==========
CATEGORIES = [
    'Food & Drink',
    'Shopping',
    'Transport',
    'Bills & Utilities',
    'Entertainment',
    'Groceries',
    'Healthcare',
    'Salary',
    'Income',
    'Other'
]

TAGS = [
    'Business',
    'Personal',
    'Trip to Japan',
    'Home Renovation',
    'Holiday Shopping',
    'Reimbursable',
    'Income',
    'Tax Deductible'
]

# In-memory storage for transaction updates (in production, use a database)
TRANSACTION_UPDATES = {}

@app.route('/get-categories', methods=['GET'])
def get_categories():
    return jsonify(CATEGORIES)

@app.route('/get-tags', methods=['GET'])
def get_tags():
    return jsonify(TAGS)

# ========== NEW: Update Transaction Endpoint ==========
@app.route('/update-transaction', methods=['POST'])
def update_transaction():
    try:
        data = request.get_json()
        transaction_id = data.get('transaction_id')
        updates = data.get('updates')
        
        if not transaction_id:
            return jsonify({'error': 'Missing transaction_id'}), 400
        
        # Store updates in memory (in production, update database)
        TRANSACTION_UPDATES[transaction_id] = {
            **TRANSACTION_UPDATES.get(transaction_id, {}),
            **updates,
            'updated_at': datetime.now().isoformat()
        }
        
        return jsonify({
            'success': True,
            'message': 'Transaction updated successfully',
            'transaction_id': transaction_id,
            'updates': updates
        })
    except Exception as e:
        print(f"Error updating transaction: {e}")
        return jsonify({'error': str(e)}), 500

# ========== NEW: Delete Transaction Endpoint ==========
@app.route('/delete-transaction', methods=['POST'])
def delete_transaction():
    try:
        data = request.get_json()
        transaction_id = data.get('transaction_id')
        
        if not transaction_id:
            return jsonify({'error': 'Missing transaction_id'}), 400
        
        # Mark as deleted in memory (in production, update database)
        TRANSACTION_UPDATES[transaction_id] = {
            **TRANSACTION_UPDATES.get(transaction_id, {}),
            'deleted': True,
            'deleted_at': datetime.now().isoformat()
        }
        
        return jsonify({
            'success': True,
            'message': 'Transaction deleted successfully',
            'transaction_id': transaction_id
        })
    except Exception as e:
        print(f"Error deleting transaction: {e}")
        return jsonify({'error': str(e)}), 500

# ========== NEW: Ask AI Widget Endpoint ==========
@app.route('/ask-ai-widget', methods=['POST'])
def ask_ai_widget():
    try:
        data = request.get_json()
        widget_data = data.get('widgetData')
        widget_name = data.get('widgetName')
        
        # Initialize Gemini model
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        # Create the prompt based on widget type
        prompt = f"""You are a professional financial advisor analyzing data from a user's {widget_name}.

Widget Data:
{widget_data}

Please provide:
1. A clear explanation of what this data shows
2. Key insights and patterns you notice
3. Actionable recommendations for improvement
4. Any potential concerns or red flags

Keep your response conversational, helpful, and under 300 words. Focus on being practical and actionable."""
        
        # Send to Gemini API
        response = model.generate_content(prompt)
        
        return jsonify({
            'explanation': response.text,
            'success': True
        })
        
    except Exception as e:
        print(f"Error in ask_ai_widget: {e}")
        return jsonify({
            'error': str(e),
            'explanation': 'Unable to generate AI insights at this time. Please try again later.'
        }), 500

# ========== EXISTING ENDPOINTS (keep all your existing code) ==========

@app.route('/get-dashboard-data', methods=['GET'])
def get_dashboard_data():
    try:
        customer_id = request.args.get('customerId')
        
        if not customer_id or not NESSIE_API_KEY:
            return jsonify({'error': 'Missing customerId or API key'}), 400
        
        # Get customer accounts
        accounts_url = f"{NESSIE_BASE_URL}/customers/{customer_id}/accounts?key={NESSIE_API_KEY}"
        accounts_response = requests.get(accounts_url)
        
        if accounts_response.status_code != 200:
            return jsonify({'error': 'Failed to fetch accounts'}), 500
        
        accounts_data = accounts_response.json()
        
        # Calculate real net worth from accounts
        total_assets = 0
        total_liabilities = 0
        assets_breakdown = {'checking': 0, 'savings': 0, 'investments': 0}
        liabilities_breakdown = {'credit_cards': 0, 'loans': 0}
        
        for account in accounts_data:
            balance = float(account.get('balance', 0))
            account_type = account.get('type', '').lower()
            
            if account_type in ['checking', 'savings']:
                total_assets += balance
                assets_breakdown[account_type] += balance
            elif account_type == 'credit card':
                total_liabilities += abs(balance)
                liabilities_breakdown['credit_cards'] += abs(balance)
        
        # Get loans
        all_loans = []
        for account in accounts_data:
            account_id = account['_id']
            loans_url = f"{NESSIE_BASE_URL}/accounts/{account_id}/loans?key={NESSIE_API_KEY}"
            loans_response = requests.get(loans_url)
            
            if loans_response.status_code == 200:
                loans = loans_response.json()
                for loan in loans:
                    loan_amount = float(loan.get('amount', 0))
                    total_liabilities += loan_amount
                    liabilities_breakdown['loans'] += loan_amount
        
        net_worth = total_assets - total_liabilities
        
        # Get recent transactions for summary (last 30 days)
        all_transactions = []
        for account in accounts_data:
            account_id = account['_id']
            purchases_url = f"{NESSIE_BASE_URL}/accounts/{account_id}/purchases?key={NESSIE_API_KEY}"
            purchases_response = requests.get(purchases_url)
            
            if purchases_response.status_code == 200:
                purchases = purchases_response.json()
                # Apply any updates from TRANSACTION_UPDATES
                for purchase in purchases:
                    trans_id = purchase.get('_id')
                    if trans_id in TRANSACTION_UPDATES:
                        purchase.update(TRANSACTION_UPDATES[trans_id])
                all_transactions.extend(purchases[:5])
        
        # Filter out deleted transactions
        all_transactions = [t for t in all_transactions if not t.get('deleted', False)]
        
        # Sort by date
        all_transactions.sort(key=lambda x: x.get('purchase_date', ''), reverse=True)
        
        # Calculate budget metrics from transactions
        today = datetime.now()
        first_of_month = today.replace(day=1)
        
        current_month_expenses = 0
        current_month_income = 0
        
        for transaction in all_transactions:
            try:
                trans_date = datetime.strptime(transaction.get('purchase_date', ''), '%Y-%m-%d')
                if trans_date >= first_of_month:
                    amount = float(transaction.get('amount', 0))
                    if amount < 0:
                        current_month_expenses += abs(amount)
                    else:
                        current_month_income += amount
            except:
                pass
        
        # Estimate savings
        current_savings = current_month_income - current_month_expenses
        
        dashboard_data = {
            'net_worth': {
                'current': round(net_worth, 2),
                'change': round(net_worth * 0.04, 2),
                'change_percent': 4.0
            },
            'budget': {
                'income': {
                    'current': round(current_month_income, 2),
                    'budget': round(current_month_income * 1.1, 2),
                    'status': 'on_track'
                },
                'expenses': {
                    'current': round(current_month_expenses, 2),
                    'budget': round(current_month_expenses * 1.2, 2),
                    'status': 'under_budget' if current_month_expenses < current_month_income else 'over_budget'
                },
                'savings': {
                    'current': round(current_savings, 2),
                    'budget': round(current_month_income * 0.2, 2),
                    'status': 'on_track' if current_savings > 0 else 'under_budget'
                }
            },
            'assets_liabilities': {
                'assets': {
                    'total': round(total_assets, 2),
                    'breakdown': {
                        'checking': round(assets_breakdown['checking'], 2),
                        'savings': round(assets_breakdown['savings'], 2),
                        'investments': round(assets_breakdown['investments'], 2)
                    }
                },
                'liabilities': {
                    'total': round(total_liabilities, 2),
                    'breakdown': {
                        'credit_cards': round(liabilities_breakdown['credit_cards'], 2),
                        'loans': round(liabilities_breakdown['loans'], 2)
                    }
                }
            },
            'transactions': all_transactions[:10]
        }
        
        return jsonify(dashboard_data)
        
    except Exception as e:
        print(f"Error in get_dashboard_data: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/get-all-transactions', methods=['GET'])
def get_all_transactions():
    try:
        customer_id = request.args.get('customerId')
        days = request.args.get('days', '30')  # Default to 30 days
        
        if not customer_id or not NESSIE_API_KEY:
            return jsonify({'error': 'Missing customerId or API key'}), 400
        
        try:
            days_int = int(days)
        except:
            days_int = 30
        
        # Get customer accounts
        accounts_url = f"{NESSIE_BASE_URL}/customers/{customer_id}/accounts?key={NESSIE_API_KEY}"
        accounts_response = requests.get(accounts_url)
        
        if accounts_response.status_code != 200:
            return jsonify({'error': 'Failed to fetch accounts'}), 500
        
        accounts_data = accounts_response.json()
        all_transactions = []
        
        # Get transactions from all accounts
        for account in accounts_data:
            account_id = account['_id']
            
            # Get purchases
            purchases_url = f"{NESSIE_BASE_URL}/accounts/{account_id}/purchases?key={NESSIE_API_KEY}"
            purchases_response = requests.get(purchases_url)
            
            if purchases_response.status_code == 200:
                purchases = purchases_response.json()
                for purchase in purchases:
                    purchase['account_type'] = account.get('type', 'Unknown')
                    purchase['account_name'] = account.get('nickname', 'Account')
                    all_transactions.append(purchase)
        
        # If API returns limited data, generate realistic transactions for the time period
        if len(all_transactions) < 10:
            all_transactions = generate_realistic_transactions(days_int, accounts_data)
        
        # Filter by date range
        from datetime import datetime, timedelta
        cutoff_date = datetime.now() - timedelta(days=days_int)
        
        filtered_transactions = []
        for transaction in all_transactions:
            try:
                trans_date = datetime.strptime(transaction.get('purchase_date', ''), '%Y-%m-%d')
                if trans_date >= cutoff_date:
                    filtered_transactions.append(transaction)
            except:
                # If date parsing fails, include the transaction
                filtered_transactions.append(transaction)
        
        # Sort by date (most recent first)
        filtered_transactions.sort(key=lambda x: x.get('purchase_date', ''), reverse=True)
        
        # Group transactions by date for timeline
        grouped_transactions = defaultdict(list)
        for transaction in filtered_transactions:
            date = transaction.get('purchase_date', 'Unknown')
            grouped_transactions[date].append(transaction)
        
        # Get AI categorization for transactions
        if filtered_transactions:
            try:
                categorization_response = categorize_transactions(filtered_transactions[:20])
                categorized_map = {t['_id']: t.get('category', 'Other') for t in categorization_response.get('categorized_transactions', [])}
                
                for transaction in filtered_transactions:
                    if transaction.get('_id') in categorized_map:
                        transaction['category'] = categorized_map[transaction['_id']]
                    else:
                        transaction['category'] = 'Other'
            except:
                for transaction in filtered_transactions:
                    transaction['category'] = 'Other'
        
        return jsonify({
            'transactions': filtered_transactions,
            'grouped': dict(grouped_transactions),
            'total_count': len(filtered_transactions),
            'date_range_days': days_int
        })
        
    except Exception as e:
        print(f"Error in get_all_transactions: {str(e)}")
        return jsonify({'error': str(e)}), 500

def generate_realistic_transactions(days, accounts):
    """Generate realistic transaction data for demonstration"""
    from datetime import datetime, timedelta
    import random
    
    transactions = []
    today = datetime.now()
    
    # Common merchants and categories
    merchants = [
        {'name': 'Starbucks Coffee', 'category': 'Food & Drink', 'range': (4, 12)},
        {'name': 'Whole Foods Market', 'category': 'Groceries', 'range': (45, 150)},
        {'name': 'Shell Gas Station', 'category': 'Transport', 'range': (35, 65)},
        {'name': 'Amazon.com', 'category': 'Shopping', 'range': (20, 200)},
        {'name': 'Netflix', 'category': 'Entertainment', 'range': (15, 20)},
        {'name': 'Uber', 'category': 'Transport', 'range': (8, 35)},
        {'name': 'Target', 'category': 'Shopping', 'range': (25, 120)},
        {'name': 'Chipotle', 'category': 'Food & Drink', 'range': (10, 18)},
        {'name': 'CVS Pharmacy', 'category': 'Healthcare', 'range': (15, 75)},
        {'name': 'Planet Fitness', 'category': 'Entertainment', 'range': (45, 45)},
        {'name': 'ATM Withdrawal', 'category': 'Other', 'range': (40, 200)},
        {'name': 'Verizon Wireless', 'category': 'Bills & Utilities', 'range': (85, 95)},
        {'name': 'Electric Company', 'category': 'Bills & Utilities', 'range': (100, 180)},
        {'name': 'Spotify', 'category': 'Entertainment', 'range': (10, 11)},
        {'name': 'Trader Joes', 'category': 'Groceries', 'range': (30, 90)},
        {'name': 'McDonalds', 'category': 'Food & Drink', 'range': (6, 15)},
        {'name': 'Home Depot', 'category': 'Shopping', 'range': (40, 250)},
        {'name': 'Walmart', 'category': 'Shopping', 'range': (25, 100)},
        {'name': 'Subway', 'category': 'Food & Drink', 'range': (8, 12)},
        {'name': 'Apple Store', 'category': 'Shopping', 'range': (50, 500)},
    ]
    
    # Add income transactions
    income_sources = [
        {'name': 'Payroll Deposit', 'amount': 2500},
        {'name': 'Direct Deposit - Employer', 'amount': 2500},
    ]
    
    account = accounts[0] if accounts else {'_id': 'demo_account', 'type': 'Checking', 'nickname': 'Main Account'}
    
    # Generate transactions over the time period
    for day in range(days):
        date = (today - timedelta(days=day)).strftime('%Y-%m-%d')
        
        # Add 2-5 transactions per day
        num_transactions = random.randint(2, 5)
        
        for _ in range(num_transactions):
            merchant = random.choice(merchants)
            amount = round(random.uniform(merchant['range'][0], merchant['range'][1]), 2)
            
            transactions.append({
                '_id': f"trans_{date}_{len(transactions)}",
                'description': merchant['name'],
                'amount': -amount,  # Negative for expenses
                'purchase_date': date,
                'status': 'executed',
                'account_type': account.get('type', 'Checking'),
                'account_name': account.get('nickname', 'Account'),
                'category': merchant['category']
            })
        
        # Add income every 2 weeks (bi-weekly paycheck)
        if day % 14 == 0 and day > 0:
            income = random.choice(income_sources)
            transactions.append({
                '_id': f"income_{date}",
                'description': income['name'],
                'amount': income['amount'],
                'purchase_date': date,
                'status': 'executed',
                'account_type': account.get('type', 'Checking'),
                'account_name': account.get('nickname', 'Account'),
                'category': 'Income'
            })
    
    return transactions

@app.route('/get-recurring-expenses', methods=['GET'])
def get_recurring_expenses():
    try:
        customer_id = request.args.get('customerId')
        
        if not customer_id or not NESSIE_API_KEY:
            return jsonify({'error': 'Missing customerId or API key'}), 400
        
        # Get customer accounts
        accounts_url = f"{NESSIE_BASE_URL}/customers/{customer_id}/accounts?key={NESSIE_API_KEY}"
        accounts_response = requests.get(accounts_url)
        
        if accounts_response.status_code != 200:
            return jsonify({'error': 'Failed to fetch accounts'}), 500
        
        accounts_data = accounts_response.json()
        
        # Get bills from all accounts
        all_bills = []
        all_transactions = []
        all_loans = []
        
        for account in accounts_data:
            account_id = account['_id']
            
            # Get bills for this account
            bills_url = f"{NESSIE_BASE_URL}/accounts/{account_id}/bills?key={NESSIE_API_KEY}"
            bills_response = requests.get(bills_url)
            
            if bills_response.status_code == 200:
                bills = bills_response.json()
                for bill in bills:
                    bill['account_type'] = account.get('type', 'Unknown')
                    all_bills.append(bill)
            
            # Get purchases for pattern detection
            purchases_url = f"{NESSIE_BASE_URL}/accounts/{account_id}/purchases?key={NESSIE_API_KEY}"
            purchases_response = requests.get(purchases_url)
            
            if purchases_response.status_code == 200:
                purchases = purchases_response.json()
                all_transactions.extend(purchases)
            
            # Get loans
            loans_url = f"{NESSIE_BASE_URL}/accounts/{account_id}/loans?key={NESSIE_API_KEY}"
            loans_response = requests.get(loans_url)
            
            if loans_response.status_code == 200:
                loans = loans_response.json()
                all_loans.extend(loans)
        
        # Convert bills to recurring expenses format
        recurring_from_bills = []
        for bill in all_bills:
            recurring_from_bills.append({
                'description': bill.get('payee', 'Bill Payment'),
                'average_amount': abs(float(bill.get('payment_amount', 0))),
                'frequency': map_bill_status_to_frequency(bill.get('status', 'recurring')),
                'occurrences': 1,
                'last_date': bill.get('payment_date', None),
                'next_due': bill.get('upcoming_payment_date', calculate_next_due(bill.get('payment_date'))),
                'category': categorize_recurring(bill.get('payee', '')),
                'transactions': [],
                'source': 'bill',
                'bill_id': bill.get('_id')
            })
        
        # Convert loans to recurring expenses
        recurring_from_loans = []
        for loan in all_loans:
            recurring_from_loans.append({
                'description': f"{loan.get('type', 'Loan')} Payment",
                'average_amount': abs(float(loan.get('monthly_payment', 0))),
                'frequency': 'Monthly',
                'occurrences': 1,
                'last_date': None,
                'next_due': calculate_next_due(None),
                'category': 'Loans',
                'transactions': [],
                'source': 'loan',
                'loan_id': loan.get('_id')
            })
        
        # Detect recurring from transaction patterns
        recurring_from_patterns = detect_recurring_expenses(all_transactions)
        
        # Combine all recurring expenses
        all_recurring = recurring_from_bills + recurring_from_loans + recurring_from_patterns
        
        # If no data found, provide realistic demo data
        if len(all_recurring) == 0:
            all_recurring = get_demo_recurring_expenses()
        
        # Remove duplicates and sort by amount
        all_recurring.sort(key=lambda x: x['average_amount'], reverse=True)
        
        total_monthly = sum(exp['average_amount'] for exp in all_recurring)
        
        return jsonify({
            'recurring_expenses': all_recurring,
            'total_monthly': total_monthly
        })
        
    except Exception as e:
        print(f"Error in get_recurring_expenses: {str(e)}")
        return jsonify({'error': str(e)}), 500

def map_bill_status_to_frequency(status):
    """Map bill status to frequency"""
    status_map = {
        'recurring': 'Monthly',
        'pending': 'Monthly',
        'cancelled': 'Cancelled',
        'completed': 'One-time'
    }
    return status_map.get(status.lower(), 'Monthly')

def calculate_next_due(last_date):
    """Calculate next due date based on last payment"""
    from datetime import datetime, timedelta
    
    if last_date:
        try:
            last = datetime.strptime(last_date, '%Y-%m-%d')
            next_due = last + timedelta(days=30)
            return next_due.strftime('%Y-%m-%d')
        except:
            pass
    
    # Default to 15 days from now
    today = datetime.now()
    next_due = today + timedelta(days=15)
    return next_due.strftime('%Y-%m-%d')

def get_demo_recurring_expenses():
    """Provide realistic demo data when API returns no data"""
    from datetime import datetime, timedelta
    
    today = datetime.now()
    
    demo_expenses = [
        {
            'description': 'Mortgage Payment',
            'average_amount': 1650.00,
            'frequency': 'Monthly',
            'occurrences': 12,
            'last_date': (today - timedelta(days=5)).strftime('%Y-%m-%d'),
            'next_due': (today + timedelta(days=25)).strftime('%Y-%m-%d'),
            'category': 'Housing',
            'transactions': [
                {'date': (today - timedelta(days=5)).strftime('%Y-%m-%d'), 'amount': 1650.00, 'description': 'Mortgage Payment'},
                {'date': (today - timedelta(days=35)).strftime('%Y-%m-%d'), 'amount': 1650.00, 'description': 'Mortgage Payment'},
                {'date': (today - timedelta(days=65)).strftime('%Y-%m-%d'), 'amount': 1650.00, 'description': 'Mortgage Payment'},
            ],
            'source': 'demo'
        },
        {
            'description': 'Car Loan Payment',
            'average_amount': 425.00,
            'frequency': 'Monthly',
            'occurrences': 8,
            'last_date': (today - timedelta(days=10)).strftime('%Y-%m-%d'),
            'next_due': (today + timedelta(days=20)).strftime('%Y-%m-%d'),
            'category': 'Transportation',
            'transactions': [
                {'date': (today - timedelta(days=10)).strftime('%Y-%m-%d'), 'amount': 425.00, 'description': 'Car Loan Payment'},
                {'date': (today - timedelta(days=40)).strftime('%Y-%m-%d'), 'amount': 425.00, 'description': 'Car Loan Payment'},
            ],
            'source': 'demo'
        },
        {
            'description': 'Electric Bill',
            'average_amount': 132.50,
            'frequency': 'Monthly',
            'occurrences': 12,
            'last_date': (today - timedelta(days=8)).strftime('%Y-%m-%d'),
            'next_due': (today + timedelta(days=22)).strftime('%Y-%m-%d'),
            'category': 'Utilities',
            'transactions': [
                {'date': (today - timedelta(days=8)).strftime('%Y-%m-%d'), 'amount': 145.30, 'description': 'Electric Bill'},
                {'date': (today - timedelta(days=38)).strftime('%Y-%m-%d'), 'amount': 119.70, 'description': 'Electric Bill'},
            ],
            'source': 'demo'
        },
        {
            'description': 'Internet Service',
            'average_amount': 79.99,
            'frequency': 'Monthly',
            'occurrences': 24,
            'last_date': (today - timedelta(days=3)).strftime('%Y-%m-%d'),
            'next_due': (today + timedelta(days=27)).strftime('%Y-%m-%d'),
            'category': 'Utilities',
            'transactions': [
                {'date': (today - timedelta(days=3)).strftime('%Y-%m-%d'), 'amount': 79.99, 'description': 'Internet Service'},
                {'date': (today - timedelta(days=33)).strftime('%Y-%m-%d'), 'amount': 79.99, 'description': 'Internet Service'},
            ],
            'source': 'demo'
        },
        {
            'description': 'Verizon Mobile',
            'average_amount': 95.00,
            'frequency': 'Monthly',
            'occurrences': 18,
            'last_date': (today - timedelta(days=12)).strftime('%Y-%m-%d'),
            'next_due': (today + timedelta(days=18)).strftime('%Y-%m-%d'),
            'category': 'Phone',
            'transactions': [
                {'date': (today - timedelta(days=12)).strftime('%Y-%m-%d'), 'amount': 95.00, 'description': 'Verizon Mobile'},
                {'date': (today - timedelta(days=42)).strftime('%Y-%m-%d'), 'amount': 95.00, 'description': 'Verizon Mobile'},
            ],
            'source': 'demo'
        },
        {
            'description': 'Car Insurance',
            'average_amount': 156.00,
            'frequency': 'Monthly',
            'occurrences': 12,
            'last_date': (today - timedelta(days=15)).strftime('%Y-%m-%d'),
            'next_due': (today + timedelta(days=15)).strftime('%Y-%m-%d'),
            'category': 'Insurance',
            'transactions': [
                {'date': (today - timedelta(days=15)).strftime('%Y-%m-%d'), 'amount': 156.00, 'description': 'Car Insurance'},
                {'date': (today - timedelta(days=45)).strftime('%Y-%m-%d'), 'amount': 156.00, 'description': 'Car Insurance'},
            ],
            'source': 'demo'
        },
        {
            'description': 'Netflix Subscription',
            'average_amount': 15.99,
            'frequency': 'Monthly',
            'occurrences': 24,
            'last_date': (today - timedelta(days=7)).strftime('%Y-%m-%d'),
            'next_due': (today + timedelta(days=23)).strftime('%Y-%m-%d'),
            'category': 'Subscriptions',
            'transactions': [
                {'date': (today - timedelta(days=7)).strftime('%Y-%m-%d'), 'amount': 15.99, 'description': 'Netflix Subscription'},
                {'date': (today - timedelta(days=37)).strftime('%Y-%m-%d'), 'amount': 15.99, 'description': 'Netflix Subscription'},
            ],
            'source': 'demo'
        },
        {
            'description': 'Spotify Premium',
            'average_amount': 10.99,
            'frequency': 'Monthly',
            'occurrences': 18,
            'last_date': (today - timedelta(days=2)).strftime('%Y-%m-%d'),
            'next_due': (today + timedelta(days=28)).strftime('%Y-%m-%d'),
            'category': 'Subscriptions',
            'transactions': [
                {'date': (today - timedelta(days=2)).strftime('%Y-%m-%d'), 'amount': 10.99, 'description': 'Spotify Premium'},
                {'date': (today - timedelta(days=32)).strftime('%Y-%m-%d'), 'amount': 10.99, 'description': 'Spotify Premium'},
            ],
            'source': 'demo'
        },
        {
            'description': 'Gym Membership',
            'average_amount': 45.00,
            'frequency': 'Monthly',
            'occurrences': 12,
            'last_date': (today - timedelta(days=4)).strftime('%Y-%m-%d'),
            'next_due': (today + timedelta(days=26)).strftime('%Y-%m-%d'),
            'category': 'Subscriptions',
            'transactions': [
                {'date': (today - timedelta(days=4)).strftime('%Y-%m-%d'), 'amount': 45.00, 'description': 'Gym Membership'},
                {'date': (today - timedelta(days=34)).strftime('%Y-%m-%d'), 'amount': 45.00, 'description': 'Gym Membership'},
            ],
            'source': 'demo'
        },
        {
            'description': 'Water & Sewer Bill',
            'average_amount': 68.50,
            'frequency': 'Monthly',
            'occurrences': 12,
            'last_date': (today - timedelta(days=20)).strftime('%Y-%m-%d'),
            'next_due': (today + timedelta(days=10)).strftime('%Y-%m-%d'),
            'category': 'Utilities',
            'transactions': [
                {'date': (today - timedelta(days=20)).strftime('%Y-%m-%d'), 'amount': 72.30, 'description': 'Water & Sewer Bill'},
                {'date': (today - timedelta(days=50)).strftime('%Y-%m-%d'), 'amount': 64.70, 'description': 'Water & Sewer Bill'},
            ],
            'source': 'demo'
        },
    ]
    
    return demo_expenses

def detect_recurring_expenses(transactions):
    """Detect recurring expenses from transaction list"""
    if not transactions or len(transactions) < 2:
        return []
    
    # Group similar transactions by description (improved matching)
    description_groups = defaultdict(list)
    
    for transaction in transactions:
        desc = transaction.get('description', '').lower()
        amount = abs(float(transaction.get('amount', 0)))
        date = transaction.get('purchase_date', '')
        
        # Only process expenses (negative amounts)
        if amount <= 0:
            continue
        
        # Normalize description - remove common words and numbers
        normalized_desc = ' '.join([
            word for word in desc.split() 
            if word not in ['the', 'at', 'in', 'on', 'payment', 'bill', 'auto']
            and not word.isdigit()
        ])[:30]  # Take first 30 chars
        
        if normalized_desc:
            description_groups[normalized_desc].append({
                'amount': amount,
                'date': date,
                'description': transaction.get('description', ''),
                'id': transaction.get('_id', '')
            })
    
    # Identify recurring patterns (2+ transactions with similar amounts)
    recurring = []
    
    for key, group in description_groups.items():
        if len(group) >= 2:  # At least 2 occurrences
            amounts = [t['amount'] for t in group]
            avg_amount = sum(amounts) / len(amounts)
            
            # Check if amounts are similar (within 30% variance for utilities)
            variance = max(amounts) - min(amounts)
            if avg_amount > 0 and (variance / avg_amount <= 0.3 or len(group) >= 3):
                # Calculate frequency
                dates = sorted([t['date'] for t in group if t['date']])
                
                frequency = 'Monthly'
                if len(dates) >= 2:
                    try:
                        # Calculate average days between transactions
                        date_objects = [datetime.strptime(d, '%Y-%m-%d') for d in dates]
                        gaps = [(date_objects[i+1] - date_objects[i]).days for i in range(len(date_objects)-1)]
                        avg_gap = sum(gaps) / len(gaps) if gaps else 30
                        
                        if avg_gap < 10:
                            frequency = 'Weekly'
                        elif avg_gap < 20:
                            frequency = 'Bi-weekly'
                        elif avg_gap < 40:
                            frequency = 'Monthly'
                        else:
                            frequency = 'Irregular'
                    except:
                        frequency = 'Monthly'
                
                # Determine next due date
                if dates:
                    last_date = datetime.strptime(dates[-1], '%Y-%m-%d')
                    from datetime import timedelta
                    
                    # Add appropriate days based on frequency
                    days_to_add = {
                        'Weekly': 7,
                        'Bi-weekly': 14,
                        'Monthly': 30,
                        'Irregular': 30
                    }.get(frequency, 30)
                    
                    next_date = (last_date + timedelta(days=days_to_add)).strftime('%Y-%m-%d')
                else:
                    next_date = None
                
                recurring.append({
                    'description': group[0]['description'],
                    'average_amount': round(avg_amount, 2),
                    'frequency': frequency,
                    'occurrences': len(group),
                    'last_date': dates[-1] if dates else None,
                    'next_due': next_date,
                    'category': categorize_recurring(group[0]['description']),
                    'transactions': group,
                    'source': 'pattern'
                })
    
    # Sort by amount (highest first)
    recurring.sort(key=lambda x: x['average_amount'], reverse=True)
    
    return recurring

def categorize_recurring(description):
    """Smart category detection for recurring expenses"""
    desc_lower = description.lower()
    
    categories = {
        'Housing': ['rent', 'mortgage', 'hoa', 'apartment', 'property', 'lease'],
        'Utilities': ['electric', 'gas', 'water', 'sewer', 'internet', 'cable', 'wifi', 'utility', 'power', 'energy'],
        'Insurance': ['insurance', 'premium', 'policy', 'geico', 'state farm', 'allstate', 'progressive'],
        'Subscriptions': ['netflix', 'spotify', 'hulu', 'disney', 'amazon prime', 'subscription', 'membership', 'gym', 'fitness', 'youtube', 'apple music'],
        'Transportation': ['car payment', 'auto', 'vehicle', 'toyota', 'honda', 'ford', 'chevrolet', 'bmw', 'uber', 'lyft'],
        'Phone': ['phone', 'mobile', 'verizon', 'at&t', 't-mobile', 'sprint', 'cellular', 'wireless'],
        'Loans': ['loan', 'student loan', 'personal loan', 'credit'],
    }
    
    for category, keywords in categories.items():
        if any(keyword in desc_lower for keyword in keywords):
            return category
    
    return 'Other'

def categorize_transactions(transactions):
    """Use AI to categorize transactions"""
    try:
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        prompt = f"""Categorize these transactions and return ONLY valid JSON:

{{
  "categorized_transactions": [
    {{
      "_id": "transaction_id",
      "category": "Category Name"
    }}
  ]
}}

Categories: Food & Drink, Shopping, Transport, Bills & Utilities, Entertainment, Groceries, Healthcare, Travel, Other

Transactions:
{transactions[:20]}"""
        
        response = model.generate_content(prompt)
        
        import json
        response_text = response.text.strip()
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.startswith('```'):
            response_text = response_text[3:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        
        result = json.loads(response_text.strip())
        return result
        
    except Exception as e:
        print(f"Error categorizing: {e}")
        return {'categorized_transactions': []}

@app.route('/get-transactions', methods=['GET'])
def get_transactions():
    try:
        customer_id = request.args.get('customerId')
        
        if not customer_id or not NESSIE_API_KEY:
            return jsonify({'error': 'Missing customerId or API key'}), 400
        
        # Get customer accounts
        accounts_url = f"{NESSIE_BASE_URL}/customers/{customer_id}/accounts?key={NESSIE_API_KEY}"
        accounts_response = requests.get(accounts_url)
        
        if accounts_response.status_code != 200:
            return jsonify({'error': f'Failed to fetch accounts: {accounts_response.status_code}'}), 500
        
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
        transactions_url = f"{NESSIE_BASE_URL}/accounts/{account_id}/purchases?key={NESSIE_API_KEY}"
        transactions_response = requests.get(transactions_url)
        
        if transactions_response.status_code != 200:
            return jsonify({'error': 'Failed to fetch transactions'}), 500
        
        transactions = transactions_response.json()
        
        # Apply updates
        for transaction in transactions:
            trans_id = transaction.get('_id')
            if trans_id in TRANSACTION_UPDATES:
                transaction.update(TRANSACTION_UPDATES[trans_id])
        
        # Filter out deleted
        transactions = [t for t in transactions if not t.get('deleted', False)]
        
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
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
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
            
            # Clean the response text - remove markdown code blocks if present
            response_text = response.text.strip()
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.startswith('```'):
                response_text = response_text[3:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            
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