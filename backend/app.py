from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import google.generativeai as genai
import os
import logging
from dotenv import load_dotenv


# Suppress gRPC ALTS warnings
os.environ['GRPC_VERBOSITY'] = 'ERROR'
os.environ['GRPC_TRACE'] = ''


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


SEARCHAPI_KEY = os.getenv('SEARCH_API_KEY') or os.getenv('SEARCHAPI_KEY') or os.getenv('SEARCH_APIIO_KEY')


# Minimal city-to-IATA mapping for our supported suggestions
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
       return jsonify({'error': str(e)}), 500


@app.route('/get-dashboard-data', methods=['GET'])
def get_dashboard_data():
   try:
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
      
       accounts_url = f"http://api.nessieisreal.com/customers/{customer_id}/accounts?key={nessie_api_key}"
       accounts_response = requests.get(accounts_url)
      
       if accounts_response.status_code != 200:
           return jsonify({'error': f'Failed to fetch accounts: {accounts_response.status_code} - {accounts_response.text}'}), 500
      
       accounts_data = accounts_response.json()
      
       checking_account = None
       for account in accounts_data:
           if account.get('type') == 'Checking':
               checking_account = account
               break
      
       if not checking_account:
           return jsonify({'error': 'No checking account found'}), 404
      
       account_id = checking_account['_id']
      
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
      
       model = genai.GenerativeModel('gemini-2.5-flash')
      
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
      
       response = model.generate_content(prompt)
      
       try:
           import json
          
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


if __name__ == '__main__':
   app.run(debug=True, port=5001)
