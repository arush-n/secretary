# Secretary - AI Financial Advisor Chat

A single-page, all-black themed chat interface with specialized AI financial advisors powered by Google Gemini.

## 🎯 Features

- **Single Page**: No routing, just one clean chat interface
- **6 Financial Advisors**: Budget Coach, Savings Planner, Risk Watch, Subscriptions Sniper, Investment Advisor, Debt Destroyer
- **All-Black Theme**: High contrast (#000 background, #fff text)
- **Persistent Chat**: Messages and advisor selection saved to localStorage
- **Real AI**: Powered by Google Gemini API (with mock fallback)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Add API Key (Optional)

Create `.env.local` in the root:

```bash
GEMINI_API_KEY=your_google_gemini_api_key_here
```

Get your key from: https://makersuite.google.com/app/apikey

**Note**: Without an API key, the app will return mock responses but still work!

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📖 How It Works

### Chat Interface
- Select an advisor from the dropdown
- Type your financial question
- Get personalized advice based on the advisor's expertise
- Messages persist across page refreshes

### Advisors
Each advisor has a unique persona and expertise:

- **Budget Coach**: Spending limits and money management
- **Savings Planner**: Emergency funds and savings automation
- **Risk Watch**: Financial risks and spending anomalies
- **Subscriptions Sniper**: Recurring charge optimization
- **Investment Advisor**: Investing and wealth building
- **Debt Destroyer**: Debt elimination strategies

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Custom Black Theme
- **AI**: Google Gemini API
- **State**: React hooks + localStorage

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── chat/route.ts      # Gemini API handler
│   ├── page.tsx               # Main chat interface
│   ├── layout.tsx             # Root layout
│   └── globals.css            # Black theme styles
├── data/
│   └── advisors.json          # Advisor definitions
└── components/
    └── ui/                    # Reusable UI components
```

## 🔑 Environment Variables

Create `.env.local`:

```bash
# Required for AI responses (optional - uses mock if not set)
GEMINI_API_KEY=your_key_here

# Alternative variable name (also checked)
NEXT_PUBLIC_GEMINI_API_KEY=your_key_here
```

## � Design

- **All-black theme**: Pure black (#000) background
- **High contrast**: White (#fff) text
- **Minimal UI**: Clean sidebar, focused chat area
- **Treasury.sh inspired**: Simple left navigation rail
- **Rounded corners**: Subtle borders and smooth edges

## 💬 Usage Tips

1. **Start a conversation**: Type a financial question
2. **Switch advisors**: Change advisor mid-conversation for different perspectives
3. **About advisor**: Click "About" to see advisor description
4. **Clear chat**: Use "Clear Chat" button in sidebar
5. **Keyboard shortcuts**: Enter to send, Shift+Enter for new line

## 🔒 Privacy & Security

- **API key never exposed**: Handled server-side only
- **No database**: Stateless architecture
- **Local storage only**: Messages saved in browser only
- **No tracking**: Zero analytics or data collection

## 🚢 Deployment

```bash
npm run build
npm start
```

Deploy to Vercel, Netlify, or any Node.js host. Set `GEMINI_API_KEY` in your hosting platform's environment variables.

## 🧪 Mock Mode

Without a Gemini API key, the app returns:
> "I'm a mock advisor response. Set GEMINI_API_KEY in your .env.local file to enable real AI responses..."

This lets you test the UI without an API key!

## 📄 License

MIT - Built for HackTX 2024

## 🙏 Credits

- Advisor personas inspired by: [ai-hedge-fund](https://github.com/virattt/ai-hedge-fund/)
- UI inspiration: [treasury.sh](https://treasury.sh)
- AI: [Google Gemini](https://ai.google.dev/)

---

**Simple, focused, ready to demo** 🚀
