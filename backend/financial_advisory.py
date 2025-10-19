"""
Financial Advisory Agent - Provides structured financial advice and portfolio guidance
"""

class FinancialAdvisory:
    def __init__(self):
        self.advisory_frameworks = {
            'risk_assessment': {
                'conservative': {
                    'allocation': {'stocks': 40, 'bonds': 50, 'cash': 10},
                    'characteristics': ['capital preservation', 'steady income', 'low volatility'],
                    'suitable_for': ['retirees', 'short-term goals', 'risk-averse investors']
                },
                'moderate': {
                    'allocation': {'stocks': 60, 'bonds': 30, 'cash': 10},
                    'characteristics': ['balanced growth', 'moderate risk', 'diversified'],
                    'suitable_for': ['medium-term goals', 'balanced investors', '10+ year horizon']
                },
                'aggressive': {
                    'allocation': {'stocks': 80, 'bonds': 15, 'cash': 5},
                    'characteristics': ['high growth potential', 'higher volatility', 'long-term focus'],
                    'suitable_for': ['young investors', 'long-term goals', 'high risk tolerance']
                }
            },
            'investment_principles': {
                'diversification': 'spread risk across different asset classes and sectors',
                'dollar_cost_averaging': 'invest regularly regardless of market conditions',
                'rebalancing': 'maintain target allocation through periodic adjustments',
                'low_fees': 'minimize investment costs to maximize returns',
                'tax_efficiency': 'consider tax implications of investment decisions'
            }
        }
    
    def assess_risk_profile(self, user_data):
        """Assess user's risk profile based on their financial situation"""
        age = user_data.get('age', 30)
        income = user_data.get('annual_income', 50000)
        savings = user_data.get('current_savings', 10000)
        debt = user_data.get('total_debt', 0)
        time_horizon = user_data.get('investment_timeline', 10)
        risk_comfort = user_data.get('risk_comfort_level', 'moderate')  # conservative/moderate/aggressive
        
        # Calculate risk score
        risk_score = 0
        
        # Age factor (younger = higher risk capacity)
        if age < 30:
            risk_score += 3
        elif age < 45:
            risk_score += 2
        elif age < 60:
            risk_score += 1
        
        # Income stability factor
        if income > 100000:
            risk_score += 2
        elif income > 60000:
            risk_score += 1
        
        # Savings cushion factor
        emergency_fund_months = (savings / (income / 12)) if income > 0 else 0
        if emergency_fund_months >= 6:
            risk_score += 2
        elif emergency_fund_months >= 3:
            risk_score += 1
        
        # Debt factor
        debt_to_income = debt / income if income > 0 else 0
        if debt_to_income < 0.2:
            risk_score += 1
        elif debt_to_income > 0.5:
            risk_score -= 1
        
        # Time horizon factor
        if time_horizon >= 20:
            risk_score += 3
        elif time_horizon >= 10:
            risk_score += 2
        elif time_horizon >= 5:
            risk_score += 1
        
        # User comfort adjustment
        comfort_adjustments = {
            'conservative': -2,
            'moderate': 0,
            'aggressive': 2
        }
        risk_score += comfort_adjustments.get(risk_comfort, 0)
        
        # Determine risk category
        if risk_score <= 3:
            risk_category = 'conservative'
        elif risk_score <= 7:
            risk_category = 'moderate'
        else:
            risk_category = 'aggressive'
        
        return {
            'risk_category': risk_category,
            'risk_score': risk_score,
            'recommended_allocation': self.advisory_frameworks['risk_assessment'][risk_category]['allocation'],
            'characteristics': self.advisory_frameworks['risk_assessment'][risk_category]['characteristics'],
            'reasoning': self._generate_risk_reasoning(user_data, risk_score, risk_category)
        }
    
    def _generate_risk_reasoning(self, user_data, risk_score, risk_category):
        """Generate explanation for risk assessment"""
        factors = []
        
        age = user_data.get('age', 30)
        if age < 35:
            factors.append("young age allows for long-term growth focus")
        elif age >= 55:
            factors.append("approaching retirement suggests more conservative approach")
        
        income = user_data.get('annual_income', 50000)
        if income > 80000:
            factors.append("stable high income supports higher risk tolerance")
        
        time_horizon = user_data.get('investment_timeline', 10)
        if time_horizon >= 15:
            factors.append("long investment timeline enables growth-focused strategy")
        elif time_horizon <= 5:
            factors.append("shorter timeline requires capital preservation focus")
        
        return f"based on your profile, a {risk_category} approach is recommended. key factors: {', '.join(factors)}"
    
    def generate_portfolio_recommendation(self, risk_profile, investment_amount):
        """Generate specific portfolio recommendations"""
        allocation = risk_profile['recommended_allocation']
        
        recommendations = {
            'total_amount': investment_amount,
            'allocation_breakdown': {},
            'specific_recommendations': {},
            'implementation_steps': []
        }
        
        # Calculate dollar amounts
        for asset_class, percentage in allocation.items():
            amount = investment_amount * (percentage / 100)
            recommendations['allocation_breakdown'][asset_class] = {
                'percentage': percentage,
                'amount': amount
            }
        
        # Specific investment recommendations
        recommendations['specific_recommendations'] = {
            'stocks': {
                'instruments': ['total stock market index fund', 'S&P 500 index fund', 'international stock fund'],
                'reasoning': 'low-cost diversified exposure to equity markets'
            },
            'bonds': {
                'instruments': ['total bond market index fund', 'treasury inflation-protected securities'],
                'reasoning': 'stability and income generation'
            },
            'cash': {
                'instruments': ['high-yield savings account', 'money market fund'],
                'reasoning': 'liquidity and emergency fund maintenance'
            }
        }
        
        # Implementation steps
        recommendations['implementation_steps'] = [
            'open investment account with low-cost provider',
            'set up automatic investment plan',
            'purchase recommended index funds',
            'schedule quarterly portfolio review',
            'rebalance annually or when allocation drifts >5%'
        ]
        
        return recommendations
    
    def evaluate_investment_strategy(self, current_portfolio, target_allocation):
        """Evaluate current portfolio against target allocation"""
        evaluation = {
            'alignment_score': 0,
            'recommendations': [],
            'rebalancing_needed': False,
            'analysis': {}
        }
        
        # Calculate current allocation percentages
        total_value = sum(current_portfolio.values())
        current_allocation = {}
        
        for asset_class, value in current_portfolio.items():
            current_allocation[asset_class] = (value / total_value) * 100 if total_value > 0 else 0
        
        # Compare with target
        deviations = {}
        for asset_class, target_pct in target_allocation.items():
            current_pct = current_allocation.get(asset_class, 0)
            deviation = abs(current_pct - target_pct)
            deviations[asset_class] = deviation
            
            if deviation > 5:  # More than 5% deviation
                evaluation['rebalancing_needed'] = True
                if current_pct < target_pct:
                    evaluation['recommendations'].append(f'increase {asset_class} allocation by {deviation:.1f}%')
                else:
                    evaluation['recommendations'].append(f'reduce {asset_class} allocation by {deviation:.1f}%')
        
        # Calculate alignment score (100 - average deviation)
        avg_deviation = sum(deviations.values()) / len(deviations)
        evaluation['alignment_score'] = max(0, 100 - avg_deviation * 2)
        
        evaluation['analysis'] = {
            'current_allocation': current_allocation,
            'target_allocation': target_allocation,
            'deviations': deviations,
            'total_portfolio_value': total_value
        }
        
        return evaluation
    
    def get_investment_principles(self):
        """Return core investment principles"""
        return self.advisory_frameworks['investment_principles']
    
    def generate_financial_advice(self, user_situation):
        """Generate comprehensive financial advice based on user situation"""
        advice = {
            'priority_actions': [],
            'investment_advice': [],
            'risk_management': [],
            'long_term_strategy': []
        }
        
        # Analyze user situation
        emergency_fund = user_situation.get('emergency_fund', 0)
        monthly_expenses = user_situation.get('monthly_expenses', 3000)
        debt = user_situation.get('high_interest_debt', 0)
        income = user_situation.get('monthly_income', 5000)
        
        # Priority actions
        emergency_months = emergency_fund / monthly_expenses if monthly_expenses > 0 else 0
        
        if emergency_months < 3:
            advice['priority_actions'].append('build emergency fund to 3-6 months of expenses')
        
        if debt > 0:
            advice['priority_actions'].append('pay down high-interest debt (>6% interest rate)')
        
        # Investment advice
        if emergency_months >= 3 and debt == 0:
            advice['investment_advice'].append('begin investing in diversified index funds')
            advice['investment_advice'].append('maximize employer 401(k) match if available')
        
        savings_rate = ((income - monthly_expenses) / income) * 100 if income > 0 else 0
        if savings_rate < 10:
            advice['investment_advice'].append('aim to save at least 10-15% of income')
        
        # Risk management
        advice['risk_management'].append('ensure adequate health insurance coverage')
        advice['risk_management'].append('consider term life insurance if you have dependents')
        
        # Long-term strategy
        advice['long_term_strategy'].append('start retirement planning early to benefit from compound growth')
        advice['long_term_strategy'].append('review and adjust investment strategy annually')
        
        return advice
