import { NextRequest, NextResponse } from 'next/server';
import { NessieClient } from '@/lib/nessie-client';
import { processTransactions } from '@/lib/tagging';

export async function POST(request: NextRequest) {
  try {
    const { apiKey, customerId } = await request.json();

    if (!apiKey || !customerId) {
      return NextResponse.json(
        { error: 'API key and customer ID are required' },
        { status: 400 }
      );
    }

    const client = new NessieClient(apiKey);

    // Fetch accounts and transactions
    const accounts = await client.getAccounts(customerId);
    const transactions = await client.getAllTransactions(customerId);

    // Process transactions through tagging pipeline
    const processedTransactions = processTransactions(transactions);

    return NextResponse.json({
      customer: { id: customerId, name: 'Customer' },
      accounts,
      transactions: processedTransactions,
    });
  } catch (error) {
    console.error('Nessie API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch data from Nessie' },
      { status: 500 }
    );
  }
}
