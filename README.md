# Secretary – AI-Powered Personal Finance Copilot

Secretary is a full‑stack personal finance workspace that blends mock banking data from Capital One's Nessie API with Google Gemini powered analysis. It delivers a slick, dark themed dashboard for tracking budgets, net worth, recurring expenses, vacation planning, investments, and AI assisted financial chat – all backed by a Flask API.

## Highlights

- **Unified dashboard** – Net worth, assets vs. liabilities, income vs. spend, and recent activity in one view.
- **Smart transactions** – AI categorisation with manual overrides, tag management, split transactions, and persistent category colors.
- **Conversational AI** – Ask for personalised advice, budgeting tips, or widget deep dives even when Gemini is offline (graceful fallbacks are built in).
- **Planning tools** – Budget goals, recurring expense detection, vacation inspiration with live flight pricing, and investment hooks.
- **Modern UX** – Vite + React + Tailwind deliver a smooth, dark themed interface inspired by modern finance apps.

## Repository Layout

```
secretary/
├── backend/
│   ├── app.py                # Flask API exposing finance, AI, and Nessie utilities
│   ├── requirements.txt      # Backend dependencies
│   └── data/
│       └── categories.json   # Auto-managed category color store
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Root React app + tab routing
│   │   ├── index.css         # Global styles + custom scrollbars
│   │   ├── utils/
│   │   │   └── categoryColors.js # Deterministic color/icon helpers
│   │   └── components/       # Dashboard, Transactions, Settings, etc.
│   ├── package.json          # Frontend scripts + deps
│   └── vite.config.js        # Vite dev/build configuration
├── README.md                 # You are here
└── BUDGET_CALENDAR_README.md # Legacy calendar write-up
```

## Prerequisites

- **Python 3.10+** and **pip**
- **Node.js 18+** and **npm**
- Capital One **Nessie API key** (mock banking data)
- Google **Gemini API key** (AI features). The app will fall back to canned responses when Gemini is unavailable, but an API key is required for full capability.

## Backend Setup (Flask)

```powershell
cd backend
python -m venv ..\.venv
..\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create a `.env` file alongside `app.py`:

```
NESSIE_API_KEY=your_nessie_api_key
GEMINI_API_KEY=your_gemini_api_key
SEARCH_API_KEY=optional_searchapi_key   # enables cheap flight lookups
```

Launch the API (port 5001 by default):

```powershell
python app.py
```

### Data persistence

- Category names and their colors are stored in `backend/data/categories.json`. The file is created automatically the first time categories are edited through the UI or `/set-categories` endpoint.
- Transaction edits (category overrides, splits, notes, tags, deletions) are cached in memory via `TRANSACTION_UPDATES`. Swap this for a database layer before production use.

## Frontend Setup (React + Vite)

```powershell
cd frontend
npm install
npm run dev
```

By default Vite serves the app at `http://localhost:3002/`. Use `npm run dev -- --host` to expose it on your LAN.

### Environment assumptions

The frontend expects the backend to be reachable at `http://localhost:5001`. If you change ports or hostnames, update `API_BASE` constants inside frontend components (e.g. `Transactions.jsx`, `EnhancedTransactionRow.jsx`).

## Key Features in Detail

### Transactions workspace

- Timeline view grouped by date with fast filters (all, income, expenses, per-category chips).
- Inline editing for description, date, notes, tags, exclusion, and deletion.
- Category dropdown backed by persisted colors; selects POST to `/update-transaction` and the backend echoes the color via `category_color`.
- Transaction split modal supporting category allocations and notes per split.

### Settings center

- Bank connection mock (Plaid-style) for demos.
- Category manager with color persistence (`/get-categories` / `/set-categories`).
- Tag organizer for transaction tagging.
- Preference ordering for future personalisation features.

### Dashboard & analytics

- Net worth, income vs. spend, savings estimates, and asset/liability composition using Nessie account + purchase data.
- Recent transactions include local overrides (splits, notes, category changes).
- Recurring expense detector combines Nessie bills, loans, and pattern mining.

### AI integrations

- `/chat/financial-advice` provides advisor personas. When Gemini is unreachable the endpoint returns a deterministic fallback so the UI never breaks.
- `/get-vacation-suggestions` and `/ask-ai-widget` use Gemini to create itineraries and widget level insights.
- `/categorize-transactions` and `/get-ai-summary` lean on Gemini but gracefully degrade to rule-based defaults when needed.

## Major API Endpoints

| Method | Route | Purpose |
| ------ | ----- | ------- |
| GET    | `/get-categories`        | Returns category metadata `{ name, color }[]` |
| POST   | `/set-categories`        | Persists categories (names + optional colors) |
| GET    | `/get-tags`              | Returns available tags |
| POST   | `/set-tags`              | Persists tag list |
| POST   | `/update-transaction`    | Applies edits; adds `category_color` when category provided |
| POST   | `/delete-transaction`    | Soft delete toggle |
| GET    | `/get-all-transactions`  | Aggregated Nessie data + AI category hints |
| GET    | `/get-dashboard-data`    | Net worth / budget metrics |
| GET    | `/get-recurring-expenses`| Bills, loans, and detected recurring charges |
| POST   | `/get-vacation-suggestions` | Gemini generated travel picks |
| POST   | `/chat/financial-advice` | AI chat advisor with offline fallback |

*(See `backend/app.py` for the full list including stock advisor hooks.)*

## Typical Development Flow

1. Start Flask: `python app.py`
2. Start Vite: `npm run dev`
3. Open `http://localhost:3002/`
4. Navigate via the left sidebar tabs (Dashboard, Transactions, Recurring, Budgeting, Chat, Vacations, Investments, Settings).

Hot module replacement is enabled, so frontend edits refresh instantly. Backend changes require a manual restart (or add `flask --reload`).

## Troubleshooting & Tips

- **API keys** – Missing Nessie or Gemini keys will surface as 400/500 responses. Check the terminal logs for descriptive errors.
- **Gemini outages** – The chat endpoint returns a fallback payload with `"fallback": true`. Frontend already handles this gracefully.
- **Category colors** – If colors look inconsistent, ensure `backend/data/categories.json` is writable. Delete it to reset to defaults.
- **NPM path issues on Windows** – Run PowerShell as Administrator the first time to allow script execution (`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`).
- **Port conflicts** – Use `npm run dev -- --port 3003` or edit Vite config if 3002 is busy.

## Roadmap Ideas

- Persist transaction updates in a real datastore (PostgreSQL or SQLite).
- OAuth based bank linking and multi-user auth.
- Broader Gemini persona support with structured evaluation.
- Exportable financial reports and budgeting alerts.

---

Secretary started as a hackathon proof of concept and has grown into a capable personal finance cockpit. Contributions, bug reports, and feature ideas are always welcome! Submit issues or PRs and outline repro steps plus screenshots where possible.
