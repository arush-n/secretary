"""
User Profile Service

Manages user profiles including demographics, financial attributes, 
behaviors, and preferences for personalized financial advice.
"""

import sqlite3
import json
import os
from datetime import datetime
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(__file__), 'secretary.db')


class UserProfileService:
    """Service for managing user profiles and personalization data."""
    
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
    
    def _get_connection(self):
        return sqlite3.connect(self.db_path)
    
    # ========== Core Profile Operations ==========
    
    def get_profile(self, user_id: str = 'default_user') -> Dict[str, Any]:
        """Get complete user profile with all related data."""
        conn = self._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        profile = {}
        
        # Get core profile
        cursor.execute('SELECT * FROM user_profiles WHERE id = ?', (user_id,))
        row = cursor.fetchone()
        if row:
            profile['core'] = dict(row)
        else:
            # Create default profile if not exists
            self.create_profile(user_id)
            profile['core'] = {'id': user_id, 'onboarding_completed': False}
        
        # Get demographics
        cursor.execute('SELECT * FROM user_demographics WHERE user_id = ?', (user_id,))
        row = cursor.fetchone()
        profile['demographics'] = dict(row) if row else {}
        
        # Get financials
        cursor.execute('SELECT * FROM user_financials WHERE user_id = ?', (user_id,))
        row = cursor.fetchone()
        if row:
            financials = dict(row)
            # Parse JSON fields
            for field in ['secondary_goals', 'debt_types', 'retirement_accounts']:
                if financials.get(field):
                    try:
                        financials[field] = json.loads(financials[field])
                    except:
                        pass
            profile['financials'] = financials
        else:
            profile['financials'] = {}
        
        # Get behaviors
        cursor.execute('SELECT * FROM user_behaviors WHERE user_id = ?', (user_id,))
        row = cursor.fetchone()
        if row:
            behaviors = dict(row)
            # Parse JSON fields
            for field in ['top_spending_categories', 'frequent_merchants']:
                if behaviors.get(field):
                    try:
                        behaviors[field] = json.loads(behaviors[field])
                    except:
                        pass
            profile['behaviors'] = behaviors
        else:
            profile['behaviors'] = {}
        
        # Get preferences
        cursor.execute('SELECT * FROM user_preferences WHERE user_id = ?', (user_id,))
        row = cursor.fetchone()
        profile['preferences'] = dict(row) if row else {
            'advice_tone': 'friendly',
            'currency': 'USD'
        }
        
        conn.close()
        return profile
    
    def create_profile(self, user_id: str, name: str = 'User', email: str = None) -> bool:
        """Create a new user profile."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT OR IGNORE INTO user_profiles (id, name, email, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, name, email, datetime.now(), datetime.now()))
            
            # Initialize related tables
            cursor.execute('INSERT OR IGNORE INTO user_demographics (user_id) VALUES (?)', (user_id,))
            cursor.execute('INSERT OR IGNORE INTO user_financials (user_id) VALUES (?)', (user_id,))
            cursor.execute('INSERT OR IGNORE INTO user_behaviors (user_id) VALUES (?)', (user_id,))
            cursor.execute('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)', (user_id,))
            
            conn.commit()
            logger.info(f"Created profile for user: {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to create profile: {e}")
            return False
        finally:
            conn.close()
    
    def update_profile(self, user_id: str, data: Dict[str, Any]) -> bool:
        """Update user profile fields."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            # Update core profile
            if 'name' in data or 'email' in data:
                updates = []
                values = []
                if 'name' in data:
                    updates.append('name = ?')
                    values.append(data['name'])
                if 'email' in data:
                    updates.append('email = ?')
                    values.append(data['email'])
                updates.append('updated_at = ?')
                values.append(datetime.now())
                values.append(user_id)
                
                cursor.execute(f'''
                    UPDATE user_profiles SET {', '.join(updates)} WHERE id = ?
                ''', values)
            
            conn.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to update profile: {e}")
            return False
        finally:
            conn.close()
    
    # ========== Demographics Operations ==========
    
    def update_demographics(self, user_id: str, data: Dict[str, Any]) -> bool:
        """Update user demographics."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        allowed_fields = ['age', 'age_range', 'income_range', 'employment_status', 
                         'occupation', 'household_size', 'location_state', 'location_city']
        
        try:
            # Ensure row exists
            cursor.execute('INSERT OR IGNORE INTO user_demographics (user_id) VALUES (?)', (user_id,))
            
            updates = []
            values = []
            for field in allowed_fields:
                if field in data:
                    updates.append(f'{field} = ?')
                    values.append(data[field])
            
            if updates:
                values.append(user_id)
                cursor.execute(f'''
                    UPDATE user_demographics SET {', '.join(updates)} WHERE user_id = ?
                ''', values)
            
            conn.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to update demographics: {e}")
            return False
        finally:
            conn.close()
    
    # ========== Financials Operations ==========
    
    def update_financials(self, user_id: str, data: Dict[str, Any]) -> bool:
        """Update user financial attributes."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        allowed_fields = ['primary_goal', 'secondary_goals', 'target_savings_rate',
                         'monthly_income', 'monthly_expenses', 'total_debt', 'debt_types',
                         'emergency_fund_months', 'investment_experience', 'risk_tolerance',
                         'retirement_accounts']
        
        try:
            cursor.execute('INSERT OR IGNORE INTO user_financials (user_id) VALUES (?)', (user_id,))
            
            updates = []
            values = []
            for field in allowed_fields:
                if field in data:
                    value = data[field]
                    # Serialize JSON fields
                    if field in ['secondary_goals', 'debt_types', 'retirement_accounts'] and isinstance(value, (list, dict)):
                        value = json.dumps(value)
                    updates.append(f'{field} = ?')
                    values.append(value)
            
            if updates:
                values.append(user_id)
                cursor.execute(f'''
                    UPDATE user_financials SET {', '.join(updates)} WHERE user_id = ?
                ''', values)
            
            conn.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to update financials: {e}")
            return False
        finally:
            conn.close()
    
    # ========== Preferences Operations ==========
    
    def update_preferences(self, user_id: str, data: Dict[str, Any]) -> bool:
        """Update user preferences."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        allowed_fields = ['notification_enabled', 'weekly_summary_enabled', 'advice_tone', 'currency']
        
        try:
            cursor.execute('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)', (user_id,))
            
            updates = []
            values = []
            for field in allowed_fields:
                if field in data:
                    updates.append(f'{field} = ?')
                    values.append(data[field])
            
            if updates:
                values.append(user_id)
                cursor.execute(f'''
                    UPDATE user_preferences SET {', '.join(updates)} WHERE user_id = ?
                ''', values)
            
            conn.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to update preferences: {e}")
            return False
        finally:
            conn.close()
    
    # ========== Behavior Tracking ==========
    
    def update_behaviors(self, user_id: str, transactions: List[Dict]) -> Dict[str, Any]:
        """Calculate and update behavioral attributes from transactions."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('INSERT OR IGNORE INTO user_behaviors (user_id) VALUES (?)', (user_id,))
            
            if not transactions:
                return {}
            
            # Filter expenses
            expenses = [t for t in transactions if float(t.get('amount', 0)) < 0]
            
            # Calculate avg monthly spending
            amounts = [abs(float(t.get('amount', 0))) for t in expenses]
            avg_monthly = sum(amounts) / 12 if amounts else 0
            
            # Get top spending categories
            category_totals = {}
            for t in expenses:
                cat = t.get('category', 'Other')
                category_totals[cat] = category_totals.get(cat, 0) + abs(float(t.get('amount', 0)))
            
            top_categories = sorted(category_totals.items(), key=lambda x: x[1], reverse=True)[:5]
            top_categories = [c[0] for c in top_categories]
            
            # Get frequent merchants
            merchant_counts = {}
            for t in expenses:
                merchant = t.get('description', 'Unknown')
                merchant_counts[merchant] = merchant_counts.get(merchant, 0) + 1
            
            frequent_merchants = sorted(merchant_counts.items(), key=lambda x: x[1], reverse=True)[:10]
            frequent_merchants = [m[0] for m in frequent_merchants]
            
            # Calculate impulse buyer score (based on small frequent purchases)
            small_purchases = [t for t in expenses if abs(float(t.get('amount', 0))) < 20]
            impulse_score = min(1.0, len(small_purchases) / max(len(expenses), 1) * 2)
            
            # Update behaviors
            cursor.execute('''
                UPDATE user_behaviors SET
                    avg_monthly_spending = ?,
                    top_spending_categories = ?,
                    frequent_merchants = ?,
                    last_active = ?,
                    impulse_buyer_score = ?
                WHERE user_id = ?
            ''', (
                avg_monthly,
                json.dumps(top_categories),
                json.dumps(frequent_merchants),
                datetime.now(),
                impulse_score,
                user_id
            ))
            
            conn.commit()
            
            behaviors = {
                'avg_monthly_spending': avg_monthly,
                'top_spending_categories': top_categories,
                'frequent_merchants': frequent_merchants,
                'impulse_buyer_score': impulse_score
            }
            
            logger.info(f"Updated behaviors for user: {user_id}")
            return behaviors
            
        except Exception as e:
            logger.error(f"Failed to update behaviors: {e}")
            return {}
        finally:
            conn.close()
    
    def increment_chat_count(self, user_id: str) -> bool:
        """Increment chat usage count."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                UPDATE user_behaviors 
                SET chat_count = COALESCE(chat_count, 0) + 1, last_active = ?
                WHERE user_id = ?
            ''', (datetime.now(), user_id))
            conn.commit()
            return True
        except:
            return False
        finally:
            conn.close()
    
    # ========== Onboarding ==========
    
    def complete_onboarding(self, user_id: str, data: Dict[str, Any]) -> bool:
        """Process onboarding data and update all profile sections."""
        try:
            # Update demographics
            if 'demographics' in data:
                self.update_demographics(user_id, data['demographics'])
            
            # Update financials
            if 'financials' in data:
                self.update_financials(user_id, data['financials'])
            
            # Update preferences
            if 'preferences' in data:
                self.update_preferences(user_id, data['preferences'])
            
            # Mark onboarding complete
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE user_profiles SET onboarding_completed = TRUE, updated_at = ?
                WHERE id = ?
            ''', (datetime.now(), user_id))
            conn.commit()
            conn.close()
            
            logger.info(f"Onboarding completed for user: {user_id}")
            return True
        except Exception as e:
            logger.error(f"Onboarding failed: {e}")
            return False
    
    # ========== Personalization Context ==========
    
    def get_personalization_context(self, user_id: str = 'default_user') -> str:
        """Generate personalization context string for AI prompts."""
        profile = self.get_profile(user_id)
        
        context_parts = []
        
        # Core info
        core = profile.get('core', {})
        if core.get('name'):
            context_parts.append(f"User Name: {core['name']}")
        
        # Demographics
        demo = profile.get('demographics', {})
        if demo.get('age_range'):
            context_parts.append(f"Age Range: {demo['age_range']}")
        if demo.get('income_range'):
            context_parts.append(f"Income Range: {demo['income_range']}")
        if demo.get('employment_status'):
            context_parts.append(f"Employment: {demo['employment_status']}")
        if demo.get('household_size'):
            context_parts.append(f"Household Size: {demo['household_size']}")
        
        # Financials
        fin = profile.get('financials', {})
        if fin.get('primary_goal'):
            context_parts.append(f"Primary Goal: {fin['primary_goal']}")
        if fin.get('risk_tolerance'):
            context_parts.append(f"Risk Tolerance: {fin['risk_tolerance']}")
        if fin.get('investment_experience'):
            context_parts.append(f"Investment Experience: {fin['investment_experience']}")
        if fin.get('total_debt'):
            context_parts.append(f"Total Debt: ${fin['total_debt']:,.2f}")
        
        # Behaviors
        beh = profile.get('behaviors', {})
        if beh.get('avg_monthly_spending'):
            context_parts.append(f"Avg Monthly Spending: ${beh['avg_monthly_spending']:,.2f}")
        if beh.get('top_spending_categories'):
            cats = beh['top_spending_categories']
            if isinstance(cats, list):
                context_parts.append(f"Top Spending: {', '.join(cats[:3])}")
        if beh.get('impulse_buyer_score'):
            score = beh['impulse_buyer_score']
            if score > 0.6:
                context_parts.append("Behavior: Tends toward impulse purchases")
            elif score < 0.3:
                context_parts.append("Behavior: Deliberate spender")
        
        # Preferences
        prefs = profile.get('preferences', {})
        advice_tone = prefs.get('advice_tone', 'friendly')
        context_parts.append(f"Preferred Tone: {advice_tone}")
        
        if not context_parts:
            return "No profile data available. User has not completed onboarding."
        
        return "\n".join(context_parts)


# Global service instance
profile_service = UserProfileService()


def get_profile_service() -> UserProfileService:
    """Get the global profile service instance."""
    return profile_service
