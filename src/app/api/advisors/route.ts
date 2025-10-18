import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Transaction, Account } from '@/lib/schema';

export async function POST(request: NextRequest) {
  try {
    const { transactions, accounts, apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key is required' },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    // Prepare data summary for analysis
    const summary = prepareDataSummary(transactions, accounts);

    // Multi-agent orchestrator pattern
    const advisorReports = await Promise.all([
      runBudgetCoach(model, summary),
      runSavingsPlanner(model, summary),
      runRiskWatch(model, summary),
      runSubscriptionsSniper(model, summary),
    ]);

    // Synthesize into final report
    const report = {
      highlights: advisorReports.flatMap(r => r.highlights).slice(0, 5),
      actions: advisorReports.flatMap(r => r.actions).slice(0, 5),
      cautions: advisorReports.flatMap(r => r.cautions).slice(0, 3),
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(report);
  } catch (error) {
    console.error('Advisors error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate advisor report' },
      { status: 500 }
    );
  }
}

function prepareDataSummary(transactions: Transaction[], accounts: Account[]) {
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const monthlySpend = transactions
    .filter(t => t.type === 'debit' && isThisMonth(t.date))
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  const recurringCosts = transactions
    .filter(t => t.isRecurring && t.type === 'debit')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const categorySpend = transactions
    .filter(t => t.type === 'debit')
    .reduce((acc, t) => {
      const cat = t.category || 'Other';
      acc[cat] = (acc[cat] || 0) + Math.abs(t.amount);
      return acc;
    }, {} as Record<string, number>);

  return {
    totalBalance,
    monthlySpend,
    recurringCosts,
    categorySpend,
    transactionCount: transactions.length,
    anomalyCount: transactions.filter(t => t.isAnomaly).length,
  };
}

function isThisMonth(date: string) {
  const txDate = new Date(date);
  const now = new Date();
  return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
}

async function runBudgetCoach(model: any, summary: any) {
  const prompt = `You are a BudgetCoach advisor. Analyze this financial data and provide budgeting insights:

Total Balance: $${summary.totalBalance.toFixed(2)}
Monthly Spend (MTD): $${summary.monthlySpend.toFixed(2)}
Category Breakdown: ${JSON.stringify(summary.categorySpend)}

Provide 1-2 highlights, 1-2 actionable recommendations, and 0-1 cautions. Be concise and specific.
Format as JSON: { "highlights": ["..."], "actions": ["..."], "cautions": ["..."] }`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return parseAdvisorResponse(text);
}

async function runSavingsPlanner(model: any, summary: any) {
  const prompt = `You are a SavingsPlanner advisor. Analyze this financial data for savings opportunities:

Total Balance: $${summary.totalBalance.toFixed(2)}
Monthly Spend: $${summary.monthlySpend.toFixed(2)}
Recurring Costs: $${summary.recurringCosts.toFixed(2)}

Provide 1-2 highlights about saving potential, 1-2 specific actions, and 0-1 cautions.
Format as JSON: { "highlights": ["..."], "actions": ["..."], "cautions": ["..."] }`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return parseAdvisorResponse(text);
}

async function runRiskWatch(model: any, summary: any) {
  const prompt = `You are a RiskWatch advisor. Analyze this financial data for risks:

Anomaly Count: ${summary.anomalyCount}
Monthly Spend: $${summary.monthlySpend.toFixed(2)}
Category Spend: ${JSON.stringify(summary.categorySpend)}

Provide 1 highlight about financial risks, 1-2 risk mitigation actions, and 1-2 cautions.
Format as JSON: { "highlights": ["..."], "actions": ["..."], "cautions": ["..."] }`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return parseAdvisorResponse(text);
}

async function runSubscriptionsSniper(model: any, summary: any) {
  const prompt = `You are a SubscriptionsSniper advisor. Analyze this data for subscription optimization:

Recurring Costs: $${summary.recurringCosts.toFixed(2)}
Category Spend: ${JSON.stringify(summary.categorySpend)}

Identify 1-2 subscription insights and 1-2 specific actions to optimize recurring costs.
Format as JSON: { "highlights": ["..."], "actions": ["..."], "cautions": ["..."] }`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return parseAdvisorResponse(text);
}

function parseAdvisorResponse(text: string) {
  try {
    // Remove markdown code blocks if present
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      highlights: parsed.highlights || [],
      actions: parsed.actions || [],
      cautions: parsed.cautions || [],
    };
  } catch (err) {
    console.error('Failed to parse advisor response:', err);
    return { highlights: [], actions: [], cautions: [] };
  }
}
