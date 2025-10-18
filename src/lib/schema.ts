// Core domain types
export interface Customer {
  id: string;
  name: string;
}

export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit';
  balance: number;
  openedAt: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  description: string;
  merchant?: string;
  type: 'debit' | 'credit';
  category?: string;
  isRecurring?: boolean;
  isAnomaly?: boolean;
  needWant?: 'need' | 'want';
}

export interface AdvisorReport {
  highlights: string[];
  actions: string[];
  cautions: string[];
  timestamp: string;
}

export interface AppSettings {
  mode: 'mock' | 'live';
  nessieApiKey?: string;
  nessieCustomerId?: string;
  geminiApiKey?: string;
}

// Nessie API response types (simplified)
export interface NessieAccount {
  _id: string;
  type: string;
  nickname: string;
  rewards: number;
  balance: number;
  customer_id: string;
}

export interface NessiePurchase {
  _id: string;
  type: string;
  transaction_date: string;
  status: string;
  merchant_id: string;
  medium: string;
  purchase_date: string;
  amount: number;
  description: string;
}
