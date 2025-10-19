# Budget Calendar - Secretary

A smart budgeting calendar that shows actual spending, predicts future expenses using linear regression, and provides AI-powered saving/investing advice.

## Features

### 📅 Calendar View
- **Current month grid** with clear today highlight
- **Past days**: Show actual spending totals, click for itemized transactions
- **Future days**: Display ML-predicted spending (muted style)
- **Fixed charges**: Automatically detected recurring bills (rent, utilities, subscriptions)

### 📊 Smart Forecasting
- **Linear regression** on variable daily spending
- Excludes fixed monthly charges from prediction model
- Detects recurring charges: same merchant, ±15% amount, ±3 days cadence
- Computes projected month total = actual + predicted + upcoming fixed charges

### 💰 Budget Tracking
- Set monthly budget (persisted in localStorage)
- Real-time status: "Slow down" (over budget) or "You have leeway" (under budget)
- Dollar-accurate remaining/overage calculations

### 🤖 AI Advice
- "Ask Gemini" button when under budget
- Personalized save vs. invest suggestions based on remaining funds
- Context-aware: considers budget, projected total, risk tolerance

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- Capital One Nessie API key (optional - works with mock data)
- Google Gemini API key (optional)

### Setup

1. **Clone and install**:
```bash
cd /Users/rishikkolpekwar/Documents/Hackathons/hacktx-secretary

# Frontend
cd frontend
npm install

# Backend
cd ../backend
pip install -r requirements.txt numpy
```

2. **Configure environment** (optional for real data):
```bash
cd backend
cp .env.example .env
# Edit .env with your keys:
# NESSIE_API_KEY=your_key_here
# GEMINI_API_KEY=your_key_here
```

3. **Run**:
```bash
# Terminal 1 - Backend
cd backend
python app.py

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

4. **Open**: http://localhost:3002

## Usage

### First Time Setup
1. Navigate to the **Budgeting** tab in the sidebar
2. Enter your **Monthly Budget** (e.g., 3000)
3. (Optional) Enter **Nessie Account ID** for real data
4. Leave Account ID empty to see mock data demo

### Using the Calendar
- **Past days**: Click any day to see transaction details
- **Today**: Highlighted in blue
- **Future days**: Shows predicted spending (gray)
- **📌 Fixed**: Orange indicator for recurring bills

### Getting AI Advice
1. If you're under budget, you'll see remaining funds
2. Click **"Ask Gemini"** button
3. Get personalized save/invest suggestion in 1-2 sentences

## 30-Second Demo Script

```
1. Open app → Navigate to "Budgeting" tab
2. Set budget to $3000
3. Observe:
   - Past days show actual spending ($50-80/day)
   - Today is highlighted
   - Future days show predictions (~$70-90/day)
   - Fixed charges marked with 📌 (Rent: $1450, Phone: $95)
4. Check budget status:
   - "Spent So Far": ~$1,200
   - "Projected Total": ~$2,800
   - "Remaining": ~$200
5. Click "Ask Gemini" → Get investment advice
6. Click any past day → See itemized transactions
```

## Mock Mode

If no API keys are configured:
- Generates realistic mock transactions ($40-80 daily variable spend)
- Adds fixed charges (rent $1450, phone $95)
- Uses simple averaging for predictions
- Provides fallback AI advice

## Architecture

### Frontend (React + Vite)
- **BudgetCalendar.jsx**: Main component
- Calendar grid rendering with day/amount display
- LocalStorage for budget/accountId persistence
- Click handlers for transaction details

### Backend (Flask)
- **POST /api/nessie/transactions**: Fetch & normalize transactions
  - Filters to requested month/year
  - Detects recurring charges (±15% amount, ±3 days)
  - Runs linear regression on variable spend
  - Returns predictions for remaining days
  
- **POST /api/gemini/advice**: Get save/invest suggestion
  - Context: leeway amount, budget, projected total
  - Returns 1-2 sentence actionable advice
  - Fallback if Gemini unavailable

### Regression Logic
```python
# Exclude fixed charges from training
daily_spend = {day: sum(variable_transactions[day])}

# Simple least squares
slope, intercept = linear_regression(days, amounts)

# Predict future days
for future_day in remaining_days:
    predicted = max(0, slope * future_day + intercept)
```

### Recurring Detection
```python
# Group by merchant
# Check: similar amounts (±15%), monthly cadence
# Mark as fixed if criteria met
```

## API Reference

### Fetch Transactions
```bash
POST http://localhost:5001/api/nessie/transactions
Content-Type: application/json

{
  "accountId": "your_account_id",
  "month": 10,
  "year": 2025
}

Response:
{
  "transactions": [...],
  "fixedCharges": [...],
  "predictions": {
    "19": 75.30,
    "20": 76.80,
    ...
  }
}
```

### Get AI Advice
```bash
POST http://localhost:5001/api/gemini/advice
Content-Type: application/json

{
  "leeway": 250.50,
  "context": {
    "budget": 3000,
    "projectedTotal": 2749.50,
    "riskTolerance": "moderate"
  }
}

Response:
{
  "suggestion": "With $250.50 remaining, consider..."
}
```

## Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS
- **Backend**: Flask, NumPy, Google Gemini AI
- **APIs**: Capital One Nessie (banking), Gemini (AI advice)
- **Storage**: LocalStorage (no database)

## Features at a Glance

✅ Calendar grid with past/today/future days  
✅ Actual spending display with itemized details  
✅ Linear regression predictions for future days  
✅ Recurring charge detection (fixed monthly bills)  
✅ Budget comparison with over/under status  
✅ AI-powered save/invest suggestions  
✅ Mock mode fallback (no API keys required)  
✅ LocalStorage persistence (budget, accountId)  
✅ Single-page component design  
✅ Responsive layout  

## Deployment

Ready to deploy! Both frontend and backend are serverless-compatible:
- Frontend: Vercel, Netlify (static)
- Backend: Railway, Render, Fly.io (Python)

Set environment variables in your deployment platform.

## License

Built for HackTX 2025 - MIT License
