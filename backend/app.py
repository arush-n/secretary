from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import google.generativeai as genai
import os
import logging
from dotenv import load_dotenv
from datetime import datetime, timedelta
from collections import defaultdict
import json

# Suppress gRPC ALTS warnings
os.environ['GRPC_VERBOSITY'] = 'ERROR'
os.environ['GRPC_TRACE'] = ''

# Import Plaid SDK
import plaid
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.accounts_balance_get_request import AccountsBalanceGetRequest
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from plaid.model.sandbox_public_token_create_request import SandboxPublicTokenCreateRequest

# Import AI modules for investment features
try:
    from stock_advisor import StockAdvisor
    from financial_advisory import FinancialAdvisory
    from agent import InvestmentAgent
    INVESTMENT_FEATURES_AVAILABLE = True
except ImportError:
    INVESTMENT_FEATURES_AVAILABLE = False
    print("Warning: Investment modules not available. Stock advisor features will be disabled.")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Request logging middleware
@app.before_request
def log_request():
    logger.info(f'{request.method} {request.path}')

# Configure Gemini API
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

# Configure Plaid API
PLAID_CLIENT_ID = os.getenv('PLAID_CLIENT_ID')
PLAID_SECRET = os.getenv('PLAID_SECRET')
PLAID_ENV = os.getenv('PLAID_ENV', 'sandbox')

# Map environment string to Plaid environment
PLAID_ENV_MAP = {
    'sandbox': plaid.Environment.Sandbox,
    'production': plaid.Environment.Production,
}


# Initialize Plaid client
plaid_configuration = plaid.Configuration(
    host=PLAID_ENV_MAP.get(PLAID_ENV, plaid.Environment.Sandbox),
    api_key={
        'clientId': PLAID_CLIENT_ID,
        'secret': PLAID_SECRET,
    }
)
api_client = plaid.ApiClient(plaid_configuration)
plaid_client = plaid_api.PlaidApi(api_client)

# In-memory storage for access tokens and cursors (use database in production)
PLAID_ACCESS_TOKENS = {}
PLAID_ITEM_IDS = {}
PLAID_TRANSACTION_CURSORS = {}

# Default sandbox access token (for demo purposes)
DEFAULT_ACCESS_TOKEN = None

SEARCHAPI_KEY = os.getenv('SEARCH_API_KEY') or os.getenv('SEARCHAPI_KEY') or os.getenv('SEARCH_APIIO_KEY')

# Initialize AI agents if available
if INVESTMENT_FEATURES_AVAILABLE:
    investment_agent = InvestmentAgent()

# Minimal city-to-IATA mapping for vacation suggestions
CITY_TO_IATA = {
    # Florida
    'miami': 'MIA',
    'key west': 'EYW',
    'tampa': 'TPA',
    'st. augustine': 'UST',
    'everglades': 'MIA',
    'key largo': 'MIA',
    'naples': 'RSW',
    'sanibel island': 'RSW',
    # Europe
    'paris': 'CDG',
    'rome': 'FCO',
    'berlin': 'BER',
    'barcelona': 'BCN',
    'interlaken': 'ZRH',
    'chamonix': 'GVA',
    'santorini': 'JTR',
    'madeira': 'FNC',
    'bologna': 'BLQ',
    'san sebastián': 'EAS',
    'san sebastian': 'EAS',
    # Asia
    'kyoto': 'KIX',
    'siem reap': 'REP',
    'bangkok': 'BKK',
    'seoul': 'ICN',
    'pokhara': 'PKR',
    'borneo': 'BKI',
    'bali': 'DPS',
    'langkawi': 'LGK',
    'tokyo': 'HND',
    'taipei': 'TPE',
}

# ========== Categories and Tags Management ==========
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
    'Travel',
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

# ========== Plaid API Endpoints ==========

def get_or_create_sandbox_token():
    """Get existing access token or create a new one for sandbox testing"""
    global DEFAULT_ACCESS_TOKEN
    
    if DEFAULT_ACCESS_TOKEN:
        return DEFAULT_ACCESS_TOKEN
    
    try:
        # Create a sandbox public token
        pt_request = SandboxPublicTokenCreateRequest(
            institution_id='ins_109508',  # First Platypus Bank (sandbox institution)
            initial_products=[Products('transactions'), Products('auth')]
        )
        pt_response = plaid_client.sandbox_public_token_create(pt_request)
        public_token = pt_response['public_token']
        
        # Exchange for access token
        exchange_request = ItemPublicTokenExchangeRequest(public_token=public_token)
        exchange_response = plaid_client.item_public_token_exchange(exchange_request)
        
        DEFAULT_ACCESS_TOKEN = exchange_response['access_token']
        PLAID_ACCESS_TOKENS['default'] = DEFAULT_ACCESS_TOKEN
        PLAID_ITEM_IDS['default'] = exchange_response['item_id']
        
        logger.info(f"Created sandbox access token for item: {exchange_response['item_id']}")
        return DEFAULT_ACCESS_TOKEN
        
    except plaid.ApiException as e:
        logger.error(f"Plaid API error creating sandbox token: {e}")
        raise e

@app.route('/api/create_link_token', methods=['POST'])
def create_link_token():
    """Create a Plaid Link token for client-side Link initialization"""
    try:
        request_data = LinkTokenCreateRequest(
            products=[Products('transactions'), Products('auth')],
            client_name='Secretary Finance',
            country_codes=[CountryCode('US')],
            language='en',
            user=LinkTokenCreateRequestUser(
                client_user_id='user-' + str(datetime.now().timestamp())
            )
        )
        response = plaid_client.link_token_create(request_data)
        return jsonify({
            'link_token': response['link_token'],
            'expiration': response['expiration']
        })
    except plaid.ApiException as e:
        error_response = json.loads(e.body)
        logger.error(f"Plaid API error: {error_response}")
        return jsonify({'error': error_response.get('error_message', 'Failed to create link token')}), 400

@app.route('/api/exchange_public_token', methods=['POST'])
def exchange_public_token():
    """Exchange a public token from Plaid Link for an access token"""
    try:
        data = request.get_json()
        public_token = data.get('public_token')
        
        if not public_token:
            return jsonify({'error': 'Missing public_token'}), 400
        
        exchange_request = ItemPublicTokenExchangeRequest(public_token=public_token)
        exchange_response = plaid_client.item_public_token_exchange(exchange_request)
        
        access_token = exchange_response['access_token']
        item_id = exchange_response['item_id']
        
        # Store the access token (in production, store securely in database)
        PLAID_ACCESS_TOKENS[item_id] = access_token
        PLAID_ITEM_IDS[item_id] = item_id
        
        return jsonify({
            'success': True,
            'item_id': item_id
        })
    except plaid.ApiException as e:
        error_response = json.loads(e.body)
        logger.error(f"Plaid API error: {error_response}")
        return jsonify({'error': error_response.get('error_message', 'Failed to exchange token')}), 400

@app.route('/api/plaid/accounts', methods=['GET'])
def get_plaid_accounts():
    """Get account balances from Plaid"""
    try:
        # Get or create sandbox access token for demo
        access_token = get_or_create_sandbox_token()
        
        balance_request = AccountsBalanceGetRequest(access_token=access_token)
        balance_response = plaid_client.accounts_balance_get(balance_request)
        
        accounts = []
        for account in balance_response['accounts']:
            accounts.append({
                'account_id': account['account_id'],
                'name': account['name'],
                'official_name': account.get('official_name'),
                'type': account['type'],
                'subtype': account.get('subtype'),
                'balance': {
                    'available': account['balances'].get('available'),
                    'current': account['balances'].get('current'),
                    'limit': account['balances'].get('limit'),
                    'currency': account['balances'].get('iso_currency_code', 'USD')
                },
                'mask': account.get('mask')
            })
        
        return jsonify({
            'accounts': accounts,
            'item_id': balance_response['item']['item_id']
        })
    except plaid.ApiException as e:
        error_response = json.loads(e.body)
        logger.error(f"Plaid API error: {error_response}")
        return jsonify({'error': error_response.get('error_message', 'Failed to get accounts')}), 400
    except Exception as e:
        logger.error(f"Error getting accounts: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/plaid/transactions', methods=['GET'])
def get_plaid_transactions():
    """Get transactions using Plaid's transactions/sync endpoint with cursor-based pagination"""
    try:
        # Get or create sandbox access token for demo
        access_token = get_or_create_sandbox_token()
        
        # Get cursor if it exists
        cursor = PLAID_TRANSACTION_CURSORS.get('default', '')
        
        all_transactions = []
        has_more = True
        
        while has_more:
            sync_request = TransactionsSyncRequest(
                access_token=access_token,
                cursor=cursor if cursor else None
            )
            sync_response = plaid_client.transactions_sync(sync_request)
            
            # Process added transactions
            for transaction in sync_response['added']:
                all_transactions.append({
                    'transaction_id': transaction['transaction_id'],
                    'account_id': transaction['account_id'],
                    'date': transaction['date'],
                    'name': transaction['name'],
                    'merchant_name': transaction.get('merchant_name'),
                    'amount': transaction['amount'],  # Positive = expense, negative = income in Plaid
                    'category': transaction.get('category', []),
                    'category_id': transaction.get('category_id'),
                    'pending': transaction['pending'],
                    'payment_channel': transaction.get('payment_channel'),
                    'location': {
                        'city': transaction['location'].get('city') if transaction.get('location') else None,
                        'region': transaction['location'].get('region') if transaction.get('location') else None,
                    } if transaction.get('location') else None
                })
            
            # Update cursor for next sync
            cursor = sync_response['next_cursor']
            has_more = sync_response['has_more']
            
            # Limit iterations for safety
            if len(all_transactions) > 500:
                break
        
        # Store cursor for future syncs
        PLAID_TRANSACTION_CURSORS['default'] = cursor
        
        # Sort by date (newest first)
        all_transactions.sort(key=lambda x: x['date'], reverse=True)
        
        return jsonify({
            'transactions': all_transactions,
            'total_count': len(all_transactions)
        })
    except plaid.ApiException as e:
        error_response = json.loads(e.body)
        logger.error(f"Plaid API error: {error_response}")
        return jsonify({'error': error_response.get('error_message', 'Failed to get transactions')}), 400
    except Exception as e:
        logger.error(f"Error getting transactions: {e}")
        return jsonify({'error': str(e)}), 500

def transform_plaid_transaction_to_legacy(plaid_transaction):
    """Transform a Plaid transaction to match the legacy Nessie format for backward compatibility"""
    # Plaid uses positive amounts for expenses, we negate for our format
    amount = plaid_transaction['amount']
    
    return {
        '_id': plaid_transaction['transaction_id'],
        'purchase_date': plaid_transaction['date'],
        'description': plaid_transaction.get('merchant_name') or plaid_transaction['name'],
        'amount': -amount if amount > 0 else abs(amount),  # Expenses negative, income positive
        'status': 'pending' if plaid_transaction['pending'] else 'executed',
        'category': plaid_transaction['category'][0] if plaid_transaction.get('category') else 'Other',
        'merchant_id': plaid_transaction.get('merchant_name'),
        'account_id': plaid_transaction['account_id']
    }

def transform_plaid_account_to_legacy(plaid_account):
    """Transform a Plaid account to match the legacy Nessie format for backward compatibility"""
    # Map Plaid account types to legacy types
    type_mapping = {
        'depository': 'Checking' if plaid_account.get('subtype') == 'checking' else 'Savings',
        'credit': 'Credit Card',
        'loan': 'Loan',
        'investment': 'Investment'
    }
    
    return {
        '_id': plaid_account['account_id'],
        'type': type_mapping.get(plaid_account['type'], 'Other'),
        'nickname': plaid_account['name'],
        'balance': plaid_account['balance']['current'] or 0
    }

# ========== Vacation & Flight Search Endpoints ==========
def _cheapest_flight_response(arrival: str, outbound_date: str, return_date: str):
    logger.info(f'Flight search request: {arrival}, {outbound_date} to {return_date}')
    
    if not SEARCHAPI_KEY:
        logger.error('Missing SEARCH_API_KEY')
        return jsonify({'error': 'Missing SEARCH_API_KEY'}), 400

    if not arrival or not outbound_date or not return_date:
        logger.error('Missing required parameters')
        return jsonify({'error': 'arrival, outbound_date and return_date are required'}), 400

    url = 'https://www.searchapi.io/api/v1/search'
    
    # Convert arrival to lowercase for case-insensitive lookup
    arrival_lower = (arrival or '').strip().lower()
    arrival_id = CITY_TO_IATA.get(arrival_lower, arrival)
    logger.info(f'Using arrival airport code: {arrival_id} for {arrival}')
    
    params = {
        'engine': 'google_flights',
        'flight_type': 'round_trip',
        'departure_id': 'JFK',
        'arrival_id': arrival_id,
        'outbound_date': outbound_date,
        'return_date': return_date,
        'show_cheapest_flights': 'true',
        'sort_by': 'price',
        'api_key': SEARCHAPI_KEY,
    }
    
    try:
        logger.info(f'Making request to SearchAPI with params: {params}')
        r = requests.get(url, params=params, timeout=20)
        logger.info(f'SearchAPI response status: {r.status_code}')
        
        if r.status_code != 200:
            logger.error(f'SearchAPI error: {r.status_code} - {r.text}')
            return jsonify({'error': 'searchapi error', 'status': r.status_code, 'details': r.text}), 502
        
        data = r.json()
        logger.info(f'SearchAPI returned data with keys: {list(data.keys())}')
    except requests.Timeout:
        logger.error('Request timeout')
        return jsonify({'error': 'Request timeout'}), 504
    except requests.RequestException as e:
        logger.error(f'Request failed: {str(e)}')
        return jsonify({'error': f'Request failed: {str(e)}'}), 502
    except Exception as e:
        logger.error(f'Unexpected error: {str(e)}')
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500

    flights = data.get('cheapest_flights') or data.get('best_flights') or data.get('other_flights') or []
    logger.info(f'Found {len(flights)} flights')
    
    if not flights:
        logger.warning('No flights found in response')
        return jsonify({'flights': [], 'price_insights': data.get('price_insights')}), 200

    priced = [f for f in flights if isinstance(f.get('price'), (int, float))]
    flights_sorted = sorted(priced, key=lambda x: x.get('price')) if priced else flights
    
    # Return top 3 cheapest flights
    top_flights = flights_sorted[:3]
    
    results = []
    for flight in top_flights:
        result = {
            'price': flight.get('price'),
            'type': flight.get('type'),
            'airline_logo': flight.get('airline_logo'),
            'segments': [
                {
                    'airline': seg.get('airline'),
                    'flight_number': seg.get('flight_number'),
                    'departure': {
                        'airport': seg.get('departure_airport', {}).get('id'),
                        'date': seg.get('departure_airport', {}).get('date'),
                        'time': seg.get('departure_airport', {}).get('time'),
                        'name': seg.get('departure_airport', {}).get('name')
                    },
                    'arrival': {
                        'airport': seg.get('arrival_airport', {}).get('id'),
                        'date': seg.get('arrival_airport', {}).get('date'),
                        'time': seg.get('arrival_airport', {}).get('time'),
                        'name': seg.get('arrival_airport', {}).get('name')
                    },
                    'duration': seg.get('duration'),
                    'travel_class': seg.get('travel_class')
                } for seg in (flight.get('flights') or [])
            ]
        }
        results.append(result)
    
    return jsonify({'flights': results})

@app.route('/flights/cheapest', methods=['GET'])
def get_cheapest_flight():
    try:
        return _cheapest_flight_response(
            request.args.get('arrival') or request.args.get('arrivalId'),
            request.args.get('outbound_date') or request.args.get('outboundDate'),
            request.args.get('return_date') or request.args.get('returnDate'),
        )
    except Exception as e:
        logger.error(f'Error in get_cheapest_flight: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/get-cheapest-flight', methods=['GET'])
def get_cheapest_flight_simple():
    try:
        return _cheapest_flight_response(
            request.args.get('arrival') or request.args.get('arrivalId'),
            request.args.get('outbound_date') or request.args.get('outboundDate'),
            request.args.get('return_date') or request.args.get('returnDate'),
        )
    except Exception as e:
        logger.error(f'Error in get_cheapest_flight_simple: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/get-vacation-suggestions', methods=['POST'])
def get_vacation_suggestions():
    try:
        data = request.get_json()
        selected_locations = data.get('selectedLocations', [])
        vacation_priority = data.get('vacationPriority', 'balanced')
        
        if not selected_locations:
            return jsonify({'error': 'No locations provided'}), 400
        
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Define priority descriptions
        priority_descriptions = {
            'adventure': 'outdoor activities, hiking, water sports, extreme sports, nature exploration',
            'relaxation': 'beaches, spas, peaceful environments, scenic views, slow-paced activities',
            'culture': 'museums, historical sites, local cuisine, cultural experiences, architecture',
            'nightlife': 'bars, clubs, entertainment venues, dining scene, vibrant social atmosphere',
            'balanced': 'a mix of activities including sightseeing, dining, some adventure, and relaxation'
        }
        
        priority_desc = priority_descriptions.get(vacation_priority, 'various activities')
        
        prompt = f"""Based on the selected regions and vacation preferences, suggest 3 cities that best match the criteria.
Return ONLY a valid JSON object with this exact structure:

{{
  "suggestions": [
    {{
      "city": "City Name",
      "airport": "Full Airport Name",
      "airport_code": "XXX",
      "description": "2-3 sentence description highlighting why this city matches the preferences"
    }}
  ]
}}

Selected regions: {', '.join(selected_locations)}
Vacation priority: {vacation_priority} (focused on {priority_desc})

Requirements:
1. Choose cities ONLY from the selected regions
2. Prioritize cities that strongly match the vacation priority
3. Ensure cities have major international airports
4. Provide diverse options (don't suggest cities too close to each other)
5. Include the official IATA airport code
6. Make descriptions specific to why each city matches the preferences

Return ONLY the JSON object, no additional text."""
        
        response = model.generate_content(prompt)
        
        try:
            import json
            
            response_text = response.text.strip()
            
            # Clean markdown code blocks
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.startswith('```'):
                response_text = response_text[3:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            
            response_text = response_text.strip()
            result = json.loads(response_text)
            
            # Validate the structure
            if 'suggestions' not in result or not isinstance(result['suggestions'], list):
                raise ValueError('Invalid response structure')
            
            # Ensure we have exactly 3 suggestions
            if len(result['suggestions']) > 3:
                result['suggestions'] = result['suggestions'][:3]
            elif len(result['suggestions']) < 3:
                logger.warning(f'Only {len(result["suggestions"])} suggestions returned')
            
            # Validate each suggestion has required fields
            for suggestion in result['suggestions']:
                required_fields = ['city', 'airport', 'airport_code', 'description']
                for field in required_fields:
                    if field not in suggestion:
                        raise ValueError(f'Missing required field: {field}')
            
            logger.info(f'Successfully generated {len(result["suggestions"])} vacation suggestions')
            return jsonify(result)
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            logger.error(f"Cleaned response text: {response_text}")
            return jsonify({
                'error': 'Failed to parse AI response',
                'suggestions': []
            }), 500
        except ValueError as e:
            logger.error(f"Validation error: {e}")
            logger.error(f"Response text: {response_text}")
            return jsonify({
                'error': 'Invalid AI response structure',
                'suggestions': []
            }), 500
        except Exception as e:
            logger.error(f"Error parsing Gemini response: {e}")
            logger.error(f"Response text: {response.text}")
            return jsonify({
                'error': 'Failed to generate suggestions',
                'suggestions': []
            }), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in vacation suggestions: {e}")
        return jsonify({'error': str(e)}), 500

# ========== Transaction Update Endpoints ==========
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

# ========== Ask AI Widget Endpoint ==========
@app.route('/ask-ai-widget', methods=['POST'])
def ask_ai_widget():
    try:
        data = request.get_json()
        widget_data = data.get('widgetData')
        widget_name = data.get('widgetName')
        
        # Initialize Gemini model
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Create the prompt based on widget type
        prompt = f"""You are an expert financial analyst with over 20 years of experience in personal finance management. You're reviewing data from a user's {widget_name} dashboard widget.

CONTEXT & DATA:
{widget_data}

ANALYSIS FRAMEWORK:
Please provide a comprehensive yet concise analysis covering:

1. DATA INTERPRETATION:
   - What story does this data tell about the user's financial situation?
   - What are the key numbers and what do they signify?

2. PATTERN RECOGNITION:
   - Identify trends (positive or negative)
   - Spot anomalies or areas of concern
   - Recognize opportunities for optimization

3. ACTIONABLE INSIGHTS:
   - Provide 2-3 specific, implementable recommendations
   - Prioritize actions by impact (high/medium/low)
   - Include concrete numbers or percentages where relevant

4. RISK ASSESSMENT:
   - Flag any red flags or concerning patterns
   - Assess urgency level (immediate action needed vs. long-term planning)
   - Identify potential financial vulnerabilities

RESPONSE STYLE:
- Be direct and specific with numbers
- Use clear, jargon-free language
- Focus on actionable next steps
- Keep under 300 words but be thorough
- Use a professional yet approachable tone

Begin your analysis now:
        """
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

# ========== Dashboard Endpoint ==========
@app.route('/get-dashboard-data', methods=['GET'])
def get_dashboard_data():
    try:
        customer_id = request.args.get('customerId')
        
        # Try to get data from Plaid
        try:
            access_token = get_or_create_sandbox_token()
            
            # Get accounts from Plaid
            balance_request = AccountsBalanceGetRequest(access_token=access_token)
            balance_response = plaid_client.accounts_balance_get(balance_request)
            
            # Transform Plaid accounts to legacy format
            accounts_data = [transform_plaid_account_to_legacy({
                'account_id': acc['account_id'],
                'name': acc['name'],
                'type': acc['type'],
                'subtype': acc.get('subtype'),
                'balance': {
                    'current': acc['balances'].get('current'),
                    'available': acc['balances'].get('available')
                }
            }) for acc in balance_response['accounts']]
            
            # Get transactions from Plaid
            cursor = PLAID_TRANSACTION_CURSORS.get('default', '')
            all_plaid_transactions = []
            has_more = True
            
            while has_more:
                sync_request = TransactionsSyncRequest(
                    access_token=access_token,
                    cursor=cursor if cursor else None
                )
                sync_response = plaid_client.transactions_sync(sync_request)
                
                for trans in sync_response['added']:
                    all_plaid_transactions.append({
                        'transaction_id': trans['transaction_id'],
                        'account_id': trans['account_id'],
                        'date': trans['date'],
                        'name': trans['name'],
                        'merchant_name': trans.get('merchant_name'),
                        'amount': trans['amount'],
                        'category': trans.get('category', []),
                        'pending': trans['pending']
                    })
                
                cursor = sync_response['next_cursor']
                has_more = sync_response['has_more']
                
                if len(all_plaid_transactions) > 100:
                    break
            
            PLAID_TRANSACTION_CURSORS['default'] = cursor
            
            # Transform to legacy format
            all_transactions = [transform_plaid_transaction_to_legacy(t) for t in all_plaid_transactions]
            
        except plaid.ApiException as e:
            logger.warning(f"Plaid API error, falling back to mock data: {e}")
            # Fall back to mock data if Plaid fails
            accounts_data = []
            all_transactions = generate_realistic_transactions(30, [])
        except Exception as e:
            logger.warning(f"Error getting Plaid data, falling back to mock: {e}")
            accounts_data = []
            all_transactions = generate_realistic_transactions(30, [])
        
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
                if account_type == 'checking':
                    assets_breakdown['checking'] += balance
                else:
                    assets_breakdown['savings'] += balance
            elif account_type == 'credit card':
                total_liabilities += abs(balance)
                liabilities_breakdown['credit_cards'] += abs(balance)
            elif account_type == 'investment':
                total_assets += balance
                assets_breakdown['investments'] += balance
            elif account_type == 'loan':
                total_liabilities += abs(balance)
                liabilities_breakdown['loans'] += abs(balance)
        
        net_worth = total_assets - total_liabilities
        
        # Apply any updates from TRANSACTION_UPDATES
        for transaction in all_transactions:
            trans_id = transaction.get('_id')
            if trans_id in TRANSACTION_UPDATES:
                transaction.update(TRANSACTION_UPDATES[trans_id])
        
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


# ========== All Transactions Endpoint ==========
@app.route('/get-all-transactions', methods=['GET'])
def get_all_transactions():
    try:
        customer_id = request.args.get('customerId')
        days = request.args.get('days', '30')  # Default to 30 days
        
        try:
            days_int = int(days)
        except:
            days_int = 30
        
        accounts_data = []
        all_transactions = []
        
        # Try to get data from Plaid
        try:
            access_token = get_or_create_sandbox_token()
            
            # Get accounts from Plaid
            balance_request = AccountsBalanceGetRequest(access_token=access_token)
            balance_response = plaid_client.accounts_balance_get(balance_request)
            
            # Transform Plaid accounts to legacy format
            accounts_data = [transform_plaid_account_to_legacy({
                'account_id': acc['account_id'],
                'name': acc['name'],
                'type': acc['type'],
                'subtype': acc.get('subtype'),
                'balance': {
                    'current': acc['balances'].get('current'),
                    'available': acc['balances'].get('available')
                }
            }) for acc in balance_response['accounts']]
            
            # Get transactions from Plaid
            cursor = PLAID_TRANSACTION_CURSORS.get('default', '')
            all_plaid_transactions = []
            has_more = True
            
            while has_more:
                sync_request = TransactionsSyncRequest(
                    access_token=access_token,
                    cursor=cursor if cursor else None
                )
                sync_response = plaid_client.transactions_sync(sync_request)
                
                for trans in sync_response['added']:
                    all_plaid_transactions.append({
                        'transaction_id': trans['transaction_id'],
                        'account_id': trans['account_id'],
                        'date': trans['date'],
                        'name': trans['name'],
                        'merchant_name': trans.get('merchant_name'),
                        'amount': trans['amount'],
                        'category': trans.get('category', []),
                        'pending': trans['pending']
                    })
                
                cursor = sync_response['next_cursor']
                has_more = sync_response['has_more']
                
                if len(all_plaid_transactions) > 500:
                    break
            
            PLAID_TRANSACTION_CURSORS['default'] = cursor
            
            # Transform to legacy format with account info
            for plaid_trans in all_plaid_transactions:
                legacy_trans = transform_plaid_transaction_to_legacy(plaid_trans)
                # Find matching account
                for acc in accounts_data:
                    if acc['_id'] == plaid_trans['account_id']:
                        legacy_trans['account_type'] = acc.get('type', 'Unknown')
                        legacy_trans['account_name'] = acc.get('nickname', 'Account')
                        break
                all_transactions.append(legacy_trans)
                
        except plaid.ApiException as e:
            logger.warning(f"Plaid API error, using mock data: {e}")
            all_transactions = generate_realistic_transactions(days_int, accounts_data)
        except Exception as e:
            logger.warning(f"Error getting Plaid data, using mock: {e}")
            all_transactions = generate_realistic_transactions(days_int, accounts_data)
        
        # Apply updates from TRANSACTION_UPDATES
        for transaction in all_transactions:
            trans_id = transaction.get('_id')
            if trans_id in TRANSACTION_UPDATES:
                transaction.update(TRANSACTION_UPDATES[trans_id])
        
        # Filter out deleted transactions
        all_transactions = [t for t in all_transactions if not t.get('deleted', False)]
        
        # If API returns limited data, generate realistic transactions for the time period
        if len(all_transactions) < 10:
            all_transactions = generate_realistic_transactions(days_int, accounts_data)
        
        # Filter by date range
        cutoff_date = datetime.now() - timedelta(days=days_int)
        
        filtered_transactions = []
        for transaction in all_transactions:
            try:
                trans_date = datetime.strptime(str(transaction.get('purchase_date', '')), '%Y-%m-%d')
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
                    elif not transaction.get('category'):
                        transaction['category'] = 'Other'
            except:
                for transaction in filtered_transactions:
                    if not transaction.get('category'):
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

# ========== Recurring Expenses Endpoint ==========
@app.route('/get-recurring-expenses', methods=['GET'])
def get_recurring_expenses():
    try:
        customer_id = request.args.get('customerId')
        
        all_transactions = []
        
        # Try to get data from Plaid
        try:
            access_token = get_or_create_sandbox_token()
            
            # Get transactions from Plaid
            cursor = PLAID_TRANSACTION_CURSORS.get('default', '')
            all_plaid_transactions = []
            has_more = True
            
            while has_more:
                sync_request = TransactionsSyncRequest(
                    access_token=access_token,
                    cursor=cursor if cursor else None
                )
                sync_response = plaid_client.transactions_sync(sync_request)
                
                for trans in sync_response['added']:
                    all_plaid_transactions.append({
                        'transaction_id': trans['transaction_id'],
                        'account_id': trans['account_id'],
                        'date': trans['date'],
                        'name': trans['name'],
                        'merchant_name': trans.get('merchant_name'),
                        'amount': trans['amount'],
                        'category': trans.get('category', []),
                        'pending': trans['pending']
                    })
                
                cursor = sync_response['next_cursor']
                has_more = sync_response['has_more']
                
                if len(all_plaid_transactions) > 500:
                    break
            
            PLAID_TRANSACTION_CURSORS['default'] = cursor
            
            # Transform to legacy format
            all_transactions = [transform_plaid_transaction_to_legacy(t) for t in all_plaid_transactions]
            
        except plaid.ApiException as e:
            logger.warning(f"Plaid API error, using mock transactions: {e}")
            all_transactions = generate_realistic_transactions(90, [])
        except Exception as e:
            logger.warning(f"Error getting Plaid data: {e}")
            all_transactions = generate_realistic_transactions(90, [])
        
        # Detect recurring from transaction patterns (Plaid doesn't have bills/loans like Nessie)
        recurring_from_patterns = detect_recurring_expenses(all_transactions)
        
        # Combine all recurring expenses
        all_recurring = recurring_from_patterns
        
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
    prompt = f"""You are an expert financial analyst with deep expertise in transaction categorization. 

TASK: Categorize the following bank transactions with high accuracy.

AVAILABLE CATEGORIES:
- Food & Drink (restaurants, coffee shops, bars, dining out)
- Shopping (retail stores, online shopping, clothing, electronics)
- Transport (gas, parking, ride-sharing, public transit, car-related)
- Bills & Utilities (electric, water, internet, phone bills, insurance)
- Entertainment (movies, streaming services, concerts, hobbies)
- Groceries (supermarkets, grocery stores, food markets)
- Healthcare (pharmacy, medical appointments, fitness, wellness)
- Travel (hotels, flights, vacation expenses)
- Other (anything that doesn't fit above categories)

CATEGORIZATION GUIDELINES:
1. Look at merchant names and transaction descriptions carefully
2. Consider common patterns (e.g., Netflix = Entertainment, Shell = Transport)
3. When uncertain, use the most logical category
4. Default to "Other" only when truly ambiguous

RESPONSE FORMAT (JSON only, no explanations):
{{
  "categorized_transactions": [
    {{
      "_id": "transaction_id",
      "category": "Category Name"
    }}
  ]
}}

TRANSACTIONS TO CATEGORIZE:
{transactions[:20]}

Return only the JSON response:
        """
    
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
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

# ========== Simple Transactions Endpoint ==========
@app.route('/get-transactions', methods=['GET'])
def get_transactions():
    try:
        customer_id = request.args.get('customerId')
        
        transactions = []
        
        # Try to get data from Plaid
        try:
            access_token = get_or_create_sandbox_token()
            
            # Get transactions from Plaid
            cursor = PLAID_TRANSACTION_CURSORS.get('default', '')
            all_plaid_transactions = []
            has_more = True
            
            while has_more:
                sync_request = TransactionsSyncRequest(
                    access_token=access_token,
                    cursor=cursor if cursor else None
                )
                sync_response = plaid_client.transactions_sync(sync_request)
                
                for trans in sync_response['added']:
                    all_plaid_transactions.append({
                        'transaction_id': trans['transaction_id'],
                        'account_id': trans['account_id'],
                        'date': trans['date'],
                        'name': trans['name'],
                        'merchant_name': trans.get('merchant_name'),
                        'amount': trans['amount'],
                        'category': trans.get('category', []),
                        'pending': trans['pending']
                    })
                
                cursor = sync_response['next_cursor']
                has_more = sync_response['has_more']
                
                if len(all_plaid_transactions) > 100:
                    break
            
            PLAID_TRANSACTION_CURSORS['default'] = cursor
            
            # Transform to legacy format
            transactions = [transform_plaid_transaction_to_legacy(t) for t in all_plaid_transactions]
            
        except plaid.ApiException as e:
            logger.warning(f"Plaid API error, using mock transactions: {e}")
            transactions = generate_realistic_transactions(30, [])
        except Exception as e:
            logger.warning(f"Error getting Plaid data: {e}")
            transactions = generate_realistic_transactions(30, [])
        
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


# ========== Transaction History Endpoint ==========
@app.route('/get-transaction-history', methods=['GET'])
def get_transaction_history():
    try:
        customer_id = request.args.get('customerId')
        limit = int(request.args.get('limit', 100))
        page = int(request.args.get('page', 1))
        use_plaid = request.args.get('use_plaid', 'true').lower() == 'true'
        
        transformed_transactions = []
        source = 'mock'
        
        # Try to use Plaid API first, fallback to mock data
        if use_plaid:
            try:
                access_token = get_or_create_sandbox_token()
                
                # Get transactions from Plaid
                cursor = PLAID_TRANSACTION_CURSORS.get('default', '')
                all_plaid_transactions = []
                has_more = True
                
                while has_more:
                    sync_request = TransactionsSyncRequest(
                        access_token=access_token,
                        cursor=cursor if cursor else None
                    )
                    sync_response = plaid_client.transactions_sync(sync_request)
                    
                    for trans in sync_response['added']:
                        all_plaid_transactions.append({
                            'transaction_id': trans['transaction_id'],
                            'account_id': trans['account_id'],
                            'date': trans['date'],
                            'name': trans['name'],
                            'merchant_name': trans.get('merchant_name'),
                            'amount': trans['amount'],
                            'category': trans.get('category', []),
                            'pending': trans['pending']
                        })
                    
                    cursor = sync_response['next_cursor']
                    has_more = sync_response['has_more']
                    
                    if len(all_plaid_transactions) > 500:
                        break
                
                PLAID_TRANSACTION_CURSORS['default'] = cursor
                
                # Transform Plaid data to our format
                for idx, t in enumerate(all_plaid_transactions):
                    # Categorize based on description
                    desc = t.get('merchant_name') or t.get('name', '')
                    category = categorize_transaction_simple(desc)
                    
                    # Plaid uses positive for expenses, negative for income
                    amount = t['amount']
                    transformed_transactions.append({
                        'id': t.get('transaction_id', f'plaid-{idx}'),
                        'date': t.get('date', ''),
                        'description': t.get('merchant_name') or t.get('name', 'Unknown Transaction'),
                        'amount': -amount if amount > 0 else abs(amount),  # Make expenses negative
                        'category': category,
                        'status': 'pending' if t.get('pending') else 'executed'
                    })
                
                source = 'plaid'
                
            except plaid.ApiException as e:
                logger.warning(f"Plaid API error: {e}")
                # Fall through to mock data
            except Exception as e:
                logger.warning(f"Error getting Plaid data: {e}")
                # Fall through to mock data
        
        # If no Plaid transactions, generate mock data
        if not transformed_transactions:
            mock_transactions = generate_realistic_transactions(30, [])
            for t in mock_transactions:
                category = categorize_transaction_simple(t.get('description', ''))
                transformed_transactions.append({
                    'id': t.get('_id'),
                    'date': t.get('purchase_date', ''),
                    'description': t.get('description', 'Unknown Transaction'),
                    'amount': float(t.get('amount', 0)),
                    'category': category,
                    'status': t.get('status', 'executed')
                })
            source = 'mock'
        
        # Sort by date (newest first)
        transformed_transactions.sort(key=lambda x: x['date'], reverse=True)
        
        # Apply pagination
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_transactions = transformed_transactions[start_idx:end_idx]
        
        return jsonify({
            'transactions': paginated_transactions,
            'total_count': len(transformed_transactions),
            'source': source
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def categorize_transaction_simple(description):
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

# ========== AI Summary Endpoint ==========
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
        prompt = f"""You are an expert financial analyst specializing in transaction categorization and spending pattern analysis.

Analyze these bank transactions and return ONLY a valid JSON object with this exact structure:

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

# ========== Budget Calendar Endpoints ==========
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
        return 0.0, 0.0

    n = len(days)
    x_mean = sum(days) / n
    y_mean = sum(amounts) / n

    numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(days, amounts))
    denominator = sum((x - x_mean) ** 2 for x in days)

    if denominator == 0:
        return 0.0, y_mean

    slope = numerator / denominator
    intercept = y_mean - slope * x_mean

    return slope, intercept

@app.route('/api/plaid/monthly-transactions', methods=['POST'])
@app.route('/api/nessie/transactions', methods=['POST'])  # Keep old route for backward compatibility
def get_monthly_transactions():
    try:
        data = request.get_json()
        account_id = data.get('accountId')
        month = data.get('month')
        year = data.get('year')
        
        transactions = []
        
        # Try to get data from Plaid
        try:
            access_token = get_or_create_sandbox_token()
            
            # Get transactions from Plaid
            cursor = PLAID_TRANSACTION_CURSORS.get('default', '')
            all_plaid_transactions = []
            has_more = True
            
            while has_more:
                sync_request = TransactionsSyncRequest(
                    access_token=access_token,
                    cursor=cursor if cursor else None
                )
                sync_response = plaid_client.transactions_sync(sync_request)
                
                for trans in sync_response['added']:
                    all_plaid_transactions.append(trans)
                
                cursor = sync_response['next_cursor']
                has_more = sync_response['has_more']
                
                if len(all_plaid_transactions) > 500:
                    break
            
            PLAID_TRANSACTION_CURSORS['default'] = cursor
            
            # Normalize transactions and filter by month/year
            for t in all_plaid_transactions:
                trans_date = str(t.get('date', ''))
                if trans_date:
                    try:
                        trans_month = int(trans_date.split('-')[1])
                        trans_year = int(trans_date.split('-')[0])
                        
                        # Filter to requested month (or include all if not specified)
                        if (not month or trans_month == month) and (not year or trans_year == year):
                            transactions.append({
                                'id': t.get('transaction_id', ''),
                                'date': trans_date,
                                'amount': abs(t.get('amount', 0)),
                                'merchant': t.get('merchant_name') or t.get('name', 'Unknown'),
                                'description': t.get('name', 'Purchase'),
                                'type': 'credit' if t.get('amount', 0) < 0 else 'debit'
                            })
                    except (ValueError, IndexError):
                        pass
                        
        except plaid.ApiException as e:
            logger.warning(f"Plaid API error, using mock data: {e}")
            transactions = []
        except Exception as e:
            logger.warning(f"Error getting Plaid data: {e}")
            transactions = []
        
        # If no Plaid transactions, generate mock data
        if not transactions:
            mock_transactions = generate_realistic_transactions(30, [])
            for t in mock_transactions:
                trans_date = t.get('purchase_date', '')
                if trans_date:
                    try:
                        trans_month = int(trans_date.split('-')[1])
                        trans_year = int(trans_date.split('-')[0])
                        
                        if (not month or trans_month == month) and (not year or trans_year == year):
                            transactions.append({
                                'id': t.get('_id', ''),
                                'date': trans_date,
                                'amount': abs(t.get('amount', 0)),
                                'merchant': t.get('description', 'Unknown'),
                                'description': t.get('description', 'Purchase'),
                                'type': 'credit' if t.get('amount', 0) > 0 else 'debit'
                            })
                    except (ValueError, IndexError):
                        pass
        
        # Detect recurring charges
        fixed_charges = detect_recurring_charges(transactions)
        
        # Build daily spending for regression (exclude fixed charges)
        today = datetime.now().day
        daily_spend = {}
        
        for t in transactions:
            try:
                day = int(t['date'].split('-')[2])
                if day <= today:
                    if not t.get('isFixed'):
                        daily_spend[day] = daily_spend.get(day, 0) + t['amount']
            except (ValueError, IndexError):
                pass
        
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
    except:
        pass
    
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    prompt = f"""You are a certified financial planner (CFP) with expertise in personal budgeting and money management.

SITUATION ANALYSIS:
- Available surplus: ${leeway:.2f}
- Monthly budget: ${context.get('budget', 0):.2f}
- Projected spending: ${context.get('projectedTotal', 0):.2f}
- User risk tolerance: {context.get('riskTolerance', 'moderate')}

TASK:
Provide personalized financial guidance on how to best utilize this ${leeway:.2f} surplus based on sound financial principles.

CONSIDERATIONS:
1. Emergency fund status (3-6 months expenses recommended)
2. High-interest debt payoff vs. investing trade-offs
3. Time horizon and risk tolerance alignment
4. Opportunity cost of different allocation strategies
5. Tax-advantaged account options

RESPONSE REQUIREMENTS:
- Give ONE clear, actionable recommendation (1-2 sentences maximum)
- Be specific with percentages or amounts when relevant
- Consider the user's risk tolerance
- Focus on the highest-impact financial move
- Avoid generic advice; be specific to this situation
- Do NOT endorse specific products, companies, or financial institutions

Provide your recommendation now:
        """
    try:
        response = model.generate_content(prompt)
        suggestion = response.text.strip()
        
        return jsonify({'suggestion': suggestion})
        
    except Exception as e:
        fallback = f"With ${leeway:.2f} remaining, consider saving it in a high-yield savings account for emergencies or investing in diversified index funds for long-term growth."
        return jsonify({'suggestion': fallback})

# ========== Stock Advisor Endpoints (Only if modules available) ==========
if INVESTMENT_FEATURES_AVAILABLE:
    @app.route('/api/stock-analysis/<stock_symbol>', methods=['POST'])
    def analyze_stock(stock_symbol):
        try:
            data = request.get_json() or {}
            advisor_id = data.get('advisor_id', 'warren_buffett')
            user_context = data.get('user_context', {})
            
            analysis = investment_agent.stock_advisor.analyze_stock(
                stock_symbol=stock_symbol.upper(),
                advisor_id=advisor_id,
                user_context=user_context
            )
            
            return jsonify(analysis)
            
        except Exception as e:
            return jsonify({
                'error': str(e),
                'stock_symbol': stock_symbol,
                'advisor': advisor_id
            }), 500

    @app.route('/api/comprehensive-stock-analysis/<stock_symbol>', methods=['POST'])
    def comprehensive_stock_analysis(stock_symbol):
        try:
            data = request.get_json() or {}
            user_profile = data.get('user_profile', {})
            
            analysis = investment_agent.get_comprehensive_stock_analysis(
                stock_symbol=stock_symbol.upper(),
                user_profile=user_profile
            )
            
            return jsonify(analysis)
            
        except Exception as e:
            return jsonify({
                'error': str(e),
                'stock_symbol': stock_symbol
            }), 500

    @app.route('/api/market-outlook/<advisor_id>', methods=['GET'])
    def get_market_outlook(advisor_id):
        try:
            market_context = request.args.to_dict()
            
            outlook = investment_agent.stock_advisor.get_market_outlook(
                advisor_id=advisor_id,
                market_context=market_context
            )
            
            return jsonify(outlook)
            
        except Exception as e:
            return jsonify({
                'error': str(e),
                'advisor': advisor_id
            }), 500

    @app.route('/api/compare-stocks', methods=['POST'])
    def compare_stocks():
        try:
            data = request.get_json()
            stock_symbols = [symbol.upper() for symbol in data.get('stock_symbols', [])]
            advisor_id = data.get('advisor_id', 'warren_buffett')
            user_profile = data.get('user_profile', {})
            
            if len(stock_symbols) < 2:
                return jsonify({'error': 'at least 2 stock symbols required'}), 400
            
            comparison = investment_agent.compare_investment_options(
                stock_symbols=stock_symbols,
                user_profile=user_profile,
                advisor_preference=advisor_id
            )
            
            return jsonify(comparison)
            
        except Exception as e:
            return jsonify({
                'error': str(e),
                'stocks': stock_symbols if 'stock_symbols' in locals() else []
            }), 500

    @app.route('/api/portfolio-analysis', methods=['POST'])
    def analyze_portfolio():
        try:
            data = request.get_json()
            user_portfolio = data.get('portfolio', {})
            user_profile = data.get('user_profile', {})
            
            analysis = investment_agent.get_portfolio_analysis(
                user_portfolio=user_portfolio,
                user_profile=user_profile
            )
            
            return jsonify(analysis)
            
        except Exception as e:
            return jsonify({
                'error': str(e)
            }), 500

    @app.route('/api/advisors', methods=['GET'])
    def get_advisors():
        try:
            advisors = investment_agent.stock_advisor.advisors
            return jsonify({'advisors': advisors})
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/investment-principles', methods=['GET'])
    def get_investment_principles():
        try:
            principles = investment_agent.financial_advisory.get_investment_principles()
            return jsonify({'principles': principles})
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500

@app.route('/chat/financial-advice', methods=['POST'])
def chat_financial_advice():
    try:
        data = request.get_json()
        message = data.get('message', '')
        advisor = data.get('advisor', 'warren_buffett')

        if not message:
            return jsonify({'error': 'Message is required'}), 400

        # Try to initialize Gemini model; if it fails, fall back to a safe offline path
        model = None
        try:
            model = genai.GenerativeModel('gemini-2.5-flash')
        except Exception as e:
            logger.warning(f'Gemini model initialization failed: {e}')

        # Define comprehensive advisor personas
        advisor_personas = {
            'warren_buffett': """You are Warren Buffett, the legendary value investor and CEO of Berkshire Hathaway.

PERSONALITY & STYLE:
- Use folksy, down-to-earth wisdom and Midwestern common sense
- Reference your famous principles: "Price is what you pay, value is what you get"
- Often use baseball and business analogies
- Speak about companies as businesses, not stock tickers
- Emphasize the importance of understanding what you own
- Value long-term thinking over short-term gains

CORE INVESTMENT PHILOSOPHY:
1. Look for businesses with strong moats (competitive advantages)
2. Focus on management quality and capital allocation skills
3. Prefer companies with consistent earnings and predictable futures
4. Patient capital - willing to hold forever for the right business
5. Circle of competence - only invest in what you understand
6. Margin of safety - buy wonderful companies at fair prices
7. Look at intrinsic value, not market sentiment

APPROACH:
- Ask about the business fundamentals, not just price movements
- Discuss economic moats, competitive advantages, and pricing power
- Reference lessons from your partnership letters and annual reports
- Use clear, practical language accessible to regular investors
- Emphasize the importance of reading annual reports and understanding businesses
- Mention the value of patience and emotional discipline

Remember: You're giving investment perspective and education, not specific buy/sell recommendations.""",
            
            'peter_lynch': """You are Peter Lynch, the legendary former manager of Fidelity's Magellan Fund.

PERSONALITY & STYLE:
- Energetic, practical, and optimistic about investing
- Use everyday examples and relatable stories
- Known for phrases like "invest in what you know"
- Emphasize that average investors can beat professionals
- Encourage doing your homework and visiting companies
- Accessible and encouraging to retail investors

CORE INVESTMENT PHILOSOPHY:
1. "Know what you own and why you own it"
2. Look for companies in everyday life (the mall, grocery store, workplace)
3. Understand the company's story in simple terms
4. Categorize stocks: slow growers, stalwarts, fast growers, cyclicals, turnarounds, asset plays
5. Look for companies with strong earnings growth potential
6. Use the PEG ratio (P/E to growth rate) as a valuation tool
7. Don't let emotions drive investment decisions

STOCK EVALUATION METHOD (The Lynch Way):
- Can you explain the company's business to a 10-year-old?
- What's driving earnings growth?
- Is the P/E ratio reasonable relative to growth rate?
- Does the company have competitive advantages?
- What's the company's growth runway?
- Are insiders buying shares?

APPROACH:
- Encourage investors to leverage their professional knowledge
- Share stories of finding great investments through daily observations
- Discuss the importance of company research and earnings analysis
- Be enthusiastic about opportunities while warning of risks
- Use practical examples from consumer products and services

Remember: Make investing feel accessible and achievable for regular people.""",
            
            'cathie_wood': """You are Cathie Wood, founder and CEO of ARK Invest, known for your bold conviction in disruptive innovation.

PERSONALITY & STYLE:
- Passionate about innovation and technological transformation
- Data-driven and research-intensive approach
- Willing to go against consensus when evidence supports it
- Focus on exponential growth curves and convergence
- Think in 5-10 year time horizons
- Emphasize the importance of transparency and open research

CORE INVESTMENT PHILOSOPHY:
1. Focus on disruptive innovation and exponential growth opportunities
2. Look for platforms that converge multiple innovative technologies
3. Invest in companies at the forefront of transformative change
4. Embrace volatility as the price of innovation exposure
5. Use a 5-year investment time horizon minimum
6. Emphasize the importance of deep research and collaboration
7. Focus on unit economics and market adoption curves

KEY INNOVATION PLATFORMS:
- Artificial Intelligence and Machine Learning
- Robotics and Automation
- Energy Storage and Electric Vehicles
- Blockchain Technology and Digital Assets
- Genomic Sequencing and Gene Editing
- Fintech and Digital Wallets
- Multi-Omics and Precision Medicine

EVALUATION FRAMEWORK:
- Is this technology disruptive or sustaining?
- What's the total addressable market in 5-10 years?
- How are costs declining and performance improving?
- What's the path to market leadership?
- How do different innovation platforms converge here?
- What are the Wright's Law cost curves showing?

APPROACH:
- Discuss the transformative potential of technologies
- Reference research reports and data-driven analysis
- Explain how innovations create new markets and opportunities
- Address both the upside potential and inherent risks
- Emphasize the importance of conviction during volatility
- Connect multiple innovation themes together

Remember: Focus on the science and data behind innovations, and help investors understand transformative potential."""
        }
        
        persona = advisor_personas.get(advisor, advisor_personas['warren_buffett'])

        prompt = f"""{persona}

USER QUESTION:
{message}

RESPONSE GUIDELINES:
1. Stay in character as {advisor.replace('_', ' ').title()}
2. Draw on your specific investment philosophy and experience
3. Provide educational insights rather than specific buy/sell recommendations
4. Use examples and analogies characteristic of your style
5. Be helpful, thoughtful, and authentic to your perspective
6. Keep response conversational and under 300 words
7. If discussing specific companies, focus on business analysis not price targets

Provide your response now:
"""

        # If model is available, try to generate a response. If generation fails or model
        # is unavailable, return a safe fallback response instead of raising a 500.
        if model is not None:
            try:
                response = model.generate_content(prompt)
                return jsonify({
                    'response': response.text,
                    'advisor': advisor
                })
            except Exception as e:
                logger.error(f"Gemini generation failed: {e}")

        # Fallback: generate a short, deterministic advisor-style reply so the frontend
        # receives a usable response even when Gemini is down.
        advisor_fallbacks = {
            'warren_buffett': f"The Oracle of Omaha says: {message[:50]}... sounds like a question about {message.split()[0] if message.split() else 'investing'}. My advice: focus on businesses you understand, buy quality companies at fair prices, and think long-term. Remember - time in the market beats timing the market.",
            'peter_lynch': f"Peter Lynch perspective: {message[:50]}... reminds me of finding investment opportunities in everyday life. Look for companies whose products you use and understand. If you can explain the business to a 10-year-old, it might be worth investigating further.",
            'cathie_wood': f"Innovation perspective: {message[:50]}... suggests we should consider disruptive technologies and exponential growth curves. Focus on companies positioned to benefit from AI, genomics, robotics, and other transformative platforms over the next 5-10 years."
        }
        
        fallback_reply = advisor_fallbacks.get(advisor, advisor_fallbacks['warren_buffett'])

        return jsonify({
            'response': fallback_reply,
            'advisor': advisor,
            'notice': 'AI service temporarily unavailable - using enhanced fallback response'
        })

    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        return jsonify({'error': f'Failed to generate response: {str(e)}'}), 500
    
@app.route('/api/transaction-insight', methods=['POST'])
def get_transaction_insight():
    try:
        data = request.get_json()
        transaction_details = data.get('transaction')

        if not transaction_details:
            return jsonify({'error': 'Missing transaction details'}), 400

        model = genai.GenerativeModel('gemini-2.5-flash')
        
        prompt = f"""
        Analyze the following transaction and provide a brief, two-sentence financial insight. 
        Focus on the spending pattern and offer a piece of actionable advice.

        Transaction: {transaction_details}

        Format your response as a JSON object with "insight" and "advice" keys.
        """

        response = model.generate_content(prompt)
        
        # A simple way to parse the response, assuming it's in a JSON-like format
        insight_text = response.text.strip()
        
        # Basic parsing, can be improved with regex or more robust logic
        if '"insight":' in insight_text and '"advice":' in insight_text:
            import json
            # Clean markdown code blocks
            if insight_text.startswith('```json'):
                insight_text = insight_text[7:]
            if insight_text.endswith('```'):
                insight_text = insight_text[:-3]

            insight_json = json.loads(insight_text)
            return jsonify(insight_json)
        else:
            # Fallback for non-JSON responses
            parts = insight_text.split('.')
            return jsonify({
                'insight': parts[0] + '.' if parts else "Insight not available.",
                'advice': parts[1].strip() + '.' if len(parts) > 1 else "Consider reviewing your budget."
            })

    except Exception as e:
        logger.error(f"Error in transaction insight: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)