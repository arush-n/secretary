"""
RAG Service Module for Financial Advisor

This module provides Retrieval-Augmented Generation (RAG) capabilities
to ground AI responses in actual user financial data.

Uses:
- ChromaDB for local vector storage
- Sentence Transformers for local embeddings (all-MiniLM-L6-v2)
"""

import os
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import json

# ChromaDB and embedding imports
try:
    import chromadb
    from chromadb.config import Settings
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False
    logging.warning("ChromaDB not available. RAG features will be disabled.")

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    logging.warning("Sentence Transformers not available. RAG features will be disabled.")

logger = logging.getLogger(__name__)

# Constants
CHROMA_DB_PATH = os.path.join(os.path.dirname(__file__), "chroma_db")
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# Collection names
TRANSACTIONS_COLLECTION = "transactions"
SPENDING_PATTERNS_COLLECTION = "spending_patterns"
USER_GOALS_COLLECTION = "user_goals"
CONVERSATION_MEMORY_COLLECTION = "conversation_memory"

# Cache for LLM temporal extractions (avoid repeated API calls)
_temporal_cache = {}


# ========== LLM-Enhanced Temporal Parsing ==========

def needs_llm_temporal_parsing(query_lower: str) -> bool:
    """
    Detect if query needs LLM for temporal parsing (complex/ambiguous references).
    
    Returns True for queries that rule-based parsing can't handle well.
    """
    # Phrases that need LLM interpretation
    complex_patterns = [
        'around the holidays', 'holiday season', 'during the holidays',
        'a few', 'a couple', 'several', 'some time',
        'around', 'about', 'approximately',
        'first week of', 'second week of', 'last week of', 'middle of',
        'beginning of', 'end of', 'start of',
        'tax season', 'tax time', 'back to school',
        'summer', 'winter', 'spring', 'fall', 'autumn',
        'before christmas', 'after christmas', 'new year',
        'black friday', 'cyber monday', 'thanksgiving', 'break',
        'right after', 'right before', 'shortly after', 'shortly before'
    ]
    
    return any(pattern in query_lower for pattern in complex_patterns)


def extract_temporal_with_llm(query: str, current_dt: datetime) -> Optional[Dict[str, Any]]:
    """
    Use LLM to extract temporal information from complex queries.
    
    Args:
        query: User's question
        current_dt: Current datetime
    
    Returns:
        Dict with temporal filter or None if no temporal reference
    """
    import google.generativeai as genai
    
    # Check cache first
    cache_key = f"{query.lower().strip()}_{current_dt.strftime('%Y-%m-%d')}"
    if cache_key in _temporal_cache:
        cached_result, cached_time = _temporal_cache[cache_key]
        if (datetime.now() - cached_time).seconds < 3600:  # 1 hour cache
            return cached_result
    
    prompt = f"""You are a temporal reference parser.

CURRENT DATE: {current_dt.strftime('%A, %B %d, %Y')} (Today)

USER QUERY: "{query}"

Extract the date range being referenced. Consider:
- "around the holidays" → December 20 to January 5
- "a few days ago" → 3-5 days before today
- "a couple weeks back" → about 2 weeks ago
- "first week of January" → January 1-7
- "tax season" → April 1-15
- "summer" → June-August
- "black friday" → Friday after US Thanksgiving

Return ONLY valid JSON (no markdown):
{{"start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD"}}

If no temporal reference found:
{{"no_temporal": true}}

JSON response:"""

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        
        # Clean markdown if present
        if response_text.startswith('```'):
            lines = response_text.split('\n')
            response_text = '\n'.join(lines[1:-1])
        
        result = json.loads(response_text)
        
        if result.get('no_temporal'):
            temporal_filter = None
        else:
            temporal_filter = {
                'start_date': result.get('start_date'),
                'end_date': result.get('end_date')
            }
        
        # Cache result
        _temporal_cache[cache_key] = (temporal_filter, datetime.now())
        
        # Clean old cache entries
        if len(_temporal_cache) > 100:
            oldest_keys = sorted(_temporal_cache.keys(), 
                               key=lambda k: _temporal_cache[k][1])[:20]
            for key in oldest_keys:
                del _temporal_cache[key]
        
        return temporal_filter
        
    except Exception as e:
        logger.warning(f"LLM temporal extraction failed: {e}")
        return None


def format_temporal_filter_human(temporal: Dict[str, Any], current_dt: datetime) -> str:
    """Convert temporal filter to human-readable description."""
    if not temporal:
        return "All time"
    
    if 'date' in temporal:
        return f"On {temporal['date']}"
    elif 'month' in temporal and 'year' in temporal:
        from calendar import month_name
        return f"{month_name[temporal['month']]} {temporal['year']}"
    elif 'start_date' in temporal:
        start = temporal['start_date']
        end = temporal.get('end_date')
        if end:
            return f"From {start} to {end}"
        else:
            return f"From {start} onwards"
    
    return str(temporal)


# ========== Conversation Memory Functions ==========

def embed_conversation_message(rag_service, conversation_id: str, message_id: str, 
                               role: str, content: str, timestamp: str) -> bool:
    """
    Embed a conversation message into ChromaDB for semantic search.
    
    Args:
        rag_service: RAGService instance
        conversation_id: ID of the conversation
        message_id: Unique ID for this message
        role: 'user' or 'assistant'
        content: Message content
        timestamp: ISO timestamp
        
    Returns:
        True if successfully embedded
    """
    try:
        if not rag_service or not rag_service.enabled:
            return False
        
        # Create collection if it doesn't exist
        collection = rag_service.chroma_client.get_or_create_collection(
            name=CONVERSATION_MEMORY_COLLECTION,
            embedding_function=rag_service.embedding_function
        )
        
        # Create rich text for embedding
        text = f"{role}: {content}"
        
        # Upsert into collection
        collection.upsert(
            documents=[text],
            metadatas=[{
                'conversation_id': conversation_id,
                'message_id': message_id,
                'role': role,
                'timestamp': timestamp,
                'content_preview': content[:100]
            }],
            ids=[message_id]
        )
        
        logger.info(f"Embedded conversation message {message_id}")
        return True
        
    except Exception as e:
        logger.warning(f"Failed to embed conversation message: {e}")
        return False


def retrieve_conversation_context(rag_service, query: str, 
                                  conversation_id: Optional[str] = None,
                                  n_results: int = 5) -> Dict[str, Any]:
    """
    Retrieve relevant past conversation turns for context.
    
    Args:
        rag_service: RAGService instance
        query: Current user query
        conversation_id: Optional - limit to current conversation
        n_results: Number of results to return
        
    Returns:
        Dict with 'current_conversation' and 'related_conversations' lists
    """
    result = {
        'current_conversation': [],
        'related_conversations': []
    }
    
    try:
        if not rag_service or not rag_service.enabled:
            return result
        
        # Get or create collection
        try:
            collection = rag_service.chroma_client.get_collection(
                name=CONVERSATION_MEMORY_COLLECTION,
                embedding_function=rag_service.embedding_function
            )
        except:
            # Collection doesn't exist yet
            return result
        
        # Search current conversation if specified
        if conversation_id:
            current_results = collection.query(
                query_texts=[query],
                where={'conversation_id': conversation_id},
                n_results=n_results
            )
            
            if current_results['documents'] and current_results['documents'][0]:
                for doc, metadata in zip(current_results['documents'][0], 
                                        current_results['metadatas'][0]):
                    result['current_conversation'].append({
                        'text': doc,
                        'timestamp': metadata.get('timestamp', ''),
                        'role': metadata.get('role', '')
                    })
        
        # Also search all conversations for broader context
        all_results = collection.query(
            query_texts=[query],
            n_results=3
        )
        
        if all_results['documents'] and all_results['documents'][0]:
            for doc, metadata in zip(all_results['documents'][0], 
                                    all_results['metadatas'][0]):
                # Skip if already in current conversation results
                if conversation_id and metadata.get('conversation_id') == conversation_id:
                    continue
                result['related_conversations'].append({
                    'text': doc,
                    'timestamp': metadata.get('timestamp', ''),
                    'role': metadata.get('role', ''),
                    'conversation_id': metadata.get('conversation_id', '')
                })
        
        return result
        
    except Exception as e:
        logger.warning(f"Error retrieving conversation context: {e}")
        return result


def format_time_ago(timestamp_iso: str) -> str:
    """Format timestamp as relative time (e.g., '2 hours ago')"""
    try:
        timestamp = datetime.fromisoformat(timestamp_iso.replace('Z', '+00:00'))
        now = datetime.now(timestamp.tzinfo) if timestamp.tzinfo else datetime.now()
        delta = now - timestamp
        
        if delta.days > 0:
            return f"{delta.days} day{'s' if delta.days != 1 else ''} ago"
        elif delta.seconds >= 3600:
            hours = delta.seconds // 3600
            return f"{hours} hour{'s' if hours != 1 else ''} ago"
        elif delta.seconds >= 60:
            minutes = delta.seconds // 60
            return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
        else:
            return "just now"
    except:
        return timestamp_iso

# ========== Query Classification for Hybrid RAG ==========

def classify_query_unified_llm(query: str, conversation_history: Optional[List[Dict]] = None) -> Dict[str, Any]:
    """
    UNIFIED LLM CLASSIFIER: Replaces rule-based classification with LLM.
    
    Handles BOTH:
    1. Structured operation intent (find_maximum, calculate_total, count, etc.)
    2. Filter extraction (temporal, merchants, categories)
    
    Returns:
        {
            'intent': 'find_maximum' | 'find_minimum' | 'calculate_total' | 
                      'calculate_average' | 'count' | 'find_recent' | 'list' | 'general',
            'requires_structured': True/False,
            'broad_intent': 'financial' | 'knowledge' | 'hybrid' | 'conversational',
            'needs_transaction_data': bool,
            'needs_general_knowledge': bool,
            'filters': {
                'temporal': {...} or None,
                'merchants': [str],
                'categories': [str],
                'limit': int (for find_recent)
            },
            'reasoning': str,
            'entities': {...}
        }
    """
    import google.generativeai as genai
    from datetime import datetime
    
    today = datetime.now()
    
    # Build conversation context
    conv_section = ""
    if conversation_history:
        recent = conversation_history[-3:]
        context_lines = [f"{msg['role']}: {msg['content']}" for msg in recent]
        conv_section = "RECENT CONVERSATION:\n" + "\n".join(context_lines) + "\n\n"
    
    classification_prompt = f"""You are a query classifier for a financial advisor chatbot.
Analyze the user's query and extract structured information.

CURRENT DATE: {today.strftime('%A, %B %d, %Y')} (Today)

{conv_section}USER QUERY: "{query}"

Respond with ONLY a valid JSON object (no markdown):
{{
  "intent": "find_maximum|find_minimum|calculate_total|calculate_average|count|find_recent|list|general",
  "requires_structured": true/false,
  "broad_intent": "financial|knowledge|hybrid|conversational",
  "needs_transaction_data": true/false,
  "needs_general_knowledge": true/false,
  "filters": {{
    "temporal": {{"type": "date|month|range", "value": "..."}},
    "merchants": ["list of merchants mentioned"],
    "categories": ["list of categories: food, groceries, shopping, transport, entertainment, bills, healthcare"],
    "limit": null
  }},
  "reasoning": "brief explanation"
}}

INTENT RULES:
- "find_maximum": biggest, largest, most expensive, highest, maximum purchase
- "find_minimum": smallest, cheapest, lowest, minimum purchase
- "calculate_total": total, sum, how much did I spend, add up
- "calculate_average": average, typically spend, usually spend
- "count": how many, how often, number of, times
- "find_recent": most recent, latest, newest, last N purchases
- "list": show me, list, what did I buy, display
- "general": everything else (advice, questions, chat)

TEMPORAL RULES (use current date {today.strftime('%Y-%m-%d')}):
- "this month" → {{"type": "month", "month": {today.month}, "year": {today.year}}}
- "last month" → {{"type": "month", "month": {(today.month - 1) if today.month > 1 else 12}, "year": {today.year if today.month > 1 else today.year - 1}}}
- "today" → {{"type": "date", "date": "{today.strftime('%Y-%m-%d')}"}}
- "last 7 days" → {{"type": "range", "start_date": "{(today - timedelta(days=7)).strftime('%Y-%m-%d')}"}}
- For complex references like "around the holidays", compute actual date range

BROAD INTENT:
- "financial": needs user's transaction/spending data
- "knowledge": needs general info about businesses, products, concepts
- "hybrid": needs both transaction data AND general knowledge
- "conversational": general chat

JSON response:"""

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(
            classification_prompt,
            generation_config={
                'temperature': 0.1,
                'max_output_tokens': 500
            }
        )
        
        response_text = response.text.strip()
        
        # Clean markdown if present
        if response_text.startswith('```'):
            response_text = response_text.split('```')[1]
            if response_text.startswith('json'):
                response_text = response_text[4:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        
        result = json.loads(response_text.strip())
        
        # Normalize the result
        normalized = {
            'intent': result.get('intent', 'general'),
            'requires_structured': result.get('requires_structured', False),
            'broad_intent': result.get('broad_intent', 'hybrid'),
            'needs_transaction_data': result.get('needs_transaction_data', True),
            'needs_general_knowledge': result.get('needs_general_knowledge', False),
            'filters': {
                'temporal': result.get('filters', {}).get('temporal'),
                'merchants': result.get('filters', {}).get('merchants', []),
                'categories': result.get('filters', {}).get('categories', []),
                'limit': result.get('filters', {}).get('limit')
            },
            'reasoning': result.get('reasoning', ''),
            'entities': result.get('entities', {}),
            'llm_classified': True
        }
        
        # Map structured intents to requires_structured
        structured_intents = ['find_maximum', 'find_minimum', 'calculate_total', 
                             'calculate_average', 'count', 'find_recent']
        if normalized['intent'] in structured_intents:
            normalized['requires_structured'] = True
        
        logger.info(f"LLM Unified Classification: intent={normalized['intent']}, "
                   f"structured={normalized['requires_structured']}, "
                   f"broad={normalized['broad_intent']}")
        
        return normalized
        
    except Exception as e:
        logger.warning(f"LLM unified classification failed, using rule-based fallback: {e}")
        # Fall back to rule-based
        fallback = _classify_financial_query_rule_based(query)
        fallback['broad_intent'] = 'hybrid'
        fallback['needs_transaction_data'] = True
        fallback['needs_general_knowledge'] = True
        fallback['llm_classified'] = False
        return fallback


def _classify_financial_query_rule_based(query: str) -> Dict[str, Any]:
    """
    Classify a financial query to determine if it needs structured data operations
    or semantic search.
    
    Returns:
        {
            'intent': 'find_maximum' | 'find_minimum' | 'calculate_total' | 
                      'calculate_average' | 'count' | 'list' | 'general',
            'requires_structured': True/False,
            'filters': {
                'temporal': {'month': str, 'year': int, 'date': str} or None,
                'merchants': [str] or [],
                'categories': [str] or []
            }
        }
    """
    import re
    query_lower = query.lower()
    
    result = {
        'intent': 'general',
        'requires_structured': False,
        'filters': {
            'temporal': None,
            'merchants': [],
            'categories': []
        }
    }
    
    # ===== INTENT DETECTION =====
    
    # RECENT operations (check first to avoid 'most recent' matching 'most')
    recent_keywords = ['most recent', 'latest', 'newest', 'last purchase', 'recent purchase']
    
    # MAX operations (removed 'most' to avoid conflict with 'most recent')
    max_keywords = ['biggest', 'largest', 'most expensive', 'highest', 'maximum', 'max']
    min_keywords = ['smallest', 'cheapest', 'lowest', 'minimum', 'min', 'least expensive']
    sum_keywords = ['total', 'sum', 'how much did i spend', 'how much have i spent', 
                    'how much spent', 'add up', 'altogether']
    avg_keywords = ['average', 'avg', 'mean', 'typically spend', 'usually spend', 'on average']
    count_keywords = ['how many', 'how often', 'number of', 'count', 'times did i']
    list_keywords = ['show me', 'list', 'what did i buy', 'what were my', 'display']
    
    # Check for recent first (before max to avoid 'most recent' matching 'most')
    if any(kw in query_lower for kw in recent_keywords):
        result['intent'] = 'find_recent'
        result['requires_structured'] = True
        # Try to extract count (e.g., "last 2 purchases", "most recent 5")
        count_match = re.search(r'(\d+)\s*(purchase|transaction|expense|buy)', query_lower)
        if count_match:
            result['filters']['limit'] = int(count_match.group(1))
        else:
            # Also check for "recent N" or "last N"
            count_match2 = re.search(r'(?:recent|last|latest)\s*(\d+)', query_lower)
            if count_match2:
                result['filters']['limit'] = int(count_match2.group(1))
            else:
                result['filters']['limit'] = 5  # Default to 5 recent
    elif any(kw in query_lower for kw in max_keywords):
        result['intent'] = 'find_maximum'
        result['requires_structured'] = True
    elif any(kw in query_lower for kw in min_keywords):
        result['intent'] = 'find_minimum'
        result['requires_structured'] = True
    elif any(kw in query_lower for kw in sum_keywords):
        result['intent'] = 'calculate_total'
        result['requires_structured'] = True
    elif any(kw in query_lower for kw in avg_keywords):
        result['intent'] = 'calculate_average'
        result['requires_structured'] = True
    elif any(kw in query_lower for kw in count_keywords):
        result['intent'] = 'count'
        result['requires_structured'] = True
    elif any(kw in query_lower for kw in list_keywords):
        result['intent'] = 'list'
        result['requires_structured'] = False
    
    # ===== FILTER EXTRACTION =====
    
    today = datetime.now()
    
    # Temporal filters
    month_names = {
        'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
        'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'jun': 6, 'jul': 7,
        'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
    }
    
    # Check for specific month mentions
    for month_name, month_num in month_names.items():
        if month_name in query_lower:
            # Check for year
            year_match = re.search(r'20\d{2}', query)
            year = int(year_match.group()) if year_match else today.year
            result['filters']['temporal'] = {'month': month_num, 'year': year}
            break
    
    # Relative time periods (check in order of specificity)
    if 'this month' in query_lower:
        result['filters']['temporal'] = {'month': today.month, 'year': today.year}
    elif 'last month' in query_lower:
        last_month = today.replace(day=1) - timedelta(days=1)
        result['filters']['temporal'] = {'month': last_month.month, 'year': last_month.year}
    elif 'last week' in query_lower:
        # Previous Monday to Sunday
        start_of_this_week = today - timedelta(days=today.weekday())
        start_of_last_week = start_of_this_week - timedelta(days=7)
        end_of_last_week = start_of_this_week - timedelta(days=1)
        result['filters']['temporal'] = {
            'start_date': start_of_last_week.strftime('%Y-%m-%d'),
            'end_date': end_of_last_week.strftime('%Y-%m-%d')
        }
    elif 'this week' in query_lower:
        start_of_week = today - timedelta(days=today.weekday())
        result['filters']['temporal'] = {'start_date': start_of_week.strftime('%Y-%m-%d')}
    elif 'today' in query_lower:
        result['filters']['temporal'] = {'date': today.strftime('%Y-%m-%d')}
    elif 'yesterday' in query_lower:
        yesterday = today - timedelta(days=1)
        result['filters']['temporal'] = {'date': yesterday.strftime('%Y-%m-%d')}
    elif 'recently' in query_lower or 'recent' in query_lower:
        # Last 7 days
        start_date = (today - timedelta(days=7)).strftime('%Y-%m-%d')
        result['filters']['temporal'] = {'start_date': start_date}
    elif 'this year' in query_lower:
        start_of_year = today.replace(month=1, day=1)
        result['filters']['temporal'] = {'start_date': start_of_year.strftime('%Y-%m-%d')}
    elif 'last year' in query_lower:
        last_year = today.year - 1
        result['filters']['temporal'] = {
            'start_date': f'{last_year}-01-01',
            'end_date': f'{last_year}-12-31'
        }
    
    # "last N days/weeks/months" patterns
    if not result['filters']['temporal']:
        last_n_days = re.search(r'last (\d+) days?', query_lower)
        if last_n_days:
            days = int(last_n_days.group(1))
            start_date = (today - timedelta(days=days)).strftime('%Y-%m-%d')
            result['filters']['temporal'] = {'start_date': start_date}
        
        last_n_weeks = re.search(r'last (\d+) weeks?', query_lower)
        if last_n_weeks:
            weeks = int(last_n_weeks.group(1))
            start_date = (today - timedelta(weeks=weeks)).strftime('%Y-%m-%d')
            result['filters']['temporal'] = {'start_date': start_date}
        
        last_n_months = re.search(r'last (\d+) months?', query_lower)
        if last_n_months:
            months = int(last_n_months.group(1))
            start_date = (today - timedelta(days=months * 30)).strftime('%Y-%m-%d')
            result['filters']['temporal'] = {'start_date': start_date}
    
    # Weekday patterns (on Monday, last Friday, etc.)
    if not result['filters']['temporal']:
        day_names = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        for i, day_name in enumerate(day_names):
            if f'on {day_name}' in query_lower or f'last {day_name}' in query_lower:
                # Find most recent occurrence
                days_ago = (today.weekday() - i) % 7
                if days_ago == 0:
                    days_ago = 7  # Go to last week if it's today
                target_date = (today - timedelta(days=days_ago)).strftime('%Y-%m-%d')
                result['filters']['temporal'] = {'date': target_date}
                break
    
    # Specific date patterns (1/17, 01-17, etc.)
    date_match = re.search(r'(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?', query)
    if date_match and not result['filters']['temporal']:
        month = int(date_match.group(1))
        day = int(date_match.group(2))
        year = int(date_match.group(3)) if date_match.group(3) else today.year
        if year < 100:
            year += 2000
        try:
            date_obj = datetime(year, month, day)
            result['filters']['temporal'] = {'date': date_obj.strftime('%Y-%m-%d')}
        except ValueError:
            pass
    
    # LLM FALLBACK: If no temporal filter found but query has complex patterns, use LLM
    if not result['filters']['temporal'] and needs_llm_temporal_parsing(query_lower):
        llm_temporal = extract_temporal_with_llm(query, today)
        if llm_temporal:
            result['filters']['temporal'] = llm_temporal
            result['filters']['llm_extracted'] = True  # Flag that LLM was used
    
    # Merchant extraction - including category-based merchant groups
    merchant_groups = {
        'coffee shop': ['starbucks', 'dunkin', 'peets', 'coffee', 'cafe', 'espresso'],
        'fast food': ['mcdonalds', 'wendys', 'burger king', 'taco bell', 'chipotle', 'subway'],
        'grocery store': ['whole foods', 'trader joes', 'safeway', 'kroger', 'costco', 'walmart'],
    }
    
    # Check for category-based merchant queries
    for group_name, group_merchants in merchant_groups.items():
        if group_name in query_lower:
            result['filters']['merchants'].extend(group_merchants)
            result['filters']['merchant_category'] = group_name  # Track what was searched
    
    known_merchants = ['starbucks', 'amazon', 'walmart', 'target', 'chipotle', 
                       'mcdonalds', 'apple', 'netflix', 'spotify', 'uber',
                       'dunkin', 'coffee', 'peets', 'whole foods', 'costco']
    
    for merchant in known_merchants:
        if merchant in query_lower and merchant not in result['filters']['merchants']:
            result['filters']['merchants'].append(merchant)
    
    # Category extraction  
    categories = {
        'food': ['food', 'dining', 'restaurant', 'eating out', 'takeout', 'coffee shop', 'cafe'],
        'groceries': ['grocery', 'groceries', 'supermarket'],
        'shopping': ['shopping', 'retail', 'clothes', 'clothing'],
        'transport': ['transport', 'transportation', 'gas', 'uber', 'lyft'],
        'entertainment': ['entertainment', 'movies', 'streaming', 'games'],
        'bills': ['bills', 'utilities', 'electric', 'water', 'internet'],
        'healthcare': ['health', 'medical', 'pharmacy', 'doctor']
    }
    
    for category, keywords in categories.items():
        if any(kw in query_lower for kw in keywords):
            result['filters']['categories'].append(category)
    
    return result


def _needs_llm_classification(query: str, rule_based_result: Dict[str, Any]) -> bool:
    """
    Determine if a query needs LLM classification for better accuracy.
    
    Returns True for complex/ambiguous queries, False for simple queries
    where rule-based is sufficient.
    """
    query_lower = query.lower()
    
    # ALWAYS use LLM for these complex patterns
    complex_patterns = [
        # Ambiguous/contextual queries
        'should i', 'is it worth', 'do you think', 'would you recommend',
        'compare', 'better', 'worth it', 'good idea',
        # Questions needing world knowledge
        'what is', 'what are', 'how do', 'explain', 'tell me about',
        # Vague references
        'it', 'they', 'that', 'this', 'those',
        # Complex temporal references (already handled by needs_llm_temporal_parsing)
        'around the holidays', 'holiday season', 'tax season', 'summer', 'winter',
        # Advisory/opinion queries
        'advice', 'suggest', 'recommend', 'help me', 'tips',
        # Multi-part queries
        ' and ', ' or ', ' but ', ' versus ', ' vs '
    ]
    
    if any(pattern in query_lower for pattern in complex_patterns):
        return True
    
    # Use LLM if rule-based couldn't determine a clear intent
    if rule_based_result.get('intent') == 'general':
        # Check if it's truly general or just unrecognized
        has_financial_keywords = any(kw in query_lower for kw in [
            'spend', 'spent', 'cost', 'pay', 'paid', 'buy', 'bought',
            'expense', 'income', 'budget', 'money', 'dollar', '$',
            'transaction', 'purchase', 'bill', 'subscription'
        ])
        if has_financial_keywords:
            return True  # Has financial context but unclear intent
    
    # Use LLM for questions (likely need more nuanced understanding)
    if '?' in query and len(query.split()) > 5:
        return True
    
    # Rule-based is sufficient for clear, simple queries
    return False


def _expand_merchant_groups(query: str, result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Expand merchant category terms to actual merchant names.
    
    Example: "coffee shop" → ['starbucks', 'dunkin', 'peets', 'coffee', 'cafe', 'espresso']
    
    This ensures queries like "What coffee shops have I bought from" find Starbucks transactions.
    """
    query_lower = query.lower()
    
    # Merchant group mappings
    merchant_groups = {
        'coffee shop': ['starbucks', 'dunkin', 'peets', 'coffee', 'cafe', 'espresso', 'dutch bros'],
        'coffee shops': ['starbucks', 'dunkin', 'peets', 'coffee', 'cafe', 'espresso', 'dutch bros'],
        'fast food': ['mcdonalds', 'wendys', 'burger king', 'taco bell', 'chipotle', 'subway', 'chick-fil-a'],
        'grocery store': ['whole foods', 'trader joes', 'safeway', 'kroger', 'costco', 'walmart', 'target'],
        'grocery stores': ['whole foods', 'trader joes', 'safeway', 'kroger', 'costco', 'walmart', 'target'],
        'streaming': ['netflix', 'spotify', 'hulu', 'disney', 'hbo', 'apple tv', 'amazon prime'],
        'ride share': ['uber', 'lyft'],
    }
    
    # Ensure filters dict exists
    if 'filters' not in result:
        result['filters'] = {}
    if 'merchants' not in result['filters']:
        result['filters']['merchants'] = []
    
    # Expand any matching merchant groups
    for group_name, group_merchants in merchant_groups.items():
        if group_name in query_lower:
            # Add merchants from this group
            for merchant in group_merchants:
                if merchant not in result['filters']['merchants']:
                    result['filters']['merchants'].append(merchant)
            result['filters']['merchant_category'] = group_name
            logger.info(f"Expanded '{group_name}' to merchants: {group_merchants}")
    
    return result



def classify_financial_query(query: str, conversation_history: Optional[List[Dict]] = None, 
                             use_llm: bool = True, mode: str = 'hybrid') -> Dict[str, Any]:
    """
    Hybrid query classifier. Intelligently chooses between rule-based and LLM.
    
    Modes:
        'hybrid' (default): Use rule-based first, escalate to LLM for complex queries
        'llm_only': Always use LLM (slower but most accurate)
        'rule_based_only': Always use rule-based (fastest but limited)
    
    Args:
        query: User's query string
        conversation_history: Optional conversation context
        use_llm: Legacy param (ignored if mode is set)
        mode: 'hybrid', 'llm_only', or 'rule_based_only'
    
    Returns:
        Classification result with intent, filters, and context needs
    """
    
    # Mode: rule_based_only - fast path
    if mode == 'rule_based_only' or not use_llm:
        result = _classify_financial_query_rule_based(query)
        result['broad_intent'] = 'financial' if result['requires_structured'] else 'hybrid'
        result['needs_transaction_data'] = True
        result['needs_general_knowledge'] = False
        result['llm_classified'] = False
        result['classification_mode'] = 'rule_based'
        result = _expand_merchant_groups(query, result)  # Apply merchant expansion
        return result
    
    # Mode: llm_only - most accurate but slower
    if mode == 'llm_only':
        result = classify_query_unified_llm(query, conversation_history)
        result['classification_mode'] = 'llm'
        result = _expand_merchant_groups(query, result)  # Apply merchant expansion
        return result
    
    # Mode: hybrid (default) - best of both worlds
    # Step 1: Try rule-based first (fast)
    rule_result = _classify_financial_query_rule_based(query)
    
    # Step 2: Check if we need LLM for this query
    if _needs_llm_classification(query, rule_result):
        # Complex query - use LLM for accuracy
        llm_result = classify_query_unified_llm(query, conversation_history)
        llm_result['classification_mode'] = 'hybrid_llm'
        llm_result['rule_based_intent'] = rule_result.get('intent')  # For debugging
        llm_result = _expand_merchant_groups(query, llm_result)  # Apply merchant expansion
        return llm_result
    else:
        # Simple query - rule-based is sufficient
        rule_result['broad_intent'] = 'financial' if rule_result['requires_structured'] else 'hybrid'
        rule_result['needs_transaction_data'] = True
        rule_result['needs_general_knowledge'] = False
        rule_result['llm_classified'] = False
        rule_result['classification_mode'] = 'hybrid_rule_based'
        rule_result = _expand_merchant_groups(query, rule_result)  # Apply merchant expansion
        return rule_result


class RAGService:
    """
    RAG Service for financial advisor grounding.
    
    Provides embedding, storage, and retrieval capabilities for:
    - Transactions
    - Spending patterns
    - User goals/budgets
    """
    
    def __init__(self):
        self.enabled = CHROMADB_AVAILABLE and SENTENCE_TRANSFORMERS_AVAILABLE
        self.client = None
        self.embedding_model = None
        self.collections = {}
        
        if self.enabled:
            self._initialize()
    
    def _initialize(self):
        """Initialize ChromaDB and embedding model."""
        try:
            # Create persistent ChromaDB client
            os.makedirs(CHROMA_DB_PATH, exist_ok=True)
            self.client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
            
            # Load embedding model
            logger.info(f"Loading embedding model: {EMBEDDING_MODEL}")
            self.embedding_model = SentenceTransformer(EMBEDDING_MODEL)
            
            # Initialize collections
            self.collections[TRANSACTIONS_COLLECTION] = self.client.get_or_create_collection(
                name=TRANSACTIONS_COLLECTION,
                metadata={"description": "User financial transactions"}
            )
            
            self.collections[SPENDING_PATTERNS_COLLECTION] = self.client.get_or_create_collection(
                name=SPENDING_PATTERNS_COLLECTION,
                metadata={"description": "Aggregated spending patterns"}
            )
            
            self.collections[USER_GOALS_COLLECTION] = self.client.get_or_create_collection(
                name=USER_GOALS_COLLECTION,
                metadata={"description": "User financial goals and budgets"}
            )
            
            logger.info("RAG Service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize RAG Service: {e}")
            self.enabled = False
    
    def _generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for text using Sentence Transformers."""
        if not self.enabled or not self.embedding_model:
            return []
        return self.embedding_model.encode(text).tolist()
    
    def _generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts."""
        if not self.enabled or not self.embedding_model:
            return []
        return self.embedding_model.encode(texts).tolist()
    
    # ========== Transaction Embedding ==========
    
    def embed_transaction(self, transaction: Dict[str, Any]) -> bool:
        """
        Embed a single transaction.
        
        Format: "{merchant} purchase for ${amount} on {date}, category: {category}"
        """
        if not self.enabled:
            return False
        
        try:
            trans_id = transaction.get('_id') or transaction.get('id') or transaction.get('transaction_id')
            if not trans_id:
                return False
            
            # Build text representation
            merchant = transaction.get('description') or transaction.get('merchant_name') or transaction.get('name') or 'Unknown'
            amount = abs(float(transaction.get('amount', 0)))
            date = transaction.get('purchase_date') or transaction.get('date') or ''
            category = transaction.get('category', 'Uncategorized')
            if isinstance(category, list):
                category = ', '.join(category) if category else 'Uncategorized'
            
            text = f"{merchant} purchase for ${amount:.2f} on {date}, category: {category}"
            
            # Generate embedding
            embedding = self._generate_embedding(text)
            
            # Store in ChromaDB
            self.collections[TRANSACTIONS_COLLECTION].upsert(
                ids=[str(trans_id)],
                embeddings=[embedding],
                documents=[text],
                metadatas=[{
                    "merchant": merchant,
                    "amount": amount,
                    "date": date,
                    "category": str(category),
                    "type": "expense" if transaction.get('amount', 0) > 0 else "income"
                }]
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error embedding transaction: {e}")
            return False
    
    def embed_transactions_batch(self, transactions: List[Dict[str, Any]]) -> int:
        """
        Embed multiple transactions in batch (more efficient).
        Returns count of successfully embedded transactions.
        """
        if not self.enabled or not transactions:
            return 0
        
        try:
            ids = []
            texts = []
            metadatas = []
            
            for transaction in transactions:
                trans_id = transaction.get('_id') or transaction.get('id') or transaction.get('transaction_id')
                if not trans_id:
                    continue
                
                merchant = transaction.get('description') or transaction.get('merchant_name') or transaction.get('name') or 'Unknown'
                amount = abs(float(transaction.get('amount', 0)))
                date = transaction.get('purchase_date') or transaction.get('date') or ''
                category = transaction.get('category', 'Uncategorized')
                if isinstance(category, list):
                    category = ', '.join(category) if category else 'Uncategorized'
                
                text = f"{merchant} purchase for ${amount:.2f} on {date}, category: {category}"
                
                ids.append(str(trans_id))
                texts.append(text)
                metadatas.append({
                    "merchant": merchant,
                    "amount": amount,
                    "date": date,
                    "category": str(category),
                    "type": "expense" if transaction.get('amount', 0) > 0 else "income"
                })
            
            if not ids:
                return 0
            
            # Generate embeddings in batch
            embeddings = self._generate_embeddings_batch(texts)
            
            # ChromaDB has batch size limit (~166), so chunk the data
            BATCH_SIZE = 100
            total_embedded = 0
            
            for i in range(0, len(ids), BATCH_SIZE):
                batch_ids = ids[i:i+BATCH_SIZE]
                batch_embeddings = embeddings[i:i+BATCH_SIZE]
                batch_texts = texts[i:i+BATCH_SIZE]
                batch_metadatas = metadatas[i:i+BATCH_SIZE]
                
                self.collections[TRANSACTIONS_COLLECTION].upsert(
                    ids=batch_ids,
                    embeddings=batch_embeddings,
                    documents=batch_texts,
                    metadatas=batch_metadatas
                )
                total_embedded += len(batch_ids)
            
            logger.info(f"Embedded {total_embedded} transactions")
            return total_embedded
            
        except Exception as e:
            logger.error(f"Error batch embedding transactions: {e}")
            return 0
    
    # ========== Spending Pattern Embedding ==========
    
    def embed_spending_pattern(self, pattern: Dict[str, Any]) -> bool:
        """
        Embed a spending pattern.
        
        Format: "Spent ${total} on {category} in {month}, {variance}% vs budget"
        """
        if not self.enabled:
            return False
        
        try:
            pattern_id = pattern.get('id') or f"{pattern.get('category', 'unknown')}_{pattern.get('period', 'unknown')}"
            
            category = pattern.get('category', 'General')
            total = float(pattern.get('total', 0))
            period = pattern.get('period', 'this month')
            variance = pattern.get('variance_percent', 0)
            budget = pattern.get('budget', 0)
            
            variance_text = f"{variance:+.1f}% vs budget" if budget else "no budget set"
            text = f"Spent ${total:.2f} on {category} in {period}, {variance_text}"
            
            embedding = self._generate_embedding(text)
            
            self.collections[SPENDING_PATTERNS_COLLECTION].upsert(
                ids=[str(pattern_id)],
                embeddings=[embedding],
                documents=[text],
                metadatas=[{
                    "category": category,
                    "total": total,
                    "period": period,
                    "variance_percent": variance,
                    "budget": budget
                }]
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error embedding spending pattern: {e}")
            return False
    
    # ========== User Goal Embedding ==========
    
    def embed_user_goal(self, goal: Dict[str, Any]) -> bool:
        """
        Embed a user goal/budget.
        
        Format: "Save ${amount} for {purpose} by {date}"
        """
        if not self.enabled:
            return False
        
        try:
            goal_id = goal.get('id') or goal.get('purpose', 'unknown')
            
            amount = float(goal.get('amount', 0))
            purpose = goal.get('purpose', 'savings')
            target_date = goal.get('target_date', 'no deadline')
            current_progress = goal.get('current_progress', 0)
            
            text = f"Goal: Save ${amount:.2f} for {purpose} by {target_date}. Current progress: ${current_progress:.2f}"
            
            embedding = self._generate_embedding(text)
            
            self.collections[USER_GOALS_COLLECTION].upsert(
                ids=[str(goal_id)],
                embeddings=[embedding],
                documents=[text],
                metadatas=[{
                    "amount": amount,
                    "purpose": purpose,
                    "target_date": target_date,
                    "current_progress": current_progress
                }]
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error embedding user goal: {e}")
            return False
    
    # ========== Query Classification ==========
    
    def classify_query(self, query: str) -> List[str]:
        """
        Classify query to determine which collections to search.
        
        Returns list of collection names to search.
        """
        query_lower = query.lower()
        collections_to_search = []
        
        # Spending/transaction keywords
        spending_keywords = ['spend', 'spent', 'purchase', 'bought', 'paid', 'cost', 
                            'transaction', 'merchant', 'dining', 'grocery', 'shopping']
        
        # Budget/goal keywords
        budget_keywords = ['budget', 'goal', 'save', 'saving', 'target', 'limit', 
                          'afford', 'plan', 'reduce']
        
        # Trend/pattern keywords
        trend_keywords = ['trend', 'pattern', 'average', 'monthly', 'weekly', 
                         'compare', 'vs', 'versus', 'increase', 'decrease']
        
        # Check for matches
        if any(kw in query_lower for kw in spending_keywords):
            collections_to_search.append(TRANSACTIONS_COLLECTION)
        
        if any(kw in query_lower for kw in budget_keywords):
            collections_to_search.append(USER_GOALS_COLLECTION)
            collections_to_search.append(SPENDING_PATTERNS_COLLECTION)
        
        if any(kw in query_lower for kw in trend_keywords):
            collections_to_search.append(SPENDING_PATTERNS_COLLECTION)
        
        # Default: search all if no specific matches
        if not collections_to_search:
            collections_to_search = [TRANSACTIONS_COLLECTION, SPENDING_PATTERNS_COLLECTION, USER_GOALS_COLLECTION]
        
        return list(set(collections_to_search))
    
    # ========== Temporal Filtering ==========
    
    def _get_date_filter(self, query: str) -> Optional[Dict[str, str]]:
        """
        Extract date filter from query.
        
        Returns dict with 'start_date' and optionally 'end_date'.
        """
        import re
        query_lower = query.lower()
        today = datetime.now()
        
        if 'this month' in query_lower:
            start_date = today.replace(day=1).strftime('%Y-%m-%d')
            return {"start_date": start_date}
        
        if 'last month' in query_lower:
            first_of_this_month = today.replace(day=1)
            last_month = first_of_this_month - timedelta(days=1)
            start_date = last_month.replace(day=1).strftime('%Y-%m-%d')
            end_date = last_month.strftime('%Y-%m-%d')
            return {"start_date": start_date, "end_date": end_date}
        
        if 'last 3 months' in query_lower or 'past 3 months' in query_lower:
            start_date = (today - timedelta(days=90)).strftime('%Y-%m-%d')
            return {"start_date": start_date}
        
        if 'this week' in query_lower:
            start_of_week = today - timedelta(days=today.weekday())
            return {"start_date": start_of_week.strftime('%Y-%m-%d')}
        
        if 'today' in query_lower:
            return {"start_date": today.strftime('%Y-%m-%d')}
        
        if 'yesterday' in query_lower:
            yesterday = today - timedelta(days=1)
            return {"start_date": yesterday.strftime('%Y-%m-%d')}
        
        # Try to parse specific dates like "January 17", "1/17", "01-17-2026"
        month_names = {
            'january': 1, 'february': 2, 'march': 3, 'april': 4,
            'may': 5, 'june': 6, 'july': 7, 'august': 8,
            'september': 9, 'october': 10, 'november': 11, 'december': 12,
            'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'jun': 6,
            'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
        }
        
        # Pattern: "January 17" or "Jan 17" (with optional year, ordinal suffix)
        for month_name, month_num in month_names.items():
            pattern = rf'{month_name}\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{{4}}))?'
            match = re.search(pattern, query_lower)
            if match:
                day = int(match.group(1))
                year = int(match.group(2)) if match.group(2) else today.year
                try:
                    date = datetime(year, month_num, day)
                    return {"start_date": date.strftime('%Y-%m-%d')}
                except ValueError:
                    pass
        
        # Pattern: "1/17" or "01/17" (assume current year)
        match = re.search(r'(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?', query)
        if match:
            month = int(match.group(1))
            day = int(match.group(2))
            year = int(match.group(3)) if match.group(3) else today.year
            if year < 100:
                year += 2000  # Convert 26 to 2026
            try:
                date = datetime(year, month, day)
                return {"start_date": date.strftime('%Y-%m-%d')}
            except ValueError:
                pass
        
        return None
    
    # ========== Context Retrieval ==========
    
    def retrieve_context(self, query: str, top_k: int = 10) -> Dict[str, Any]:
        """
        Retrieve relevant context for a user query.
        
        Returns dict with:
        - transactions: list of relevant transactions
        - spending_patterns: list of relevant patterns
        - user_goals: list of relevant goals
        """
        if not self.enabled:
            return {"transactions": [], "spending_patterns": [], "user_goals": []}
        
        try:
            # Classify query to determine collections
            collections_to_search = self.classify_query(query)
            
            # Get date filter if applicable
            date_filter = self._get_date_filter(query)
            
            # Generate query embedding
            query_embedding = self._generate_embedding(query)
            
            context = {
                "transactions": [],
                "spending_patterns": [],
                "user_goals": []
            }
            
            # Search transactions
            if TRANSACTIONS_COLLECTION in collections_to_search:
                where_filter = None
                if date_filter:
                    # ChromaDB $eq works with strings, $gte needs numbers
                    where_filter = {"date": {"$eq": date_filter.get("start_date", "")}}
                
                try:
                    results = self.collections[TRANSACTIONS_COLLECTION].query(
                        query_embeddings=[query_embedding],
                        n_results=min(top_k, 15),
                        where=where_filter if where_filter else None
                    )
                    
                    if results and results.get('documents'):
                        for i, doc in enumerate(results['documents'][0]):
                            metadata = results['metadatas'][0][i] if results.get('metadatas') else {}
                            context["transactions"].append({
                                "text": doc,
                                "metadata": metadata
                            })
                except Exception as e:
                    # Retry without filter if it fails
                    logger.warning(f"Query with filter failed, retrying without: {e}")
                    results = self.collections[TRANSACTIONS_COLLECTION].query(
                        query_embeddings=[query_embedding],
                        n_results=min(top_k, 15)
                    )
                    if results and results.get('documents'):
                        for i, doc in enumerate(results['documents'][0]):
                            metadata = results['metadatas'][0][i] if results.get('metadatas') else {}
                            context["transactions"].append({
                                "text": doc,
                                "metadata": metadata
                            })
            
            # Search spending patterns
            if SPENDING_PATTERNS_COLLECTION in collections_to_search:
                results = self.collections[SPENDING_PATTERNS_COLLECTION].query(
                    query_embeddings=[query_embedding],
                    n_results=min(top_k, 5)
                )
                
                if results and results.get('documents'):
                    for i, doc in enumerate(results['documents'][0]):
                        metadata = results['metadatas'][0][i] if results.get('metadatas') else {}
                        context["spending_patterns"].append({
                            "text": doc,
                            "metadata": metadata
                        })
            
            # Search user goals
            if USER_GOALS_COLLECTION in collections_to_search:
                results = self.collections[USER_GOALS_COLLECTION].query(
                    query_embeddings=[query_embedding],
                    n_results=min(top_k, 5)
                )
                
                if results and results.get('documents'):
                    for i, doc in enumerate(results['documents'][0]):
                        metadata = results['metadatas'][0][i] if results.get('metadatas') else {}
                        context["user_goals"].append({
                            "text": doc,
                            "metadata": metadata
                        })
            
            return context
            
        except Exception as e:
            logger.error(f"Error retrieving context: {e}")
            return {"transactions": [], "spending_patterns": [], "user_goals": []}
    
    # ========== Prompt Building ==========
    
    def build_grounded_prompt(self, query: str, context: Dict[str, Any]) -> str:
        """
        Build a grounded prompt with retrieved context.
        
        Returns prompt string to send to Gemini.
        """
        # Format transaction context
        transactions_text = ""
        if context.get("transactions"):
            transactions_text = "RECENT TRANSACTIONS:\n"
            for i, t in enumerate(context["transactions"][:10], 1):
                transactions_text += f"  {i}. {t['text']}\n"
        else:
            transactions_text = "RECENT TRANSACTIONS: No relevant transactions found.\n"
        
        # Format spending patterns context
        patterns_text = ""
        if context.get("spending_patterns"):
            patterns_text = "\nSPENDING PATTERNS:\n"
            for i, p in enumerate(context["spending_patterns"][:5], 1):
                patterns_text += f"  {i}. {p['text']}\n"
        
        # Format user goals context
        goals_text = ""
        if context.get("user_goals"):
            goals_text = "\nUSER FINANCIAL GOALS:\n"
            for i, g in enumerate(context["user_goals"][:3], 1):
                goals_text += f"  {i}. {g['text']}\n"
        
        # Build the grounded prompt
        prompt = f"""You are a helpful financial advisor. Base your answers ONLY on the user's actual financial data provided below. 

IMPORTANT INSTRUCTIONS:
- Only reference specific transactions, amounts, and merchants from the data below
- If the context doesn't contain enough information to answer the question, say so honestly
- Do not make up or hallucinate any financial data
- Cite specific amounts, dates, and merchants when giving advice

{transactions_text}
{patterns_text}
{goals_text}

USER QUESTION: {query}

Provide accurate, helpful financial advice using ONLY the context above. If you need more data to give a complete answer, let the user know."""

        return prompt
    
    # ========== Utility Methods ==========
    
    def get_collection_stats(self) -> Dict[str, int]:
        """Get count of documents in each collection."""
        if not self.enabled:
            return {}
        
        stats = {}
        for name, collection in self.collections.items():
            try:
                stats[name] = collection.count()
            except:
                stats[name] = 0
        
        return stats
    
    def clear_collection(self, collection_name: str) -> bool:
        """Clear all documents from a collection."""
        if not self.enabled or collection_name not in self.collections:
            return False
        
        try:
            # Get all IDs and delete
            collection = self.collections[collection_name]
            results = collection.get()
            if results and results.get('ids'):
                collection.delete(ids=results['ids'])
            return True
        except Exception as e:
            logger.error(f"Error clearing collection {collection_name}: {e}")
            return False


# ========== LLM-Enhanced Query Intent Classification ==========

def classify_query_intent_with_llm(query, conversation_history=None):
    """
    Use LLM to classify query intent and determine required context
    
    Returns:
        dict: {
            'intent': str,  # 'financial', 'knowledge', 'hybrid', 'conversational'
            'needs_transaction_data': bool,
            'needs_general_knowledge': bool,
            'needs_real_world_context': bool,
            'reasoning': str,
            'entities': dict  # merchants, categories, time periods mentioned
        }
    """
    import google.generativeai as genai
    
    # Build conversation context if available
    context_str = ""
    if conversation_history:
        recent = conversation_history[-3:]
        context_str = "\n".join([f"{msg['role']}: {msg['content']}" for msg in recent])
    
    # Build conversation context section (avoiding backslash in f-string)
    conv_section = ""
    if context_str:
        conv_section = "RECENT CONVERSATION:\n" + context_str + "\n"
    
    classification_prompt = f"""You are a query analyzer for a financial advisor chatbot. 
Analyze the user's query and determine what information is needed to answer it.

{conv_section}USER QUERY: "{query}"

Analyze this query and respond with ONLY a JSON object (no markdown, no explanation):
{{
  "intent": "financial" | "knowledge" | "hybrid" | "conversational",
  "needs_transaction_data": true/false,
  "needs_general_knowledge": true/false,
  "needs_real_world_context": true/false,
  "reasoning": "brief explanation of why",
  "entities": {{
    "merchants": ["list of mentioned merchants"],
    "categories": ["list of spending categories"],
    "time_period": "if mentioned",
    "topics": ["general topics mentioned"]
  }}
}}

INTENT DEFINITIONS:
- "financial": Needs user's personal transaction/spending data
- "knowledge": Needs general information about businesses, products, concepts
- "hybrid": Needs both transaction data AND general knowledge
- "conversational": General chat, doesn't need specific data

EXAMPLES:

Query: "How much did I spend at Starbucks?"
Response: {{"intent": "financial", "needs_transaction_data": true, "needs_general_knowledge": false, "needs_real_world_context": false, "reasoning": "Direct question about user's spending", "entities": {{"merchants": ["Starbucks"], "categories": [], "time_period": null, "topics": []}}}}

Query: "What does Starbucks sell?"
Response: {{"intent": "knowledge", "needs_transaction_data": false, "needs_general_knowledge": true, "needs_real_world_context": false, "reasoning": "General question about Starbucks products", "entities": {{"merchants": ["Starbucks"], "categories": [], "time_period": null, "topics": ["products", "menu"]}}}}

Query: "Should I eat at Chipotle or make food at home?"
Response: {{"intent": "hybrid", "needs_transaction_data": true, "needs_general_knowledge": true, "needs_real_world_context": true, "reasoning": "Advisory question needs Chipotle info plus user's spending patterns and budget", "entities": {{"merchants": ["Chipotle"], "categories": ["dining", "groceries"], "time_period": null, "topics": ["cost comparison", "budget advice"]}}}}

Query: "What's a good way to budget?"
Response: {{"intent": "knowledge", "needs_transaction_data": false, "needs_general_knowledge": true, "needs_real_world_context": false, "reasoning": "General financial advice question", "entities": {{"merchants": [], "categories": [], "time_period": null, "topics": ["budgeting", "personal finance"]}}}}

Query: "Is it worth it?"
Response: {{"intent": "conversational", "needs_transaction_data": false, "needs_general_knowledge": false, "needs_real_world_context": true, "reasoning": "Ambiguous - needs conversation context to understand what 'it' refers to", "entities": {{"merchants": [], "categories": [], "time_period": null, "topics": []}}}}

Now analyze the user's query above."""

    try:
        # Call Gemini for classification
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(
            classification_prompt,
            generation_config={
                'temperature': 0.1,  # Low temperature for consistent classification
                'max_output_tokens': 300
            }
        )
        
        # Parse JSON response
        response_text = response.text.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith('```'):
            response_text = response_text.split('```')[1]
            if response_text.startswith('json'):
                response_text = response_text[4:]
        
        # Parse JSON
        classification = json.loads(response_text)
        
        return classification
        
    except Exception as e:
        logger.warning(f"LLM classification failed: {e}")
        # Fallback to simple heuristic
        return {
            'intent': 'hybrid',
            'needs_transaction_data': True,
            'needs_general_knowledge': True,
            'needs_real_world_context': True,
            'reasoning': 'Fallback - using all available context',
            'entities': {'merchants': [], 'categories': [], 'time_period': None, 'topics': []}
        }


# Global RAG service instance
rag_service = None

def get_rag_service() -> RAGService:
    """Get or create the global RAG service instance."""
    global rag_service
    if rag_service is None:
        rag_service = RAGService()
    return rag_service
