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

# Import RAG service for grounded AI responses
try:
    from rag_service import (
        get_rag_service, RAGService, classify_financial_query, 
        format_temporal_filter_human, embed_conversation_message,
        retrieve_conversation_context, format_time_ago,
        classify_query_intent_with_llm, classify_query_unified_llm
    )
    RAG_AVAILABLE = True
except ImportError:
    RAG_AVAILABLE = False
    print("Warning: RAG service not available. AI responses will not be grounded in user data.")
    def classify_financial_query(q): return {'intent': 'general', 'requires_structured': False, 'filters': {}}

# Import user profile service
try:
    from user_profile import get_profile_service, UserProfileService
    PROFILE_AVAILABLE = True
except ImportError:
    PROFILE_AVAILABLE = False
    print("Warning: User profile service not available.")


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# ========== Chat History Database ==========
import sqlite3
import uuid

DB_PATH = os.path.join(os.path.dirname(__file__), 'secretary.db')

def initialize_database():
    """Create conversations, messages, and user profile tables"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            user_id TEXT DEFAULT 'default_user',
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            title TEXT,
            message_count INTEGER DEFAULT 0
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT,
            role TEXT,
            content TEXT,
            timestamp TIMESTAMP,
            metadata TEXT,
            FOREIGN KEY (conversation_id) REFERENCES conversations (id)
        )
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_conversation_messages 
        ON messages(conversation_id, timestamp)
    ''')
    
    # ========== User Profile Tables ==========
    
    # Core user profile
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_profiles (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE,
            name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            onboarding_completed BOOLEAN DEFAULT FALSE
        )
    ''')
    
    # Demographic attributes
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_demographics (
            user_id TEXT PRIMARY KEY,
            age INTEGER,
            age_range TEXT,
            income_range TEXT,
            employment_status TEXT,
            occupation TEXT,
            household_size INTEGER,
            location_state TEXT,
            location_city TEXT,
            FOREIGN KEY (user_id) REFERENCES user_profiles (id)
        )
    ''')
    
    # Financial attributes
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_financials (
            user_id TEXT PRIMARY KEY,
            primary_goal TEXT,
            secondary_goals TEXT,
            target_savings_rate REAL,
            monthly_income REAL,
            monthly_expenses REAL,
            total_debt REAL,
            debt_types TEXT,
            emergency_fund_months REAL,
            investment_experience TEXT,
            risk_tolerance TEXT,
            retirement_accounts TEXT,
            FOREIGN KEY (user_id) REFERENCES user_profiles (id)
        )
    ''')
    
    # Behavioral attributes (auto-tracked)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_behaviors (
            user_id TEXT PRIMARY KEY,
            avg_monthly_spending REAL,
            top_spending_categories TEXT,
            frequent_merchants TEXT,
            spending_trend TEXT,
            last_active TIMESTAMP,
            chat_count INTEGER DEFAULT 0,
            preferred_advice_style TEXT,
            impulse_buyer_score REAL,
            budget_adherence_score REAL,
            savings_consistency_score REAL,
            FOREIGN KEY (user_id) REFERENCES user_profiles (id)
        )
    ''')
    
    # User preferences
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_preferences (
            user_id TEXT PRIMARY KEY,
            notification_enabled BOOLEAN DEFAULT TRUE,
            weekly_summary_enabled BOOLEAN DEFAULT TRUE,
            advice_tone TEXT DEFAULT 'friendly',
            currency TEXT DEFAULT 'USD',
            FOREIGN KEY (user_id) REFERENCES user_profiles (id)
        )
    ''')
    
    # Create default user if not exists
    cursor.execute('''
        INSERT OR IGNORE INTO user_profiles (id, name, email, onboarding_completed)
        VALUES ('default_user', 'User', 'user@example.com', FALSE)
    ''')
    
    conn.commit()
    conn.close()
    logger.info("Database initialized successfully")

# Initialize database on startup
initialize_database()
# ========== End Chat History Database ==========

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

# In-memory cache for generated transactions (persists across requests)
CACHED_TRANSACTIONS = {
    'data': None,
    'generated_for_days': None
}

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
    """Generate realistic transaction data for demonstration.
    
    Results are cached so the same transactions appear on each request.
    """
    global CACHED_TRANSACTIONS
    import random
    
    # Check if we have cached transactions that cover the requested period
    if (CACHED_TRANSACTIONS['data'] is not None and 
        CACHED_TRANSACTIONS['generated_for_days'] is not None and
        CACHED_TRANSACTIONS['generated_for_days'] >= days):
        # Filter cached transactions to the requested date range
        cutoff_date = datetime.now() - timedelta(days=days)
        return [
            t for t in CACHED_TRANSACTIONS['data']
            if datetime.strptime(t['purchase_date'], '%Y-%m-%d') >= cutoff_date
        ]
    
    # Generate new transactions with a fixed seed for reproducibility
    random.seed(42)  # Fixed seed ensures same transactions every time
    
    transactions = []
    today = datetime.now()
    
    # Always generate for a full year to cover all date range requests
    generation_days = max(days, 365)
    
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
    for day in range(generation_days):
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
    
    # Cache the generated transactions
    CACHED_TRANSACTIONS['data'] = transactions
    CACHED_TRANSACTIONS['generated_for_days'] = generation_days
    
    logger.info(f"Generated and cached {len(transactions)} transactions for {generation_days} days")
    
    # Filter to requested date range
    cutoff_date = datetime.now() - timedelta(days=days)
    return [
        t for t in transactions
        if datetime.strptime(t['purchase_date'], '%Y-%m-%d') >= cutoff_date
    ]

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


# ========== LLM-Powered Semantic Transaction Matching ==========

def filter_transactions_with_llm(query: str, transactions: list, temporal_filtered: list = None) -> dict:
    """
    Use Gemini's world knowledge to semantically filter transactions.
    
    Instead of hardcoding "coffee shop" = ["starbucks", ...], this asks the LLM
    to use its real-world understanding to identify which merchants match the query.
    
    Args:
        query: User's query (e.g., "What coffee shops have I bought from?")
        transactions: List of all transactions or temporally-filtered transactions
        temporal_filtered: If provided, already filtered by time period
    
    Returns:
        {
            'matching_transactions': [...],
            'matching_merchants': [...],
            'reasoning': str
        }
    """
    try:
        # Use temporally-filtered if provided, otherwise use all
        txns_to_analyze = temporal_filtered if temporal_filtered else transactions
        
        if not txns_to_analyze:
            return {'matching_transactions': [], 'matching_merchants': [], 'reasoning': 'No transactions to analyze'}
        
        # Get unique merchant descriptions
        unique_merchants = list(set(t.get('description', '') for t in txns_to_analyze if t.get('description')))
        
        if not unique_merchants:
            return {'matching_transactions': [], 'matching_merchants': [], 'reasoning': 'No merchants found'}
        
        # Limit to reasonable number for LLM context
        if len(unique_merchants) > 50:
            unique_merchants = unique_merchants[:50]
        
        merchant_list = "\n".join([f"- {m}" for m in unique_merchants])
        
        prompt = f"""You are an expert at understanding businesses and merchants.

USER QUERY: "{query}"

MERCHANT LIST FROM USER'S TRANSACTIONS:
{merchant_list}

TASK: Using your real-world knowledge, identify which merchants from the list match what the user is asking about.

For example:
- If user asks about "coffee shops", identify merchants like "Starbucks Coffee", "Dunkin", "Peet's Coffee"
- If user asks about "fast food", identify "McDonald's", "Chipotle", "Taco Bell"
- If user asks about "streaming services", identify "Netflix", "Spotify", "Hulu"

Respond with ONLY a JSON object (no markdown):
{{
  "matching_merchants": ["list of merchant names that match"],
  "reasoning": "brief explanation of why these match"
}}

If NO merchants match the query, return:
{{
  "matching_merchants": [],
  "reasoning": "None of the merchants match [what user asked for]"
}}

JSON response:"""

        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(
            prompt,
            generation_config={
                'temperature': 0.1,
                'max_output_tokens': 500
            }
        )
        
        response_text = response.text.strip()
        logger.info(f"LLM filter raw response: {response_text[:200]}")
        
        # Clean markdown if present
        if '```' in response_text:
            # Extract JSON from markdown code block
            import re
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', response_text)
            if json_match:
                response_text = json_match.group(1).strip()
        
        # Try to extract JSON object if there's extra text
        if not response_text.startswith('{'):
            import re
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                response_text = json_match.group(0)
        
        result = json.loads(response_text.strip())
        matching_merchants = result.get('matching_merchants', [])
        reasoning = result.get('reasoning', '')
        
        # Filter transactions to those matching the identified merchants
        matching_transactions = []
        for t in txns_to_analyze:
            desc = t.get('description', '').lower()
            for merchant in matching_merchants:
                if merchant.lower() in desc or desc in merchant.lower():
                    matching_transactions.append(t)
                    break
        
        logger.info(f"LLM identified {len(matching_merchants)} matching merchants: {matching_merchants}")
        
        return {
            'matching_transactions': matching_transactions,
            'matching_merchants': matching_merchants,
            'reasoning': reasoning
        }
        
    except Exception as e:
        logger.warning(f"LLM transaction filter failed: {e}")
        # Fallback: Try to find common coffee shop patterns directly
        if 'coffee' in query.lower():
            fallback_matches = []
            for t in txns_to_analyze:
                desc = t.get('description', '').lower()
                if any(kw in desc for kw in ['starbucks', 'coffee', 'cafe', 'dunkin', 'peets', 'espresso']):
                    fallback_matches.append(t)
            if fallback_matches:
                return {
                    'matching_transactions': fallback_matches,
                    'matching_merchants': list(set(t.get('description', '') for t in fallback_matches)),
                    'reasoning': 'Fallback pattern matching for coffee-related merchants'
                }
        return {
            'matching_transactions': [],
            'matching_merchants': [],
            'reasoning': f'LLM filter failed: {str(e)}'
        }


# ========== Structured Query Engine for Hybrid RAG ==========

def execute_structured_query(classification: dict, all_transactions: list) -> dict:
    """
    Execute precise data operations on the full transaction dataset.
    
    This ensures 100% accuracy for MAX, MIN, SUM, AVG, COUNT operations
    by examining ALL matching transactions, not just vector search samples.
    
    Returns:
        {
            'result': computed value or transaction,
            'filtered_transactions': list of matching transactions,
            'verification': str describing what was checked
        }
    """
    intent = classification['intent']
    filters = classification.get('filters', {})
    
    # Start with all transactions
    filtered = all_transactions.copy() if all_transactions else []
    
    # Apply temporal filter
    temporal = filters.get('temporal')
    if temporal:
        if 'date' in temporal:
            # Exact date match
            target_date = temporal['date']
            filtered = [t for t in filtered if t.get('purchase_date') == target_date]
        elif 'month' in temporal and 'year' in temporal:
            # Month/year filter
            target_month = temporal['month']
            target_year = temporal['year']
            filtered = [t for t in filtered if _matches_month_year(t.get('purchase_date', ''), target_month, target_year)]
        elif 'start_date' in temporal:
            # Date range filter
            start = temporal['start_date']
            end = temporal.get('end_date')  # Optional end date
            filtered = [t for t in filtered if t.get('purchase_date', '') >= start]
            if end:
                filtered = [t for t in filtered if t.get('purchase_date', '') <= end]
    
    # Apply merchant filter
    merchants = filters.get('merchants', [])
    if merchants:
        filtered = [t for t in filtered 
                   if any(m.lower() in t.get('description', '').lower() for m in merchants)]
    
    # Apply category filter
    categories = filters.get('categories', [])
    if categories:
        filtered = [t for t in filtered 
                   if any(c.lower() in t.get('category', '').lower() for c in categories)]
    
    # Only consider expenses (negative amounts in our data model)
    expenses_only = [t for t in filtered if float(t.get('amount', 0)) < 0]
    
    result = {
        'result': None,
        'filtered_transactions': filtered,
        'expenses': expenses_only,
        'verification': f"Checked {len(filtered)} matching transactions",
        'intent': intent
    }
    
    if not expenses_only and intent in ['find_maximum', 'find_minimum', 'calculate_total', 'calculate_average']:
        # No expenses found, use all filtered for informational queries
        expenses_only = filtered
    
    if not expenses_only:
        result['verification'] = "No matching transactions found"
        return result
    
    # Execute the operation
    if intent == 'find_maximum':
        # Find largest expense (most negative = biggest spend)
        max_txn = min(expenses_only, key=lambda x: float(x.get('amount', 0)))
        result['result'] = max_txn
        result['verification'] = f"✓ Found maximum from {len(expenses_only)} expenses"
        # Also include top 5 for context
        sorted_txns = sorted(expenses_only, key=lambda x: float(x.get('amount', 0)))
        result['top_5'] = sorted_txns[:5]
        
    elif intent == 'find_minimum':
        # Find smallest expense (least negative = smallest spend)
        min_txn = max(expenses_only, key=lambda x: float(x.get('amount', 0)))
        result['result'] = min_txn
        result['verification'] = f"✓ Found minimum from {len(expenses_only)} expenses"
        
    elif intent == 'calculate_total':
        total = sum(abs(float(t.get('amount', 0))) for t in expenses_only)
        result['result'] = {'total': total, 'count': len(expenses_only)}
        result['verification'] = f"✓ Summed {len(expenses_only)} transactions = ${total:.2f}"
        
    elif intent == 'calculate_average':
        if expenses_only:
            total = sum(abs(float(t.get('amount', 0))) for t in expenses_only)
            avg = total / len(expenses_only)
            result['result'] = {'average': avg, 'count': len(expenses_only), 'total': total}
            result['verification'] = f"✓ Average of {len(expenses_only)} transactions = ${avg:.2f}"
        
    elif intent == 'count':
        result['result'] = {'count': len(filtered)}
        result['verification'] = f"✓ Found {len(filtered)} matching transactions"
    
    elif intent == 'find_recent':
        # Sort ALL transactions by date (most recent first) and return limit
        limit = filters.get('limit', 5)
        # Sort by purchase_date descending
        sorted_txns = sorted(filtered, key=lambda x: x.get('purchase_date', ''), reverse=True)
        recent_txns = sorted_txns[:limit]
        result['result'] = {'transactions': recent_txns, 'count': len(recent_txns)}
        result['verification'] = f"✓ Found {len(recent_txns)} most recent transactions"
        result['recent_transactions'] = recent_txns
    
    return result


def _matches_month_year(date_str: str, month: int, year: int) -> bool:
    """Check if a date string matches the given month and year."""
    try:
        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
        return date_obj.month == month and date_obj.year == year
    except (ValueError, TypeError):
        return False


# ========== RAG-Enhanced Chat Endpoints ==========

@app.route('/api/chat', methods=['POST'])
def chat_with_rag():
    """
    RAG-enhanced chat endpoint.
    
    Supports testing_mode to compare RAG vs non-RAG responses.
    """
    try:
        data = request.get_json()
        user_query = data.get('message', '')
        testing_mode = data.get('testing_mode', False)
        conversation_id = data.get('conversation_id')  # For context memory
        
        if not user_query:
            return jsonify({'error': 'Message is required'}), 400
        
        # Initialize Gemini model
        model = None
        try:
            model = genai.GenerativeModel('gemini-2.5-flash')
        except Exception as e:
            logger.warning(f'Gemini model initialization failed, trying fallback: {e}')
            try:
                model = genai.GenerativeModel('gemini-1.5-flash')
            except Exception as e2:
                logger.warning(f'Fallback model also failed: {e2}')
        
        if not model:
            return jsonify({
                'error': 'AI service temporarily unavailable',
                'response': 'I apologize, but the AI service is currently unavailable. Please try again later.'
            }), 503
        
        # Get RAG service
        rag_svc = None
        context = None
        if RAG_AVAILABLE:
            try:
                rag_svc = get_rag_service()
                if rag_svc and rag_svc.enabled:
                    context = rag_svc.retrieve_context(user_query)
            except Exception as e:
                logger.warning(f'RAG service error: {e}')
        
        # Get conversation context - prefer message_history from frontend (immediate)
        # Fall back to ChromaDB retrieval (may be delayed)
        conversation_context = {'current_conversation': []}
        
        # Use message_history from frontend if provided (more reliable)
        message_history = data.get('message_history', [])
        if message_history:
            # Convert frontend messages to context format
            for msg in message_history[-6:]:  # Last 6 messages (3 turns)
                conversation_context['current_conversation'].append({
                    'text': f"{msg.get('role', 'user')}: {msg.get('content', '')}",
                    'timestamp': msg.get('timestamp', ''),
                    'role': msg.get('role', 'user')
                })
            logger.info(f"Using {len(message_history)} messages from frontend for context")
        elif RAG_AVAILABLE and conversation_id:
            # Fall back to ChromaDB retrieval
            try:
                rag_svc = get_rag_service()
                conversation_context = retrieve_conversation_context(
                    rag_svc, user_query, conversation_id, n_results=5
                )
            except Exception as e:
                logger.warning(f'Conversation context error: {e}')
        
        # Resolve referential queries (they, it, that, there) using conversation context
        resolved_query = user_query
        referential_words = ['they', 'it', 'that', 'this', 'those', 'these', 'there', 'here']
        query_lower = user_query.lower()
        
        if any(word in query_lower.split() for word in referential_words):
            # Extract potential entity from recent conversation
            recent_texts = [ctx.get('text', '') for ctx in conversation_context.get('current_conversation', [])]
            for text in recent_texts:
                # Look for merchant/entity names in previous messages
                import re
                # Common patterns: "was X for $", "at X", "from X"
                patterns = [
                    r'was\s+([A-Z][A-Za-z\s\']+?)\s+for\s+\$',  # "was Starbucks Coffee for $"
                    r'at\s+([A-Z][A-Za-z\s\']+?)[\.\,\s]',     # "at Starbucks"
                    r'from\s+([A-Z][A-Za-z\s\']+?)[\.\,\s]',   # "from Amazon"
                    r'purchase\s+(?:at|from)?\s*([A-Z][A-Za-z\s\']+?)[\.\,\s]',
                ]
                for pattern in patterns:
                    match = re.search(pattern, text)
                    if match:
                        entity = match.group(1).strip()
                        if len(entity) > 2:  # Valid entity name
                            # Rewrite query with explicit entity
                            for word in referential_words:
                                if word in query_lower:
                                    resolved_query = re.sub(
                                        rf'\b{word}\b', entity, user_query, flags=re.IGNORECASE
                                    )
                                    logger.info(f"Resolved '{user_query}' -> '{resolved_query}'")
                                    break
                            break
                if resolved_query != user_query:
                    break
        
        # Re-fetch RAG context with resolved query if it was modified
        if resolved_query != user_query and RAG_AVAILABLE and rag_svc:
            try:
                logger.info(f"Re-fetching RAG context for resolved query: {resolved_query}")
                context = rag_svc.retrieve_context(resolved_query)
            except Exception as e:
                logger.warning(f'RAG re-fetch error: {e}')
        
        if testing_mode:
            # Generate BOTH responses for comparison
            
            # 1. Original response (no RAG)
            original_prompt = f"""You are a helpful financial advisor. Answer the following question:

USER QUESTION: {user_query}

Provide helpful financial advice."""
            
            try:
                original_response = model.generate_content(original_prompt)
                original_text = original_response.text
            except Exception as e:
                logger.error(f"Original response generation failed: {e}")
                original_text = "Failed to generate original response."
            
            # 2. RAG-enhanced response
            rag_text = "RAG not available"
            if rag_svc and rag_svc.enabled and context:
                rag_prompt = rag_svc.build_grounded_prompt(user_query, context)
                try:
                    rag_response = model.generate_content(rag_prompt)
                    rag_text = rag_response.text
                except Exception as e:
                    logger.error(f"RAG response generation failed: {e}")
                    rag_text = "Failed to generate RAG response."
            
            # Format context for display
            context_summary = {
                'transactions_count': len(context.get('transactions', [])) if context else 0,
                'patterns_count': len(context.get('spending_patterns', [])) if context else 0,
                'goals_count': len(context.get('user_goals', [])) if context else 0,
                'sample_data': []
            }
            
            if context and context.get('transactions'):
                context_summary['sample_data'] = [t['text'] for t in context['transactions'][:5]]
            
            return jsonify({
                'original': original_text,
                'rag': rag_text,
                'context_used': context_summary,
                'testing_mode': True
            })
        
        else:
            # ===== HYBRID RAG: Unified LLM Classification =====
            
            # Build conversation history for context-aware classification
            conv_history_for_llm = []
            if conversation_context and conversation_context.get('current_conversation'):
                for ctx in conversation_context['current_conversation'][:3]:
                    conv_history_for_llm.append({
                        'role': ctx.get('role', 'user'),
                        'content': ctx.get('text', '')
                    })
            
            # Single unified LLM call for all classification (structured intent + filters + context needs)
            classification = classify_financial_query(user_query, conv_history_for_llm, use_llm=True)
            logger.info(f"Unified Classification: intent={classification.get('intent')}, "
                       f"structured={classification.get('requires_structured')}, "
                       f"broad_intent={classification.get('broad_intent')}, "
                       f"llm_classified={classification.get('llm_classified', False)}")
            
            # Extract LLM classification info for response (backward compatible)
            llm_classification = {
                'intent': classification.get('broad_intent', 'hybrid'),
                'needs_transaction_data': classification.get('needs_transaction_data', True),
                'needs_general_knowledge': classification.get('needs_general_knowledge', False),
                'reasoning': classification.get('reasoning', ''),
                'entities': classification.get('entities', {})
            }
            
            structured_result = None
            verification = None
            method_used = 'semantic_search'
            
            # Decide processing path based on unified classification
            needs_structured = classification.get('requires_structured', False)
            intent = classification.get('intent', 'general')
            
            # PATH 1.5: Semantic list queries (e.g., "What coffee shops have I bought from?")
            # Use LLM's world knowledge to identify matching merchants
            if intent == 'list' or (classification.get('broad_intent') == 'financial' and not needs_structured):
                # Check if this seems like a "what [type of business] have I..." query
                query_lower = user_query.lower()
                semantic_list_triggers = ['what', 'which', 'show me', 'list', 'where have i', 'have i bought']
                
                if any(trigger in query_lower for trigger in semantic_list_triggers):
                    method_used = 'semantic_llm_filter'
                    
                    # Get transactions (apply temporal filter first if specified)
                    all_transactions = CACHED_TRANSACTIONS.get('data', [])
                    if not all_transactions:
                        all_transactions = generate_realistic_transactions(365, [])
                    
                    # Apply temporal filter if present
                    temporal = classification.get('filters', {}).get('temporal')
                    temporal_filtered = all_transactions
                    if temporal:
                        if 'month' in temporal and 'year' in temporal:
                            temporal_filtered = [t for t in all_transactions 
                                                if _matches_month_year(t.get('purchase_date', ''), temporal['month'], temporal['year'])]
                        elif 'start_date' in temporal:
                            start = temporal['start_date']
                            end = temporal.get('end_date')
                            temporal_filtered = [t for t in all_transactions if t.get('purchase_date', '') >= start]
                            if end:
                                temporal_filtered = [t for t in temporal_filtered if t.get('purchase_date', '') <= end]
                    
                    # Use LLM to semantically identify matching merchants
                    llm_filter_result = filter_transactions_with_llm(user_query, all_transactions, temporal_filtered)
                    
                    matching_txns = llm_filter_result.get('matching_transactions', [])
                    matching_merchants = llm_filter_result.get('matching_merchants', [])
                    reasoning = llm_filter_result.get('reasoning', '')
                    
                    verification = f"LLM identified {len(matching_merchants)} matching merchants from {len(temporal_filtered)} transactions"
                    
                    if matching_txns:
                        # Calculate totals for matched transactions
                        total_spent = sum(abs(float(t.get('amount', 0))) for t in matching_txns if float(t.get('amount', 0)) < 0)
                        
                        context_text = f"""SEMANTIC SEARCH RESULT (using AI's real-world knowledge):

Matching merchants identified: {', '.join(matching_merchants)}
Reasoning: {reasoning}

TRANSACTIONS FOUND ({len(matching_txns)} total, ${total_spent:.2f} spent):"""
                        for t in matching_txns[:15]:  # Show up to 15
                            context_text += f"\n• {t.get('description')}: ${abs(float(t.get('amount', 0))):.2f} on {t.get('purchase_date')}"
                    else:
                        context_text = f"""SEMANTIC SEARCH RESULT:

{reasoning}

No matching transactions found for your query in the specified time period.
Searched {len(temporal_filtered)} transactions."""
                    
                    # Build prompt and proceed to generation
                    conv_history = ""
                    if conversation_context and conversation_context.get('current_conversation'):
                        conv_history = "\nRECENT CONVERSATION:\n"
                        for ctx in conversation_context['current_conversation'][:3]:
                            conv_history += f"- {ctx['text']}\n"
                    
                    prompt = f"""You are a financial advisor with access to the user's transaction data.
{conv_history}
{context_text}

USER QUESTION: {user_query}

IMPORTANT: Use the transaction data above to answer the question. Present the information clearly.

Your response:"""
                    
                    # Skip to response generation
                    try:
                        response = model.generate_content(prompt)
                        
                        return jsonify({
                            'response': response.text,
                            'grounded': True,
                            'method': method_used,
                            'verification': verification,
                            'matching_merchants': matching_merchants,
                            'query_intent': llm_classification.get('intent', 'financial'),
                            'intent_reasoning': reasoning,
                            'needs_transaction_data': True,
                            'needs_general_knowledge': False
                        })
                    except Exception as e:
                        logger.error(f"Response generation failed: {e}")
                        return jsonify({
                            'error': 'Failed to generate response',
                            'response': 'I apologize, but I encountered an error. Please try again.'
                        }), 500
            
            if needs_structured:
                # PATH 1: Structured query for data operations (MAX, MIN, SUM, etc.)
                method_used = 'structured_query'
                
                # Get ALL transactions from cache
                all_transactions = CACHED_TRANSACTIONS.get('data', [])
                if not all_transactions:
                    # Trigger cache population if empty
                    all_transactions = generate_realistic_transactions(365, [])
                
                # Execute precise computation
                structured_result = execute_structured_query(classification, all_transactions)
                verification = structured_result.get('verification', '')
                
                # Build context from computed result
                if structured_result['result']:
                    if classification['intent'] == 'find_maximum':
                        txn = structured_result['result']
                        context_text = f"""VERIFIED RESULT ({verification}):

The BIGGEST expense is:
• {txn.get('description')}: ${abs(float(txn.get('amount', 0))):.2f} on {txn.get('purchase_date')}
Category: {txn.get('category')}

Top 5 expenses for reference:"""
                        for t in structured_result.get('top_5', [])[:5]:
                            context_text += f"\n• {t.get('description')}: ${abs(float(t.get('amount', 0))):.2f} on {t.get('purchase_date')}"
                        
                    elif classification['intent'] == 'find_minimum':
                        txn = structured_result['result']
                        context_text = f"""VERIFIED RESULT ({verification}):

The SMALLEST expense is:
• {txn.get('description')}: ${abs(float(txn.get('amount', 0))):.2f} on {txn.get('purchase_date')}"""

                    elif classification['intent'] == 'calculate_total':
                        r = structured_result['result']
                        context_text = f"""VERIFIED RESULT ({verification}):

TOTAL SPENT: ${r['total']:.2f}
Number of transactions: {r['count']}

Sample transactions:"""
                        for t in structured_result.get('expenses', [])[:10]:
                            context_text += f"\n• {t.get('description')}: ${abs(float(t.get('amount', 0))):.2f}"

                    elif classification['intent'] == 'calculate_average':
                        r = structured_result['result']
                        context_text = f"""VERIFIED RESULT ({verification}):

AVERAGE EXPENSE: ${r['average']:.2f}
Total spent: ${r['total']:.2f}
Number of transactions: {r['count']}"""

                    elif classification['intent'] == 'count':
                        r = structured_result['result']
                        context_text = f"""VERIFIED RESULT ({verification}):

COUNT: {r['count']} transactions found"""

                    elif classification['intent'] == 'find_recent':
                        recent_txns = structured_result.get('recent_transactions', [])
                        context_text = f"""VERIFIED RESULT ({verification}):

MOST RECENT TRANSACTIONS (sorted by date, newest first):"""
                        for t in recent_txns:
                            context_text += f"\n• {t.get('description')}: ${abs(float(t.get('amount', 0))):.2f} on {t.get('purchase_date')}"
                else:
                    context_text = f"No matching transactions found. {verification}"
                
                # Build conversation history string
                conv_history = ""
                if conversation_context and conversation_context.get('current_conversation'):
                    conv_history = "\nRECENT CONVERSATION:\n"
                    for ctx in conversation_context['current_conversation'][:3]:
                        conv_history += f"- {ctx['text']}\n"
                
                prompt = f"""You are a financial advisor with access to VERIFIED, COMPUTED financial data.
{conv_history}
{context_text}

USER QUESTION: {user_query}

IMPORTANT INSTRUCTIONS:
- The data above has been VERIFIED by checking ALL relevant transactions
- Simply present the pre-computed answer clearly
- Do NOT recalculate or second-guess the provided numbers
- If the user uses words like "they", "it", "that", "this", refer to the RECENT CONVERSATION above
- Keep response concise

Your response:"""
            
            else:
                # PATH 2: Semantic search for conversational queries
                # Build conversation history string
                conv_history = ""
                if conversation_context and conversation_context.get('current_conversation'):
                    conv_history = "\nRECENT CONVERSATION:\n"
                    for ctx in conversation_context['current_conversation'][:3]:
                        conv_history += f"- {ctx['text']}\n"
                
                if rag_svc and rag_svc.enabled and context:
                    base_prompt = rag_svc.build_grounded_prompt(user_query, context)
                    # Inject conversation history
                    if conv_history:
                        prompt = base_prompt.replace("USER QUESTION:", f"{conv_history}\nUSER QUESTION:")
                    else:
                        prompt = base_prompt
                else:
                    # Fallback to basic prompt if RAG not available
                    prompt = f"""You are a helpful financial advisor. Answer the following question:
{conv_history}
USER QUESTION: {user_query}

If the user refers to something using "they", "it", "that", check the RECENT CONVERSATION above.

Provide helpful financial advice."""
            
            try:
                response = model.generate_content(prompt)
                
                # Build temporal filter description if available
                temporal_filter = classification.get('filters', {}).get('temporal')
                temporal_desc = None
                if temporal_filter:
                    from datetime import datetime
                    temporal_desc = format_temporal_filter_human(temporal_filter, datetime.now())
                
                # Embed conversation turns for future context
                if RAG_AVAILABLE and conversation_id:
                    try:
                        rag_svc = get_rag_service()
                        timestamp = datetime.now().isoformat()
                        # Embed user message
                        embed_conversation_message(
                            rag_svc, conversation_id, 
                            str(uuid.uuid4()), 'user', user_query, timestamp
                        )
                        # Embed assistant response
                        embed_conversation_message(
                            rag_svc, conversation_id,
                            str(uuid.uuid4()), 'assistant', response.text, timestamp
                        )
                    except Exception as e:
                        logger.warning(f"Failed to embed conversation: {e}")
                
                return jsonify({
                    'response': response.text,
                    'grounded': True,
                    'method': method_used,
                    'verification': verification,
                    'temporal_filter': temporal_desc,
                    'llm_extracted': classification.get('filters', {}).get('llm_extracted', False),
                    'conversation_context_used': conversation_context is not None and len(conversation_context.get('current_conversation', [])) > 0,
                    'query_intent': llm_classification.get('intent') if llm_classification else None,
                    'intent_reasoning': llm_classification.get('reasoning') if llm_classification else None,
                    'needs_transaction_data': llm_classification.get('needs_transaction_data') if llm_classification else None,
                    'needs_general_knowledge': llm_classification.get('needs_general_knowledge') if llm_classification else None,
                    'entities_detected': llm_classification.get('entities') if llm_classification else None
                })
            except Exception as e:
                logger.error(f"Response generation failed: {e}")
                return jsonify({
                    'error': 'Failed to generate response',
                    'response': 'I apologize, but I encountered an error. Please try again.'
                }), 500
    
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/rag/embed-transactions', methods=['POST'])
def embed_transactions_endpoint():
    """
    Embed transactions into RAG vector database.
    
    Accepts a list of transactions to embed.
    """
    if not RAG_AVAILABLE:
        return jsonify({'error': 'RAG service not available'}), 503
    
    try:
        data = request.get_json()
        transactions = data.get('transactions', [])
        
        if not transactions:
            return jsonify({'error': 'No transactions provided'}), 400
        
        rag_svc = get_rag_service()
        if not rag_svc or not rag_svc.enabled:
            return jsonify({'error': 'RAG service not initialized'}), 503
        
        count = rag_svc.embed_transactions_batch(transactions)
        
        return jsonify({
            'success': True,
            'embedded_count': count,
            'total_provided': len(transactions)
        })
    
    except Exception as e:
        logger.error(f"Error embedding transactions: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/rag/stats', methods=['GET'])
def get_rag_stats():
    """Get RAG vector database statistics."""
    if not RAG_AVAILABLE:
        return jsonify({
            'available': False,
            'message': 'RAG service not available'
        })
    
    try:
        rag_svc = get_rag_service()
        if not rag_svc:
            return jsonify({
                'available': False,
                'message': 'RAG service not initialized'
            })
        
        stats = rag_svc.get_collection_stats()
        
        return jsonify({
            'available': rag_svc.enabled,
            'collections': stats
        })
    
    except Exception as e:
        logger.error(f"Error getting RAG stats: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/rag/sync-transactions', methods=['POST'])
def sync_transactions_to_rag():
    """
    Sync current Plaid transactions to RAG database.
    
    Fetches transactions from Plaid and embeds them.
    """
    if not RAG_AVAILABLE:
        return jsonify({'error': 'RAG service not available'}), 503
    
    try:
        rag_svc = get_rag_service()
        if not rag_svc or not rag_svc.enabled:
            return jsonify({'error': 'RAG service not initialized'}), 503
        
        # Get transactions from Plaid
        try:
            access_token = get_or_create_sandbox_token()
            
            cursor = PLAID_TRANSACTION_CURSORS.get('default', '')
            all_transactions = []
            has_more = True
            
            while has_more:
                sync_request = TransactionsSyncRequest(
                    access_token=access_token,
                    cursor=cursor if cursor else None
                )
                sync_response = plaid_client.transactions_sync(sync_request)
                
                for trans in sync_response['added']:
                    all_transactions.append({
                        'transaction_id': trans['transaction_id'],
                        'account_id': trans['account_id'],
                        'date': str(trans['date']),
                        'name': trans['name'],
                        'merchant_name': trans.get('merchant_name'),
                        'amount': trans['amount'],
                        'category': trans.get('category', []),
                        'pending': trans['pending']
                    })
                
                cursor = sync_response['next_cursor']
                has_more = sync_response['has_more']
                
                if len(all_transactions) > 500:
                    break
            
            PLAID_TRANSACTION_CURSORS['default'] = cursor
            
        except Exception as e:
            logger.warning(f"Plaid sync failed, using mock data: {e}")
            # Use mock transactions
            all_transactions = generate_realistic_transactions(30, [])
        
        # Transform and embed
        transformed = []
        for t in all_transactions:
            transformed.append({
                '_id': t.get('transaction_id') or t.get('_id'),
                'description': t.get('merchant_name') or t.get('name') or t.get('description'),
                'amount': t.get('amount'),
                'purchase_date': t.get('date') or t.get('purchase_date'),
                'category': t.get('category')
            })
        
        count = rag_svc.embed_transactions_batch(transformed)
        
        return jsonify({
            'success': True,
            'embedded_count': count,
            'total_fetched': len(all_transactions)
        })
    
    except Exception as e:
        logger.error(f"Error syncing transactions to RAG: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/rag/initialize', methods=['POST'])
def initialize_rag_data():
    """
    Initialize RAG database with all financial data on app startup.
    Only syncs if data is missing or force_refresh is True.
    """
    if not RAG_AVAILABLE:
        return jsonify({
            'success': False,
            'message': 'RAG service not available',
            'initialized': False
        })
    
    try:
        import time
        start_time = time.time()
        
        data = request.get_json() or {}
        force_refresh = data.get('force_refresh', False)
        
        rag_svc = get_rag_service()
        if not rag_svc or not rag_svc.enabled:
            return jsonify({
                'success': False,
                'message': 'RAG service not initialized',
                'initialized': False
            })
        
        # Check current stats
        stats = rag_svc.get_collection_stats()
        transactions_count = stats.get('transactions', 0)
        
        # If data exists and no force refresh, return early
        if transactions_count > 0 and not force_refresh:
            elapsed = time.time() - start_time
            return jsonify({
                'success': True,
                'message': 'Data already loaded',
                'initialized': True,
                'skipped_sync': True,
                'stats': stats,
                'elapsed_seconds': round(elapsed, 2)
            })
        
        # Use cached transactions from first load instead of re-fetching
        all_transactions = []
        
        # Check if we have cached transactions from generate_realistic_transactions
        if CACHED_TRANSACTIONS['data'] is not None and len(CACHED_TRANSACTIONS['data']) > 0:
            logger.info(f"Using {len(CACHED_TRANSACTIONS['data'])} cached transactions for RAG")
            all_transactions = CACHED_TRANSACTIONS['data']
        else:
            # No cache yet - trigger generation which will cache
            logger.info("No cached transactions, generating for RAG")
            all_transactions = generate_realistic_transactions(365, [])
        
        # Transform and embed transactions
        # Cached transactions already have: _id, description, amount, purchase_date, category
        transformed = []
        for t in all_transactions:
            trans_id = t.get('_id') or t.get('transaction_id')
            if not trans_id:
                continue  # Skip transactions without ID
            transformed.append({
                '_id': trans_id,
                'description': t.get('description') or t.get('merchant_name') or t.get('name'),
                'amount': t.get('amount'),
                'purchase_date': t.get('purchase_date') or t.get('date'),
                'category': t.get('category')
            })
        
        embedded_count = rag_svc.embed_transactions_batch(transformed)
        
        # Calculate and embed spending patterns by category
        category_totals = defaultdict(float)
        for t in all_transactions:
            categories = t.get('category', [])
            if isinstance(categories, list) and categories:
                category = categories[0]
            elif isinstance(categories, str):
                category = categories
            else:
                category = 'Uncategorized'
            category_totals[category] += abs(float(t.get('amount', 0)))
        
        patterns_count = 0
        for category, total in category_totals.items():
            pattern = {
                'id': f"pattern_{category}",
                'category': category,
                'total': total,
                'period': 'last 90 days',
                'budget': 0,
                'variance_percent': 0
            }
            if rag_svc.embed_spending_pattern(pattern):
                patterns_count += 1
        
        elapsed = time.time() - start_time
        final_stats = rag_svc.get_collection_stats()
        
        logger.info(f"RAG initialized: {embedded_count} transactions, {patterns_count} patterns in {elapsed:.2f}s")
        
        return jsonify({
            'success': True,
            'message': 'RAG data initialized successfully',
            'initialized': True,
            'skipped_sync': False,
            'transactions_embedded': embedded_count,
            'patterns_embedded': patterns_count,
            'stats': final_stats,
            'elapsed_seconds': round(elapsed, 2)
        })
    
    except Exception as e:
        logger.error(f"Error initializing RAG data: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'initialized': False
        }), 500


# ========== Conversation History Endpoints ==========

@app.route('/api/conversations', methods=['POST'])
def create_conversation():
    """Create a new conversation"""
    try:
        data = request.get_json() or {}
        conversation_id = data.get('id') or str(uuid.uuid4())
        user_id = data.get('user_id', 'default_user')
        title = data.get('title', 'New Conversation')
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO conversations 
            (id, user_id, created_at, updated_at, title, message_count)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            conversation_id,
            user_id,
            datetime.now().isoformat(),
            datetime.now().isoformat(),
            title,
            0
        ))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'conversation_id': conversation_id,
            'status': 'created'
        })
    except Exception as e:
        logger.error(f"Error creating conversation: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/conversations', methods=['GET'])
def get_conversations():
    """Get list of all conversations"""
    try:
        user_id = request.args.get('user_id', 'default_user')
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, title, created_at, updated_at, message_count
            FROM conversations
            WHERE user_id = ?
            ORDER BY updated_at DESC
            LIMIT 50
        ''', (user_id,))
        
        conversations = []
        for row in cursor.fetchall():
            conversations.append({
                'id': row[0],
                'title': row[1],
                'created_at': row[2],
                'updated_at': row[3],
                'message_count': row[4]
            })
        
        conn.close()
        
        return jsonify({'conversations': conversations})
    except Exception as e:
        logger.error(f"Error getting conversations: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/conversations/<conversation_id>/messages', methods=['GET'])
def get_conversation_messages(conversation_id):
    """Get all messages in a conversation"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, role, content, timestamp, metadata
            FROM messages
            WHERE conversation_id = ?
            ORDER BY timestamp ASC
        ''', (conversation_id,))
        
        messages = []
        for row in cursor.fetchall():
            messages.append({
                'id': row[0],
                'role': row[1],
                'content': row[2],
                'timestamp': row[3],
                'metadata': json.loads(row[4]) if row[4] else {}
            })
        
        conn.close()
        
        return jsonify({'messages': messages})
    except Exception as e:
        logger.error(f"Error getting messages: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/conversations/<conversation_id>/messages', methods=['POST'])
def save_message(conversation_id):
    """Save a message to a conversation"""
    try:
        data = request.get_json()
        message_id = str(uuid.uuid4())
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Ensure conversation exists
        cursor.execute('''
            INSERT OR IGNORE INTO conversations 
            (id, created_at, updated_at, title, message_count)
            VALUES (?, ?, ?, ?, 0)
        ''', (conversation_id, datetime.now().isoformat(), datetime.now().isoformat(), 'New Conversation'))
        
        # Save message
        cursor.execute('''
            INSERT INTO messages 
            (id, conversation_id, role, content, timestamp, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            message_id,
            conversation_id,
            data['role'],
            data['content'],
            datetime.now().isoformat(),
            json.dumps(data.get('metadata', {}))
        ))
        
        # Update conversation
        cursor.execute('''
            UPDATE conversations 
            SET updated_at = ?, message_count = message_count + 1
            WHERE id = ?
        ''', (datetime.now().isoformat(), conversation_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message_id': message_id,
            'status': 'saved'
        })
    except Exception as e:
        logger.error(f"Error saving message: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/conversations/<conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    """Delete a conversation and its messages from SQLite and ChromaDB"""
    try:
        # Delete from SQLite
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Delete messages first (foreign key)
        cursor.execute('DELETE FROM messages WHERE conversation_id = ?', (conversation_id,))
        msg_count = cursor.rowcount
        
        # Delete conversation
        cursor.execute('DELETE FROM conversations WHERE id = ?', (conversation_id,))
        
        conn.commit()
        conn.close()
        
        # Delete from ChromaDB conversation memory
        if RAG_AVAILABLE:
            try:
                rag_svc = get_rag_service()
                if rag_svc and rag_svc.enabled:
                    from rag_service import CONVERSATION_MEMORY_COLLECTION
                    collection = rag_svc.chroma_client.get_collection(
                        name=CONVERSATION_MEMORY_COLLECTION,
                        embedding_function=rag_svc.embedding_function
                    )
                    # Get all message IDs for this conversation
                    results = collection.get(where={'conversation_id': conversation_id})
                    if results['ids']:
                        collection.delete(ids=results['ids'])
                        logger.info(f"Deleted {len(results['ids'])} embeddings from ChromaDB")
            except Exception as e:
                logger.warning(f"ChromaDB cleanup failed: {e}")
        
        logger.info(f"Deleted conversation {conversation_id} with {msg_count} messages")
        
        return jsonify({
            'status': 'deleted',
            'conversation_id': conversation_id,
            'messages_deleted': msg_count
        })
    except Exception as e:
        logger.error(f"Error deleting conversation: {e}")
        return jsonify({'error': str(e)}), 500


# ========== End Conversation History Endpoints ==========


# ========== User Profile API Endpoints ==========

@app.route('/api/profile', methods=['GET'])
def get_user_profile():
    """Get current user's complete profile."""
    logger.info("GET /api/profile")
    
    if not PROFILE_AVAILABLE:
        return jsonify({'error': 'Profile service not available'}), 503
    
    try:
        user_id = request.args.get('user_id', 'default_user')
        profile_svc = get_profile_service()
        profile = profile_svc.get_profile(user_id)
        return jsonify(profile)
    except Exception as e:
        logger.error(f"Error getting profile: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/profile', methods=['PUT'])
def update_user_profile():
    """Update user profile fields."""
    logger.info("PUT /api/profile")
    
    if not PROFILE_AVAILABLE:
        return jsonify({'error': 'Profile service not available'}), 503
    
    try:
        data = request.json
        user_id = data.get('user_id', 'default_user')
        profile_svc = get_profile_service()
        
        success = profile_svc.update_profile(user_id, data)
        if success:
            return jsonify({'status': 'updated'})
        return jsonify({'error': 'Update failed'}), 500
    except Exception as e:
        logger.error(f"Error updating profile: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/profile/demographics', methods=['PUT'])
def update_demographics():
    """Update user demographics."""
    logger.info("PUT /api/profile/demographics")
    
    if not PROFILE_AVAILABLE:
        return jsonify({'error': 'Profile service not available'}), 503
    
    try:
        data = request.json
        user_id = data.get('user_id', 'default_user')
        profile_svc = get_profile_service()
        
        success = profile_svc.update_demographics(user_id, data)
        if success:
            return jsonify({'status': 'updated'})
        return jsonify({'error': 'Update failed'}), 500
    except Exception as e:
        logger.error(f"Error updating demographics: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/profile/financials', methods=['PUT'])
def update_financials():
    """Update user financial attributes."""
    logger.info("PUT /api/profile/financials")
    
    if not PROFILE_AVAILABLE:
        return jsonify({'error': 'Profile service not available'}), 503
    
    try:
        data = request.json
        user_id = data.get('user_id', 'default_user')
        profile_svc = get_profile_service()
        
        success = profile_svc.update_financials(user_id, data)
        if success:
            return jsonify({'status': 'updated'})
        return jsonify({'error': 'Update failed'}), 500
    except Exception as e:
        logger.error(f"Error updating financials: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/profile/preferences', methods=['PUT'])
def update_preferences():
    """Update user preferences."""
    logger.info("PUT /api/profile/preferences")
    
    if not PROFILE_AVAILABLE:
        return jsonify({'error': 'Profile service not available'}), 503
    
    try:
        data = request.json
        user_id = data.get('user_id', 'default_user')
        profile_svc = get_profile_service()
        
        success = profile_svc.update_preferences(user_id, data)
        if success:
            return jsonify({'status': 'updated'})
        return jsonify({'error': 'Update failed'}), 500
    except Exception as e:
        logger.error(f"Error updating preferences: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/profile/onboarding', methods=['POST'])
def complete_onboarding():
    """Complete user onboarding with all profile data."""
    logger.info("POST /api/profile/onboarding")
    
    if not PROFILE_AVAILABLE:
        return jsonify({'error': 'Profile service not available'}), 503
    
    try:
        data = request.json
        user_id = data.get('user_id', 'default_user')
        profile_svc = get_profile_service()
        
        success = profile_svc.complete_onboarding(user_id, data)
        if success:
            return jsonify({'status': 'onboarding_complete'})
        return jsonify({'error': 'Onboarding failed'}), 500
    except Exception as e:
        logger.error(f"Error completing onboarding: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/profile/behaviors', methods=['GET'])
def get_user_behaviors():
    """Get user's calculated behavioral attributes."""
    logger.info("GET /api/profile/behaviors")
    
    if not PROFILE_AVAILABLE:
        return jsonify({'error': 'Profile service not available'}), 503
    
    try:
        user_id = request.args.get('user_id', 'default_user')
        profile_svc = get_profile_service()
        
        # Get transactions and update behaviors
        all_transactions = CACHED_TRANSACTIONS.get('data', [])
        if all_transactions:
            behaviors = profile_svc.update_behaviors(user_id, all_transactions)
        else:
            profile = profile_svc.get_profile(user_id)
            behaviors = profile.get('behaviors', {})
        
        return jsonify(behaviors)
    except Exception as e:
        logger.error(f"Error getting behaviors: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/profile/context', methods=['GET'])
def get_personalization_context():
    """Get personalization context string for AI prompts."""
    logger.info("GET /api/profile/context")
    
    if not PROFILE_AVAILABLE:
        return jsonify({'error': 'Profile service not available'}), 503
    
    try:
        user_id = request.args.get('user_id', 'default_user')
        profile_svc = get_profile_service()
        context = profile_svc.get_personalization_context(user_id)
        return jsonify({'context': context})
    except Exception as e:
        logger.error(f"Error getting context: {e}")
        return jsonify({'error': str(e)}), 500


# ========== End User Profile Endpoints ==========


# ========== AGENTIC FUNCTION CALLING ==========

# Tool definitions for Gemini function calling
FINANCIAL_TOOLS = [
    genai.protos.Tool(
        function_declarations=[
            genai.protos.FunctionDeclaration(
                name="get_transactions",
                description="Get user's financial transactions, optionally filtered by date range, merchant, or category. Use this to see what purchases were made.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "start_date": genai.protos.Schema(type=genai.protos.Type.STRING, description="Start date in YYYY-MM-DD format"),
                        "end_date": genai.protos.Schema(type=genai.protos.Type.STRING, description="End date in YYYY-MM-DD format"),
                        "merchant": genai.protos.Schema(type=genai.protos.Type.STRING, description="Filter by merchant name (e.g., 'Starbucks')"),
                        "category": genai.protos.Schema(type=genai.protos.Type.STRING, description="Filter by category (e.g., 'Food & Drink', 'Shopping')"),
                        "limit": genai.protos.Schema(type=genai.protos.Type.INTEGER, description="Maximum number of transactions to return")
                    }
                )
            ),
            genai.protos.FunctionDeclaration(
                name="calculate_spending",
                description="Calculate aggregate spending metrics like total, average, count, max, or min. Use this for questions about spending amounts.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "operation": genai.protos.Schema(type=genai.protos.Type.STRING, description="The calculation: 'total', 'average', 'count', 'max', or 'min'"),
                        "start_date": genai.protos.Schema(type=genai.protos.Type.STRING, description="Start date YYYY-MM-DD"),
                        "end_date": genai.protos.Schema(type=genai.protos.Type.STRING, description="End date YYYY-MM-DD"),
                        "category": genai.protos.Schema(type=genai.protos.Type.STRING, description="Filter by category"),
                        "merchant": genai.protos.Schema(type=genai.protos.Type.STRING, description="Filter by merchant")
                    },
                    required=["operation"]
                )
            ),
            genai.protos.FunctionDeclaration(
                name="identify_merchants_by_type",
                description="Use AI to identify merchants that match a business type from user's transactions. For example, identify which merchants are 'coffee shops', 'fast food', 'streaming services', etc.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "business_type": genai.protos.Schema(type=genai.protos.Type.STRING, description="Type of business to search for (e.g., 'coffee shops', 'restaurants', 'streaming services')"),
                        "start_date": genai.protos.Schema(type=genai.protos.Type.STRING, description="Start date YYYY-MM-DD"),
                        "end_date": genai.protos.Schema(type=genai.protos.Type.STRING, description="End date YYYY-MM-DD")
                    },
                    required=["business_type"]
                )
            ),
            genai.protos.FunctionDeclaration(
                name="get_spending_by_category",
                description="Get a breakdown of spending by category for a time period.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "start_date": genai.protos.Schema(type=genai.protos.Type.STRING, description="Start date YYYY-MM-DD"),
                        "end_date": genai.protos.Schema(type=genai.protos.Type.STRING, description="End date YYYY-MM-DD")
                    }
                )
            ),
            genai.protos.FunctionDeclaration(
                name="get_current_date",
                description="Get today's date. Use this to calculate relative dates like 'this month', 'last week', etc.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={}
                )
            ),
            genai.protos.FunctionDeclaration(
                name="get_user_profile",
                description="Get the user's profile information including demographics (age, income, employment, occupation), financial goals (primary goal, risk tolerance, investment experience), and preferences. Use this to answer ANY questions about the user personally, such as 'Is my job high paying?', 'What is my income?', 'What are my goals?', 'Am I a beginner investor?', etc.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "section": genai.protos.Schema(type=genai.protos.Type.STRING, description="Optional: 'demographics', 'financials', 'behaviors', 'preferences', or 'all' (default)")
                    }
                )
            ),
            genai.protos.FunctionDeclaration(
                name="search_transactions_semantic",
                description="Search for transactions using semantic/natural language queries. Uses RAG (Retrieval Augmented Generation) with ChromaDB to find relevant transactions. Use this for complex or vague queries like 'entertainment subscriptions', 'weekend spending', 'luxury purchases', 'eating out', etc. Returns the most relevant transactions based on meaning, not just text matching.",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={
                        "query": genai.protos.Schema(type=genai.protos.Type.STRING, description="Natural language search query (e.g., 'coffee shops', 'streaming services', 'restaurants')"),
                        "limit": genai.protos.Schema(type=genai.protos.Type.INTEGER, description="Maximum results to return (default 10)")
                    },
                    required=["query"]
                )
            )
        ]
    )
]


def execute_agentic_tool(tool_name: str, args: dict) -> dict:
    """Execute a tool and return the result."""
    logger.info(f"Executing tool: {tool_name} with args: {args}")
    
    today = datetime.now()
    
    # Get all transactions
    all_transactions = CACHED_TRANSACTIONS.get('data', [])
    if not all_transactions:
        all_transactions = generate_realistic_transactions(365, [])
    
    if tool_name == "get_current_date":
        return {
            "today": today.strftime("%Y-%m-%d"),
            "day_of_week": today.strftime("%A"),
            "month": today.strftime("%B"),
            "year": today.year
        }
    
    elif tool_name == "get_transactions":
        filtered = all_transactions.copy()
        
        # Apply date filters
        if args.get("start_date"):
            filtered = [t for t in filtered if t.get('purchase_date', '') >= args['start_date']]
        if args.get("end_date"):
            filtered = [t for t in filtered if t.get('purchase_date', '') <= args['end_date']]
        
        # Apply merchant filter
        if args.get("merchant"):
            merchant = args['merchant'].lower()
            filtered = [t for t in filtered if merchant in t.get('description', '').lower()]
        
        # Apply category filter
        if args.get("category"):
            category = args['category'].lower()
            filtered = [t for t in filtered if category in t.get('category', '').lower()]
        
        # Apply limit (convert to int since Gemini returns floats)
        limit = int(args.get("limit", 20))
        filtered = sorted(filtered, key=lambda x: x.get('purchase_date', ''), reverse=True)[:limit]
        
        return {
            "transactions": [
                {
                    "merchant": t.get('description'),
                    "amount": abs(float(t.get('amount', 0))),
                    "date": t.get('purchase_date'),
                    "category": t.get('category')
                }
                for t in filtered
            ],
            "count": len(filtered)
        }
    
    elif tool_name == "calculate_spending":
        filtered = [t for t in all_transactions if float(t.get('amount', 0)) < 0]  # Expenses only
        
        # Apply date filters
        if args.get("start_date"):
            filtered = [t for t in filtered if t.get('purchase_date', '') >= args['start_date']]
        if args.get("end_date"):
            filtered = [t for t in filtered if t.get('purchase_date', '') <= args['end_date']]
        
        # Apply merchant filter
        if args.get("merchant"):
            merchant = args['merchant'].lower()
            filtered = [t for t in filtered if merchant in t.get('description', '').lower()]
        
        # Apply category filter
        if args.get("category"):
            category = args['category'].lower()
            filtered = [t for t in filtered if category in t.get('category', '').lower()]
        
        operation = args.get("operation", "total")
        amounts = [abs(float(t.get('amount', 0))) for t in filtered]
        
        if not amounts:
            return {"result": 0, "count": 0, "message": "No matching transactions found"}
        
        if operation == "total":
            return {"total": sum(amounts), "count": len(amounts)}
        elif operation == "average":
            return {"average": sum(amounts) / len(amounts), "count": len(amounts)}
        elif operation == "count":
            return {"count": len(amounts)}
        elif operation == "max":
            max_idx = amounts.index(max(amounts))
            return {"max_amount": max(amounts), "merchant": filtered[max_idx].get('description'), "date": filtered[max_idx].get('purchase_date')}
        elif operation == "min":
            min_idx = amounts.index(min(amounts))
            return {"min_amount": min(amounts), "merchant": filtered[min_idx].get('description'), "date": filtered[min_idx].get('purchase_date')}
    
    elif tool_name == "identify_merchants_by_type":
        business_type = args.get("business_type", "")
        
        # Get filtered transactions by date
        filtered = all_transactions.copy()
        if args.get("start_date"):
            filtered = [t for t in filtered if t.get('purchase_date', '') >= args['start_date']]
        if args.get("end_date"):
            filtered = [t for t in filtered if t.get('purchase_date', '') <= args['end_date']]
        
        # Use the LLM filter function we already have
        result = filter_transactions_with_llm(
            f"Find {business_type}", 
            all_transactions, 
            filtered
        )
        
        matching = result.get('matching_transactions', [])
        merchants = result.get('matching_merchants', [])
        
        # Calculate totals per merchant
        merchant_totals = {}
        for t in matching:
            desc = t.get('description', 'Unknown')
            amt = abs(float(t.get('amount', 0)))
            merchant_totals[desc] = merchant_totals.get(desc, 0) + amt
        
        return {
            "business_type": business_type,
            "matching_merchants": merchants,
            "merchant_spending": merchant_totals,
            "total_transactions": len(matching),
            "total_spent": sum(merchant_totals.values()),
            "reasoning": result.get('reasoning', '')
        }
    
    elif tool_name == "get_spending_by_category":
        filtered = [t for t in all_transactions if float(t.get('amount', 0)) < 0]
        
        # Apply date filters
        if args.get("start_date"):
            filtered = [t for t in filtered if t.get('purchase_date', '') >= args['start_date']]
        if args.get("end_date"):
            filtered = [t for t in filtered if t.get('purchase_date', '') <= args['end_date']]
        
        # Group by category
        category_totals = {}
        for t in filtered:
            cat = t.get('category', 'Other')
            amt = abs(float(t.get('amount', 0)))
            category_totals[cat] = category_totals.get(cat, 0) + amt
        
        return {
            "categories": category_totals,
            "total": sum(category_totals.values())
        }
    
    elif tool_name == "get_user_profile":
        section = args.get("section", "all")
        user_id = args.get("user_id", "default_user")
        
        if PROFILE_AVAILABLE:
            try:
                profile_svc = get_profile_service()
                full_profile = profile_svc.get_profile(user_id)
                
                if section == "all":
                    return {
                        "name": full_profile.get('core', {}).get('name', 'User'),
                        "demographics": full_profile.get('demographics', {}),
                        "financials": full_profile.get('financials', {}),
                        "behaviors": full_profile.get('behaviors', {}),
                        "preferences": full_profile.get('preferences', {}),
                        "onboarding_completed": full_profile.get('core', {}).get('onboarding_completed', False)
                    }
                elif section == "demographics":
                    return full_profile.get('demographics', {})
                elif section == "financials":
                    return full_profile.get('financials', {})
                elif section == "behaviors":
                    return full_profile.get('behaviors', {})
                elif section == "preferences":
                    return full_profile.get('preferences', {})
                else:
                    return full_profile
            except Exception as e:
                return {"error": str(e)}
        else:
            return {"error": "Profile service not available"}
    
    elif tool_name == "search_transactions_semantic":
        query = args.get("query", "")
        limit = int(args.get("limit", 10))
        
        if RAG_AVAILABLE:
            try:
                rag_service = get_rag_service()
                # Query the transactions collection
                results = rag_service.collection.query(
                    query_texts=[query],
                    n_results=min(limit, 20)
                )
                
                if results and results.get('documents') and results['documents'][0]:
                    transactions = []
                    metadatas = results.get('metadatas', [[]])[0]
                    documents = results['documents'][0]
                    
                    for i, doc in enumerate(documents):
                        meta = metadatas[i] if i < len(metadatas) else {}
                        transactions.append({
                            "description": meta.get('description', doc[:50]),
                            "amount": meta.get('amount', 0),
                            "category": meta.get('category', 'Unknown'),
                            "date": meta.get('purchase_date', 'Unknown')
                        })
                    
                    total_amount = sum(abs(float(t.get('amount', 0))) for t in transactions)
                    
                    return {
                        "query": query,
                        "transactions_found": len(transactions),
                        "transactions": transactions[:10],  # Limit response size
                        "total_amount": total_amount,
                        "source": "RAG semantic search (ChromaDB)"
                    }
                else:
                    return {
                        "query": query,
                        "transactions_found": 0,
                        "transactions": [],
                        "message": "No matching transactions found"
                    }
            except Exception as e:
                logger.warning(f"RAG search failed: {e}")
                return {"error": f"RAG search failed: {str(e)}"}
        else:
            return {"error": "RAG service not available"}
    
    return {"error": f"Unknown tool: {tool_name}"}


AGENTIC_SYSTEM_PROMPT = """You are an AI financial advisor with access to the user's transaction data AND their personal profile.

You have tools available to:
1. get_transactions - Retrieve transactions with filters (by date, merchant, category)
2. calculate_spending - Calculate totals, averages, counts
3. identify_merchants_by_type - Find merchants by business type (coffee shops, fast food, etc.)
4. get_spending_by_category - Get category breakdown
5. get_current_date - Get today's date for calculating relative dates
6. get_user_profile - GET THE USER'S PERSONAL PROFILE including income, job, goals, risk tolerance, etc.
7. search_transactions_semantic - SEMANTIC SEARCH using RAG/AI to find relevant transactions by meaning (use for vague queries)

TOOL SELECTION GUIDELINES:
- For personal questions (income, job, goals) → use get_user_profile
- For specific date/merchant queries → use get_transactions
- For vague/semantic queries ("entertainment", "eating out", "subscriptions") → use search_transactions_semantic
- For relative dates ("this month", "last week") → call get_current_date FIRST

CRITICAL: For ANY question about the user personally (income, job, goals, age, experience level, etc.), you MUST call get_user_profile FIRST. Examples:
- "Is my job high paying?" → call get_user_profile to get income_range
- "What are my financial goals?" → call get_user_profile to get primary_goal
- "Am I a beginner or advanced investor?" → call get_user_profile to get investment_experience
- "What's my risk tolerance?" → call get_user_profile to get risk_tolerance

IMPORTANT GUIDELINES:
- ALWAYS call get_current_date FIRST if the user mentions relative dates like "this month", "last week", "today"
- Use identify_merchants_by_type when the user asks about business categories (coffee shops, restaurants, streaming)
- Chain multiple tool calls together to answer complex questions
- Present financial data clearly with amounts formatted as currency

Be conversational but precise. Use actual data from the tools, never make up numbers."""


@app.route('/api/chat/agentic', methods=['POST'])
def agentic_chat():
    """
    Agentic chat endpoint using Gemini native function calling.
    The AI autonomously decides which tools to call based on the user's query.
    """
    logger.info("POST /api/chat/agentic")
    
    try:
        data = request.json
        user_query = data.get('message', '')
        conversation_id = data.get('conversation_id', f"conv_{datetime.now().timestamp()}")
        user_id = data.get('user_id', 'default_user')
        
        if not user_query:
            return jsonify({'error': 'Message is required'}), 400
        
        # Get personalized system prompt
        personalized_prompt = AGENTIC_SYSTEM_PROMPT
        if PROFILE_AVAILABLE:
            try:
                profile_svc = get_profile_service()
                profile_context = profile_svc.get_personalization_context(user_id)
                personalized_prompt = f"""{AGENTIC_SYSTEM_PROMPT}

USER PROFILE:
{profile_context}

PERSONALIZATION GUIDELINES:
- Address the user by name if known
- Consider their financial goals when giving advice
- Adjust complexity based on their investment experience
- Be mindful of their risk tolerance
- Use their preferred advice tone
"""
                # Increment chat count
                profile_svc.increment_chat_count(user_id)
            except Exception as e:
                logger.warning(f"Failed to get profile context: {e}")
        
        # Initialize model with tools and personalized prompt
        model = genai.GenerativeModel(
            'gemini-2.5-flash',
            tools=FINANCIAL_TOOLS,
            system_instruction=personalized_prompt
        )
        
        # Build conversation history for context
        message_history = data.get('message_history', [])
        history = []
        for msg in message_history:
            if msg.get('role') == 'user':
                history.append(genai.protos.Content(
                    role='user',
                    parts=[genai.protos.Part(text=msg.get('content', ''))]
                ))
            elif msg.get('role') == 'assistant':
                history.append(genai.protos.Content(
                    role='model',
                    parts=[genai.protos.Part(text=msg.get('content', ''))]
                ))
        
        # Start chat with history
        chat = model.start_chat(history=history)
        
        # Send user message
        response = chat.send_message(user_query)
        
        # Track tool calls for debugging
        tool_calls = []
        max_iterations = 10  # Prevent infinite loops
        iteration = 0
        
        # Agentic loop - process tool calls until model is done
        while iteration < max_iterations:
            iteration += 1
            
            # Check if response has function calls
            if not response.candidates or not response.candidates[0].content.parts:
                break
            
            has_function_call = False
            function_responses = []
            
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'function_call') and part.function_call:
                    has_function_call = True
                    fn_call = part.function_call
                    fn_name = fn_call.name
                    fn_args = dict(fn_call.args) if fn_call.args else {}
                    
                    logger.info(f"Agentic tool call: {fn_name}({fn_args})")
                    
                    # Execute the tool
                    result = execute_agentic_tool(fn_name, fn_args)
                    tool_calls.append({
                        "tool": fn_name,
                        "args": fn_args,
                        "result_summary": str(result)[:200]
                    })
                    
                    # Prepare function response
                    function_responses.append(
                        genai.protos.Part(
                            function_response=genai.protos.FunctionResponse(
                                name=fn_name,
                                response={"result": json.dumps(result)}
                            )
                        )
                    )
            
            if not has_function_call:
                # No more function calls, model has final response
                break
            
            # Send function results back to model
            response = chat.send_message(
                genai.protos.Content(parts=function_responses)
            )
        
        # Extract final text response
        final_response = ""
        if response.candidates and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'text') and part.text:
                    final_response += part.text
        
        # Embed conversation to ChromaDB for long-term memory
        if RAG_AVAILABLE and conversation_id:
            try:
                import uuid
                rag_svc = get_rag_service()
                timestamp = datetime.now().isoformat()
                # Embed user message
                embed_conversation_message(
                    rag_svc, conversation_id, 
                    str(uuid.uuid4()), 'user', user_query, timestamp
                )
                # Embed assistant response
                embed_conversation_message(
                    rag_svc, conversation_id,
                    str(uuid.uuid4()), 'assistant', final_response, timestamp
                )
                logger.info(f"Embedded conversation turn to ChromaDB for {conversation_id}")
            except Exception as e:
                logger.warning(f"Failed to embed conversation: {e}")
        
        return jsonify({
            'response': final_response,
            'agentic': True,
            'tool_calls': tool_calls,
            'iterations': iteration
        })
        
    except Exception as e:
        logger.error(f"Agentic chat error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'response': 'I encountered an error processing your request.'
        }), 500


if __name__ == '__main__':
    app.run(debug=True, port=5001)