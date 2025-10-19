import google.generativeai as genai
import os
from datetime import datetime
import json

class StockAdvisor:
    def __init__(self):
        self.model = genai.GenerativeModel('gemini-2.0-flash-exp')
        self.advisors = {
            'warren_buffett': {
                'name': 'warren buffett',
                'personality': 'value investor focused on long-term wealth building and companies with strong moats',
                'approach': 'seeks wonderful companies at fair prices with strong competitive advantages',
                'risk_tolerance': 'conservative',
                'focus': 'fundamental analysis, financial strength, management quality'
            },
            'peter_lynch': {
                'name': 'peter lynch',
                'personality': 'growth investor who believes in thorough research and understanding businesses',
                'approach': 'invest in what you know, look for growth companies with strong earnings',
                'risk_tolerance': 'moderate',
                'focus': 'earnings growth, market position, consumer trends'
            },
            'cathie_wood': {
                'name': 'cathie wood',
                'personality': 'innovation-focused investor specializing in disruptive technologies',
                'approach': 'identifies exponential growth opportunities in emerging technologies',
                'risk_tolerance': 'aggressive',
                'focus': 'technological disruption, innovation cycles, future trends'
            }
        }
    
    def analyze_stock(self, stock_symbol, advisor_id, user_context=None):
        """Analyze a stock from the perspective of a specific financial advisor"""
        try:
            advisor = self.advisors.get(advisor_id)
            if not advisor:
                return {'error': 'advisor not found'}
            
            context = user_context or {}
            risk_tolerance = context.get('risk_tolerance', 'moderate')
            investment_timeline = context.get('timeline', '5-10 years')
            portfolio_size = context.get('portfolio_size', 'moderate')
            
            prompt = f"""
You are {advisor['name']}, a legendary financial advisor. Analyze the stock {stock_symbol} from your unique perspective.

Your investment philosophy:
- Personality: {advisor['personality']}
- Approach: {advisor['approach']}
- Risk tolerance: {advisor['risk_tolerance']}
- Focus areas: {advisor['focus']}

User context:
- Risk tolerance: {risk_tolerance}
- Investment timeline: {investment_timeline}
- Portfolio size: {portfolio_size}

Provide analysis in this JSON format:
{{
  "advisor": "{advisor['name']}",
  "stock_symbol": "{stock_symbol}",
  "bullish_case": {{
    "summary": "2-3 sentence bullish summary",
    "key_points": ["point 1", "point 2", "point 3"],
    "confidence_level": "high/medium/low"
  }},
  "bearish_case": {{
    "summary": "2-3 sentence bearish summary", 
    "key_points": ["point 1", "point 2", "point 3"],
    "confidence_level": "high/medium/low"
  }},
  "recommendation": {{
    "action": "buy/hold/sell/avoid",
    "reasoning": "2-3 sentence explanation",
    "price_target_outlook": "bullish/neutral/bearish",
    "time_horizon": "short/medium/long term"
  }},
  "risk_assessment": {{
    "overall_risk": "low/medium/high",
    "key_risks": ["risk 1", "risk 2", "risk 3"],
    "suitable_for_user": true/false
  }}
}}

Base your analysis on your known investment philosophy and general market knowledge. Keep responses authentic to your investing style.
"""
            
            response = self.model.generate_content(prompt)
            
            # Clean and parse response
            response_text = response.text.strip()
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.startswith('```'):
                response_text = response_text[3:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            
            response_text = response_text.strip()
            analysis = json.loads(response_text)
            
            # Add metadata
            analysis['timestamp'] = datetime.now().isoformat()
            analysis['advisor_info'] = advisor
            
            return analysis
            
        except json.JSONDecodeError as e:
            return {
                'error': 'failed to parse ai response',
                'advisor': advisor['name'],
                'stock_symbol': stock_symbol,
                'fallback_message': f'analysis temporarily unavailable for {stock_symbol}. please try again.'
            }
        except Exception as e:
            return {
                'error': str(e),
                'advisor': advisor['name'],
                'stock_symbol': stock_symbol
            }
    
    def get_market_outlook(self, advisor_id, market_context=None):
        """Get general market outlook from advisor perspective"""
        try:
            advisor = self.advisors.get(advisor_id)
            if not advisor:
                return {'error': 'advisor not found'}
            
            context = market_context or {}
            current_conditions = context.get('conditions', 'mixed market conditions')
            
            prompt = f"""
You are {advisor['name']}. Provide your current market outlook and investment strategy.

Your philosophy: {advisor['approach']}
Current market: {current_conditions}

Return JSON:
{{
  "advisor": "{advisor['name']}",
  "market_outlook": {{
    "sentiment": "bullish/neutral/bearish",
    "summary": "3-4 sentence market view",
    "key_themes": ["theme 1", "theme 2", "theme 3"]
  }},
  "strategy_focus": {{
    "recommended_sectors": ["sector 1", "sector 2"],
    "avoid_sectors": ["sector 1", "sector 2"],
    "investment_approach": "2-3 sentence strategy"
  }},
  "advice": "2-3 sentences of actionable advice for current market"
}}
"""
            
            response = self.model.generate_content(prompt)
            
            # Clean and parse response
            response_text = response.text.strip()
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.startswith('```'):
                response_text = response_text[3:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            
            response_text = response_text.strip()
            outlook = json.loads(response_text)
            
            outlook['timestamp'] = datetime.now().isoformat()
            outlook['advisor_info'] = advisor
            
            return outlook
            
        except Exception as e:
            return {
                'error': str(e),
                'advisor': advisor['name']
            }
    
    def compare_stocks(self, stock_symbols, advisor_id, comparison_criteria=None):
        """Compare multiple stocks from advisor perspective"""
        try:
            advisor = self.advisors.get(advisor_id)
            if not advisor:
                return {'error': 'advisor not found'}
            
            criteria = comparison_criteria or ['growth potential', 'value', 'risk level']
            stocks_str = ', '.join(stock_symbols)
            
            prompt = f"""
You are {advisor['name']}. Compare these stocks: {stocks_str}

Your investment style: {advisor['approach']}
Comparison criteria: {', '.join(criteria)}

Return JSON:
{{
  "advisor": "{advisor['name']}",
  "stocks_compared": ["{stock_symbols[0]}", "{stock_symbols[1] if len(stock_symbols) > 1 else ''}", "{stock_symbols[2] if len(stock_symbols) > 2 else ''}"],
  "comparison": {{
    "winner": "stock symbol of top pick",
    "ranking_reasoning": "2-3 sentences explaining ranking",
    "individual_analysis": {{
      "{stock_symbols[0]}": {{"pros": ["pro 1", "pro 2"], "cons": ["con 1", "con 2"], "rating": "1-10"}},
      "{stock_symbols[1] if len(stock_symbols) > 1 else 'N/A'}": {{"pros": ["pro 1", "pro 2"], "cons": ["con 1", "con 2"], "rating": "1-10"}}
    }}
  }},
  "investment_recommendation": "which stock to prioritize and why"
}}
"""
            
            response = self.model.generate_content(prompt)
            
            # Clean and parse response
            response_text = response.text.strip()
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.startswith('```'):
                response_text = response_text[3:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            
            response_text = response_text.strip()
            comparison = json.loads(response_text)
            
            comparison['timestamp'] = datetime.now().isoformat()
            comparison['advisor_info'] = advisor
            
            return comparison
            
        except Exception as e:
            return {
                'error': str(e),
                'advisor': advisor['name'],
                'stocks': stock_symbols
            }
