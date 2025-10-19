import google.generativeai as genai
import os
from datetime import datetime
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class StockAdvisor:
    def __init__(self):
        # Configure API key 
        genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
        self.model = genai.GenerativeModel('gemini-2.5-flash')
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
            
            # Create advisor-specific prompts with very different analysis styles
            if advisor_id == 'warren_buffett':
                prompt = f"""
You are Warren Buffett analyzing {stock_symbol}. Focus on VALUE INVESTING principles:

KEY ANALYSIS AREAS:
- Economic moats and competitive advantages
- Management quality and capital allocation
- Free cash flow generation and financial strength
- Price vs intrinsic value assessment
- Long-term earnings power (10+ years)
- Industry position and pricing power

BUFFETT'S STYLE:
- Look for "wonderful companies at fair prices"
- Emphasize predictable businesses you can understand
- Focus on return on equity, debt levels, profit margins
- Consider if you'd hold this stock for 10+ years
- Avoid speculative or high-tech companies you can't evaluate

Return analysis as Warren Buffett would - conservative, focused on fundamentals, long-term wealth building:

{{
  "advisor": "warren buffett",
  "stock_symbol": "{stock_symbol}",
  "bullish_case": {{
    "summary": "Value-focused bullish perspective emphasizing moats and fundamentals",
    "key_points": ["competitive advantages", "financial strength metrics", "management quality", "predictable earnings"],
    "confidence_level": "high/medium/low"
  }},
  "bearish_case": {{
    "summary": "Conservative concerns about valuation and business risks",
    "key_points": ["valuation concerns", "competitive threats", "debt levels", "business complexity"],
    "confidence_level": "high/medium/low"
  }},
  "recommendation": {{
    "action": "buy/hold/sell/avoid",
    "reasoning": "Value-based reasoning focusing on price vs intrinsic value",
    "price_target_outlook": "bullish/neutral/bearish",
    "time_horizon": "long term"
  }},
  "risk_assessment": {{
    "overall_risk": "low/medium/high",
    "key_risks": ["fundamental business risks that matter to value investors"],
    "suitable_for_user": true/false
  }}
}}
"""
            elif advisor_id == 'peter_lynch':
                prompt = f"""
You are Peter Lynch analyzing {stock_symbol}. Focus on GROWTH INVESTING and "invest in what you know":

KEY ANALYSIS AREAS:
- Earnings growth trends and sustainability
- Market position in understandable business
- Consumer behavior and brand strength
- PEG ratio and growth at reasonable price
- Management execution and expansion plans
- Industry tailwinds and market opportunity

LYNCH'S STYLE:
- "Invest in what you know" - focus on understandable businesses
- Look for companies with 15-25% earnings growth
- Favor companies with strong consumer brands
- Consider local businesses and trends you can observe
- Balance growth with reasonable valuation (PEG < 1.5)

Return analysis as Peter Lynch would - growth-focused, practical, research-oriented:

{{
  "advisor": "peter lynch",
  "stock_symbol": "{stock_symbol}",
  "bullish_case": {{
    "summary": "Growth-focused case emphasizing earnings momentum and market opportunity",
    "key_points": ["earnings growth trajectory", "market expansion potential", "brand strength", "consumer trends"],
    "confidence_level": "high/medium/low"
  }},
  "bearish_case": {{
    "summary": "Growth concerns and execution risks",
    "key_points": ["growth sustainability", "competition risks", "valuation stretched", "execution challenges"],
    "confidence_level": "high/medium/low"
  }},
  "recommendation": {{
    "action": "buy/hold/sell/avoid",
    "reasoning": "Growth-based reasoning focusing on earnings potential and market position",
    "price_target_outlook": "bullish/neutral/bearish",
    "time_horizon": "medium term"
  }},
  "risk_assessment": {{
    "overall_risk": "low/medium/high",
    "key_risks": ["growth-specific risks and competitive threats"],
    "suitable_for_user": true/false
  }}
}}
"""
            else:  # cathie_wood
                prompt = f"""
You are Cathie Wood analyzing {stock_symbol}. Focus on DISRUPTIVE INNOVATION and exponential growth:

KEY ANALYSIS AREAS:
- Disruptive technology adoption and scalability
- Total addressable market expansion
- Innovation moats and R&D capabilities
- Network effects and platform dynamics
- Convergence of multiple technologies
- 5-10 year transformation potential

WOOD'S STYLE:
- Focus on companies enabling technological convergence
- Look for 15%+ annual revenue growth for 5+ years
- Emphasize companies with pricing power through innovation
- Consider AI, genomics, robotics, blockchain adoption
- Accept higher volatility for exponential growth potential
- Think about how technology transforms entire industries

Return analysis as Cathie Wood would - innovation-focused, high-conviction, transformational:

{{
  "advisor": "cathie wood",
  "stock_symbol": "{stock_symbol}",
  "bullish_case": {{
    "summary": "Innovation-focused case emphasizing disruptive potential and exponential growth",
    "key_points": ["disruptive technology advantage", "massive market opportunity", "platform effects", "innovation moats"],
    "confidence_level": "high/medium/low"
  }},
  "bearish_case": {{
    "summary": "Innovation and execution risks in rapidly changing markets",
    "key_points": ["execution risk", "competitive disruption", "technology adoption delays", "regulatory challenges"],
    "confidence_level": "high/medium/low"
  }},
  "recommendation": {{
    "action": "buy/hold/sell/avoid",
    "reasoning": "Innovation-based reasoning focusing on transformational growth potential",
    "price_target_outlook": "bullish/neutral/bearish",
    "time_horizon": "long term"
  }},
  "risk_assessment": {{
    "overall_risk": "low/medium/high",
    "key_risks": ["innovation and disruption-specific risks"],
    "suitable_for_user": true/false
  }}
}}
"""
            
            response = self.model.generate_content(prompt)
            
            # Clean and parse response
            response_text = response.text.strip()
            print(f"Raw AI response for {stock_symbol}: {response_text[:200]}...")  # Debug logging
            
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
            analysis['ai_status'] = 'success'
            
            return analysis
            
        except json.JSONDecodeError as e:
            print(f"JSON parse error for {stock_symbol}: {e}")  # Debug logging
            return self._get_fallback_analysis(advisor, stock_symbol, 'json_parse_error')
        except Exception as e:
            print(f"API error for {stock_symbol}: {e}")  # Debug logging
            error_str = str(e).lower()
            if 'quota' in error_str or 'rate limit' in error_str or '429' in error_str:
                return self._get_fallback_analysis(advisor, stock_symbol, 'quota_exceeded')
            else:
                return self._get_fallback_analysis(advisor, stock_symbol, 'api_error')
    
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
    
    def _get_fallback_analysis(self, advisor, stock_symbol, error_type):
        """Provide fallback analysis when AI is unavailable"""
        fallback_analyses = {
            'warren_buffett': {
                'bullish_case': {
                    'summary': f'{stock_symbol} may possess durable competitive advantages and strong fundamentals that warrant patient capital appreciation.',
                    'key_points': ['economic moats and competitive positioning', 'consistent free cash flow generation', 'quality management with shareholder focus', 'reasonable valuation relative to intrinsic value'],
                    'confidence_level': 'medium'
                },
                'bearish_case': {
                    'summary': f'valuation concerns and potential disruption to {stock_symbol} business model could limit long-term returns.',
                    'key_points': ['price may exceed intrinsic value', 'competitive moats under pressure', 'debt levels or capital allocation concerns', 'business complexity reducing predictability'],
                    'confidence_level': 'medium'
                },
                'recommendation': {
                    'action': 'hold',
                    'reasoning': 'requires thorough analysis of competitive advantages, financial strength, and management quality before investment decision',
                    'price_target_outlook': 'neutral',
                    'time_horizon': 'long term'
                }
            },
            'peter_lynch': {
                'bullish_case': {
                    'summary': f'{stock_symbol} operates in an understandable business with potential for sustained earnings growth and market expansion.',
                    'key_points': ['strong brand recognition and consumer loyalty', 'earnings growth trajectory above market average', 'expanding market opportunity in familiar industry', 'reasonable PEG ratio for growth profile'],
                    'confidence_level': 'medium'
                },
                'bearish_case': {
                    'summary': f'growth expectations for {stock_symbol} may be overly optimistic given competitive pressures and market maturity.',
                    'key_points': ['earnings growth may be slowing', 'increased competition in core markets', 'valuation stretched relative to growth prospects', 'execution risks in expansion plans'],
                    'confidence_level': 'medium'
                },
                'recommendation': {
                    'action': 'hold',
                    'reasoning': 'invest in what you know - need deeper research into business fundamentals and growth sustainability',
                    'price_target_outlook': 'neutral',
                    'time_horizon': 'medium term'
                }
            },
            'cathie_wood': {
                'bullish_case': {
                    'summary': f'{stock_symbol} positioned to benefit from technological convergence and exponential growth in transformative markets.',
                    'key_points': ['disruptive innovation platform with network effects', 'massive total addressable market expansion', 'first-mover advantage in emerging technology', 'potential for 15%+ annual revenue growth'],
                    'confidence_level': 'medium'
                },
                'bearish_case': {
                    'summary': f'high expectations for {stock_symbol} innovation may face execution challenges and competitive disruption risks.',
                    'key_points': ['technology adoption slower than expected', 'well-funded competitors entering market', 'regulatory headwinds for disruptive models', 'high volatility and valuation sensitivity'],
                    'confidence_level': 'medium'
                },
                'recommendation': {
                    'action': 'hold',
                    'reasoning': 'transformational potential exists but requires conviction in disruptive thesis and tolerance for volatility',
                    'price_target_outlook': 'neutral',
                    'time_horizon': 'long term'
                }
            }
        }
        
        analysis = fallback_analyses.get(advisor['name'].replace(' ', '_'), fallback_analyses['warren_buffett'])
        
        return {
            'advisor': advisor['name'],
            'stock_symbol': stock_symbol,
            'bullish_case': analysis['bullish_case'],
            'bearish_case': analysis['bearish_case'],
            'recommendation': analysis['recommendation'],
            'risk_assessment': {
                'overall_risk': 'medium',
                'key_risks': ['market volatility', 'company-specific risks', 'economic factors'],
                'suitable_for_user': True
            },
            'timestamp': datetime.now().isoformat(),
            'advisor_info': advisor,
            'ai_status': 'fallback_mode',
            'message': 'ai analysis temporarily unavailable - showing general guidance based on advisor philosophy'
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
