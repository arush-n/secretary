"""
AI Agent Coordinator - Orchestrates stock analysis and financial advisory services
"""

from stock_advisor import StockAdvisor
from financial_advisory import FinancialAdvisory
import json

class InvestmentAgent:
    def __init__(self):
        self.stock_advisor = StockAdvisor()
        self.financial_advisory = FinancialAdvisory()
        
    def get_comprehensive_stock_analysis(self, stock_symbol, user_profile=None):
        """Get comprehensive stock analysis from multiple advisor perspectives"""
        user_profile = user_profile or {}
        
        # Get analysis from all three advisors
        advisors = ['warren_buffett', 'peter_lynch', 'cathie_wood']
        analyses = {}
        
        for advisor_id in advisors:
            analysis = self.stock_advisor.analyze_stock(
                stock_symbol=stock_symbol,
                advisor_id=advisor_id,
                user_context=user_profile
            )
            analyses[advisor_id] = analysis
        
        # Synthesize recommendations
        synthesis = self._synthesize_advisor_opinions(analyses, stock_symbol)
        
        # Add financial advisory context
        if user_profile:
            risk_assessment = self.financial_advisory.assess_risk_profile(user_profile)
            synthesis['user_suitability'] = self._assess_stock_suitability(
                analyses, risk_assessment, user_profile
            )
        
        return {
            'stock_symbol': stock_symbol,
            'advisor_analyses': analyses,
            'synthesis': synthesis,
            'timestamp': analyses.get('warren_buffett', {}).get('timestamp', '')
        }
    
    def _synthesize_advisor_opinions(self, analyses, stock_symbol):
        """Synthesize opinions from multiple advisors"""
        synthesis = {
            'consensus': 'mixed',
            'bullish_consensus': [],
            'bearish_consensus': [],
            'key_agreement_points': [],
            'key_disagreement_points': [],
            'overall_recommendation': 'hold',
            'confidence_level': 'medium'
        }
        
        bullish_count = 0
        bearish_count = 0
        recommendations = []
        
        # Analyze each advisor's opinion
        for advisor_id, analysis in analyses.items():
            if 'error' in analysis:
                continue
                
            recommendation = analysis.get('recommendation', {})
            action = recommendation.get('action', 'hold')
            recommendations.append(action)
            
            if action in ['buy']:
                bullish_count += 1
                synthesis['bullish_consensus'].append({
                    'advisor': advisor_id,
                    'reasoning': recommendation.get('reasoning', '')
                })
            elif action in ['sell', 'avoid']:
                bearish_count += 1
                synthesis['bearish_consensus'].append({
                    'advisor': advisor_id,
                    'reasoning': recommendation.get('reasoning', '')
                })
        
        # Determine consensus
        total_advisors = len([a for a in analyses.values() if 'error' not in a])
        if total_advisors == 0:
            synthesis['consensus'] = 'unavailable'
        elif bullish_count > bearish_count:
            synthesis['consensus'] = 'bullish'
            synthesis['overall_recommendation'] = 'buy'
        elif bearish_count > bullish_count:
            synthesis['consensus'] = 'bearish'
            synthesis['overall_recommendation'] = 'avoid'
        else:
            synthesis['consensus'] = 'mixed'
            synthesis['overall_recommendation'] = 'hold'
        
        # Extract common themes
        synthesis['key_agreement_points'] = self._extract_common_themes(analyses, 'agreement')
        synthesis['key_disagreement_points'] = self._extract_common_themes(analyses, 'disagreement')
        
        return synthesis
    
    def _extract_common_themes(self, analyses, theme_type):
        """Extract common themes from advisor analyses"""
        themes = []
        
        if theme_type == 'agreement':
            # Look for common bullish or bearish points
            all_bullish_points = []
            all_bearish_points = []
            
            for analysis in analyses.values():
                if 'error' in analysis:
                    continue
                bullish_points = analysis.get('bullish_case', {}).get('key_points', [])
                bearish_points = analysis.get('bearish_case', {}).get('key_points', [])
                all_bullish_points.extend(bullish_points)
                all_bearish_points.extend(bearish_points)
            
            # Find overlapping themes (simplified)
            common_words = ['growth', 'revenue', 'market', 'competition', 'valuation', 'management']
            for word in common_words:
                bullish_mentions = sum(1 for point in all_bullish_points if word.lower() in point.lower())
                bearish_mentions = sum(1 for point in all_bearish_points if word.lower() in point.lower())
                
                if bullish_mentions >= 2:
                    themes.append(f"multiple advisors see {word} as positive factor")
                elif bearish_mentions >= 2:
                    themes.append(f"multiple advisors concerned about {word}")
        
        return themes[:3]  # Return top 3 themes
    
    def _assess_stock_suitability(self, analyses, risk_assessment, user_profile):
        """Assess if stock is suitable for user's risk profile"""
        user_risk_category = risk_assessment['risk_category']
        
        # Count risk assessments from advisors
        high_risk_count = 0
        medium_risk_count = 0
        low_risk_count = 0
        
        for analysis in analyses.values():
            if 'error' in analysis:
                continue
            risk_level = analysis.get('risk_assessment', {}).get('overall_risk', 'medium')
            if risk_level == 'high':
                high_risk_count += 1
            elif risk_level == 'medium':
                medium_risk_count += 1
            else:
                low_risk_count += 1
        
        # Determine stock risk profile
        if high_risk_count >= 2:
            stock_risk = 'high'
        elif low_risk_count >= 2:
            stock_risk = 'low'
        else:
            stock_risk = 'medium'
        
        # Match with user profile
        suitability_matrix = {
            'conservative': {'low': 'excellent', 'medium': 'fair', 'high': 'poor'},
            'moderate': {'low': 'good', 'medium': 'excellent', 'high': 'fair'},
            'aggressive': {'low': 'good', 'medium': 'good', 'high': 'excellent'}
        }
        
        suitability_score = suitability_matrix.get(user_risk_category, {}).get(stock_risk, 'fair')
        
        return {
            'suitability_score': suitability_score,
            'user_risk_category': user_risk_category,
            'stock_risk_level': stock_risk,
            'recommendation': self._generate_suitability_recommendation(
                suitability_score, user_risk_category, stock_risk
            )
        }
    
    def _generate_suitability_recommendation(self, suitability_score, user_risk, stock_risk):
        """Generate recommendation based on suitability"""
        recommendations = {
            'excellent': f"this stock aligns well with your {user_risk} risk profile",
            'good': f"this stock is a reasonable fit for your {user_risk} investment approach",
            'fair': f"this stock has mixed suitability for your {user_risk} profile - consider carefully",
            'poor': f"this {stock_risk}-risk stock may not align with your {user_risk} investment approach"
        }
        
        return recommendations.get(suitability_score, "suitability unclear - consult financial advisor")
    
    def get_portfolio_analysis(self, user_portfolio, user_profile):
        """Analyze user's current portfolio and provide recommendations"""
        risk_assessment = self.financial_advisory.assess_risk_profile(user_profile)
        
        # Evaluate current portfolio
        current_allocation = self._calculate_portfolio_allocation(user_portfolio)
        target_allocation = risk_assessment['recommended_allocation']
        
        evaluation = self.financial_advisory.evaluate_investment_strategy(
            current_allocation, target_allocation
        )
        
        # Get market outlook from advisors
        market_outlooks = {}
        advisors = ['warren_buffett', 'peter_lynch', 'cathie_wood']
        
        for advisor_id in advisors:
            outlook = self.stock_advisor.get_market_outlook(advisor_id)
            if 'error' not in outlook:
                market_outlooks[advisor_id] = outlook
        
        return {
            'portfolio_evaluation': evaluation,
            'risk_assessment': risk_assessment,
            'market_outlooks': market_outlooks,
            'recommendations': self._generate_portfolio_recommendations(evaluation, risk_assessment)
        }
    
    def _calculate_portfolio_allocation(self, portfolio):
        """Calculate current portfolio allocation by asset class"""
        # Simplified allocation calculation
        # In reality, this would categorize holdings by asset class
        allocation = {
            'stocks': 0,
            'bonds': 0,
            'cash': 0
        }
        
        total_value = sum(portfolio.values())
        
        for holding, value in portfolio.items():
            # Simple categorization logic (would be more sophisticated in practice)
            if 'bond' in holding.lower() or 'treasury' in holding.lower():
                allocation['bonds'] += value
            elif 'cash' in holding.lower() or 'savings' in holding.lower():
                allocation['cash'] += value
            else:
                allocation['stocks'] += value
        
        return allocation
    
    def _generate_portfolio_recommendations(self, evaluation, risk_assessment):
        """Generate actionable portfolio recommendations"""
        recommendations = []
        
        if evaluation['rebalancing_needed']:
            recommendations.append("portfolio rebalancing recommended")
            recommendations.extend(evaluation['recommendations'])
        
        if evaluation['alignment_score'] < 70:
            recommendations.append("consider adjusting portfolio to better match risk profile")
        
        recommendations.append(f"maintain {risk_assessment['risk_category']} investment approach")
        
        return recommendations
    
    def compare_investment_options(self, stock_symbols, user_profile, advisor_preference=None):
        """Compare multiple investment options"""
        if advisor_preference:
            advisors = [advisor_preference]
        else:
            advisors = ['warren_buffett', 'peter_lynch', 'cathie_wood']
        
        comparisons = {}
        
        for advisor_id in advisors:
            comparison = self.stock_advisor.compare_stocks(
                stock_symbols, advisor_id
            )
            if 'error' not in comparison:
                comparisons[advisor_id] = comparison
        
        # Synthesize comparison results
        if len(comparisons) > 1:
            synthesis = self._synthesize_comparisons(comparisons, stock_symbols)
        else:
            synthesis = list(comparisons.values())[0] if comparisons else {}
        
        return {
            'stock_symbols': stock_symbols,
            'advisor_comparisons': comparisons,
            'synthesis': synthesis
        }
    
    def _synthesize_comparisons(self, comparisons, stock_symbols):
        """Synthesize multiple advisor comparisons"""
        # Count votes for each stock
        votes = {symbol: 0 for symbol in stock_symbols}
        
        for comparison in comparisons.values():
            winner = comparison.get('comparison', {}).get('winner', '')
            if winner in votes:
                votes[winner] += 1
        
        # Find consensus winner
        consensus_winner = max(votes, key=votes.get) if votes else stock_symbols[0]
        
        return {
            'consensus_winner': consensus_winner,
            'vote_distribution': votes,
            'agreement_level': 'high' if max(votes.values()) == len(comparisons) else 'mixed'
        }
