# Secretary - Personal Finance Dashboard

A hackathon project that creates a personal finance dashboard using Capital One's Nessie API for mock bank data and Google Gemini API for AI-powered insights and transaction categorization.

## Project Structure

```
secretary-hackathon/
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   └── .env (create this file with your API keys)
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Header.jsx
    │   │   ├── Summary.jsx
    │   │   └── TransactionList.jsx
    │   ├── App.jsx
    │   ├── index.css
    │   └── main.jsx
    ├── index.html
    ├── package.json
    ├── tailwind.config.js
    ├── postcss.config.js
    └── vite.config.js
```

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd secretary-hackathon/backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create a `.env` file with your API keys:
   ```
   NESSIE_API_KEY=your_nessie_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

5. Run the Flask server:
   ```bash
   python app.py
   ```

The backend will run on `http://localhost:5001`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd secretary-hackathon/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The frontend will run on `http://localhost:3000`

## API Keys Required

- **Capital One Nessie API**: Get your API key from [Capital One Developer Portal](https://developer.capitalone.com/)
- **Google Gemini API**: Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

## Features

- **Comprehensive Financial Dashboard**: Complete overview of net worth, budgets, assets, and liabilities
- **Real-time Transaction Data**: Fetches mock bank transactions from Capital One's Nessie API
- **AI-Powered Analysis**: Uses Google Gemini to categorize transactions and provide financial insights
- **Budget Tracking**: Monitor income, expenses, and savings against monthly budgets
- **Assets & Liabilities Breakdown**: Visual representation of financial portfolio
- **Net Worth Tracking**: Track net worth with trend visualization
- **Modern UI**: Clean, dark-themed interface inspired by treasury.sh
- **Responsive Design**: Works on desktop and mobile devices

## Demo Customer ID

The app uses a hardcoded customer ID (`68f3e5a29683f20dd519e4ea`) for demonstration purposes. In a production environment, this would be dynamically determined based on user authentication.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Python + Flask
- **APIs**: Capital One Nessie API + Google Gemini API
- **Styling**: Tailwind CSS with dark theme

## Hackathon Notes

This is a rapid prototype built for a 24-hour Capital One hackathon. The focus is on demonstrating the core concept with a compelling end-to-end user flow rather than production-ready code.
