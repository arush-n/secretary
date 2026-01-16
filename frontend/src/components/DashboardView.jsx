import React, { useState, useEffect } from 'react'
import Summary from './Summary'
import NetWorthCard from './NetWorthCard'
import BudgetOverview from './BudgetOverview'
import AssetsLiabilities from './AssetsLiabilities'
import RecentTransactions from './RecentTransactions'

function DashboardView() {
  const [dashboardData, setDashboardData] = useState(null)
  const [aiSummary, setAiSummary] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Backend API URL (Plaid integration is handled by the backend)
  const BACKEND_URL = 'http://localhost:5001'

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      console.log('Fetching from Plaid via backend API...')

      // Fetch accounts from backend Plaid endpoint
      const accountsResponse = await fetch(`${BACKEND_URL}/api/plaid/accounts`)

      if (!accountsResponse.ok) {
        console.warn('Plaid API failed, using mock data')
        const mockData = generateMockData()
        setDashboardData(mockData.dashboardData)
        setAiSummary(mockData.aiSummary)
        setIsLoading(false)
        return
      }

      const accountsResult = await accountsResponse.json()
      const accountsData = accountsResult.accounts || []
      console.log('Accounts fetched:', accountsData)

      // Fetch transactions from backend Plaid endpoint
      const transactionsResponse = await fetch(`${BACKEND_URL}/api/plaid/transactions`)

      let allTransactions = []
      if (transactionsResponse.ok) {
        const transactionsResult = await transactionsResponse.json()
        allTransactions = transactionsResult.transactions || []
        console.log('Transactions fetched:', allTransactions.length)
      }

      // Separate purchases and deposits based on amount sign
      // Plaid: positive = expense (debit), negative = income (credit)
      const allPurchases = allTransactions
        .filter(t => t.amount > 0)
        .map(t => ({
          _id: t.transaction_id,
          purchase_date: t.date,
          amount: t.amount,
          description: t.merchant_name || t.name,
          merchant_id: t.merchant_name,
          account_id: t.account_id,
          type: 'debit'
        }))

      const allDeposits = allTransactions
        .filter(t => t.amount < 0)
        .map(t => ({
          _id: t.transaction_id,
          transaction_date: t.date,
          amount: Math.abs(t.amount),
          description: t.merchant_name || t.name,
          account_id: t.account_id,
          type: 'credit'
        }))

      console.log('Total purchases:', allPurchases.length)
      console.log('Total deposits:', allDeposits.length)

      // Transform Plaid accounts to expected format
      const transformedAccounts = accountsData.map(acc => ({
        _id: acc.account_id,
        type: acc.type === 'depository'
          ? (acc.subtype === 'checking' ? 'Checking' : 'Savings')
          : acc.type === 'credit' ? 'Credit Card' : acc.type,
        balance: acc.balance?.current || 0,
        nickname: acc.name
      }))

      // Process the data
      const processedData = processPlaidData(transformedAccounts, allPurchases, allDeposits)
      setDashboardData(processedData.dashboardData)
      setAiSummary(processedData.aiSummary)

    } catch (err) {
      console.error('Error in fetchDashboardData:', err)

      // Fall back to mock data
      const mockData = generateMockData()
      setDashboardData(mockData.dashboardData)
      setAiSummary(mockData.aiSummary)
    } finally {
      setIsLoading(false)
    }
  }

  const processPlaidData = (accounts, purchases, deposits) => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    const today = now.getDate()

    console.log('Processing Plaid data...')

    // Format purchases as transactions
    const purchaseTransactions = purchases.map(p => ({
      id: p._id,
      date: p.purchase_date,
      amount: p.amount,
      merchant: p.merchant_id || 'Unknown Merchant',
      description: p.description || 'Purchase',
      category: determineCategory(p.description || ''),
      type: 'debit'
    }))

    // Format deposits as transactions
    const depositTransactions = deposits.map(d => ({
      id: d._id,
      date: d.transaction_date,
      amount: d.amount,
      merchant: d.description || 'Direct Deposit',
      description: d.description || 'Deposit',
      category: 'Income',
      type: 'credit'
    }))

    let allTransactions = [...purchaseTransactions, ...depositTransactions]

    console.log('Formatted transactions:', allTransactions.length)

    // If no real transactions, generate mock data
    if (allTransactions.length === 0) {
      console.log('No transactions from API, generating mock data')
      return generateMockData()
    }

    // Sort by date
    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date))

    // Filter for current month
    const currentMonthTransactions = allTransactions.filter(t => {
      const transDate = new Date(t.date)
      return transDate.getMonth() === currentMonth && transDate.getFullYear() === currentYear
    })

    console.log('Current month transactions:', currentMonthTransactions.length)

    // Calculate daily spending for chart
    const dailySpending = []
    for (let day = 1; day <= today; day++) {
      const dayTransactions = currentMonthTransactions.filter(t => {
        const transDate = new Date(t.date)
        return transDate.getDate() === day && t.type === 'debit'
      })

      const dayTotal = dayTransactions.reduce((sum, t) => sum + t.amount, 0)
      dailySpending.push({ day, amount: dayTotal })
    }

    dailySpending.sort((a, b) => a.day - b.day)

    const totalIncome = currentMonthTransactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0)
    const totalSpending = currentMonthTransactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0)

    console.log('Total income:', totalIncome)
    console.log('Total spending:', totalSpending)

    // Calculate account balances
    let checkingBalance = 0
    let savingsBalance = 0
    let creditCardBalance = 0

    accounts.forEach(account => {
      const balance = account.balance || 0

      if (account.type === 'Checking') {
        checkingBalance += balance
      } else if (account.type === 'Savings') {
        savingsBalance += balance
      } else if (account.type === 'Credit Card') {
        creditCardBalance += Math.abs(balance)
      }
    })

    const totalAssets = checkingBalance + savingsBalance
    const totalLiabilities = creditCardBalance
    const netWorth = totalAssets - totalLiabilities

    console.log('Net worth:', netWorth)

    // Budget calculations
    const monthlyBudget = totalIncome > 0 ? totalIncome - (totalIncome * 0.15) : 4600 // Default budget if no income
    const avgDailySpending = totalSpending > 0 ? totalSpending / today : 0
    const projectedSpending = totalSpending + (avgDailySpending * (30 - today))

    const budget = {
      monthly_income: totalIncome,
      monthly_budget: monthlyBudget,
      spent_so_far: totalSpending,
      projected_total: projectedSpending,
      remaining: monthlyBudget - projectedSpending,
      daily_spending: dailySpending,
      status: projectedSpending > monthlyBudget ? 'over' : 'on-track'
    }

    const assets_liabilities = {
      checking: checkingBalance,
      savings: savingsBalance,
      credit_card: creditCardBalance,
      total_assets: totalAssets,
      total_liabilities: totalLiabilities
    }

    // Calculate daily net worth changes
    const dailyNetWorthData = []

    // Start with initial net worth (before this month's transactions)
    let initialNetWorth = totalAssets - totalLiabilities + totalSpending - totalIncome
    let runningNetWorth = initialNetWorth

    for (let day = 1; day <= today; day++) {
      // Get transactions for this day
      const dayTransactions = currentMonthTransactions.filter(t => {
        const transDate = new Date(t.date)
        return transDate.getDate() === day
      })

      // Calculate income and spending for the day
      const dayIncome = dayTransactions
        .filter(t => t.type === 'credit')
        .reduce((sum, t) => sum + t.amount, 0)

      const daySpending = dayTransactions
        .filter(t => t.type === 'debit')
        .reduce((sum, t) => sum + t.amount, 0)

      // Update net worth (income increases it, spending decreases it)
      runningNetWorth = runningNetWorth + dayIncome - daySpending

      dailyNetWorthData.push({
        day: day,
        netWorth: runningNetWorth,
        income: dayIncome,
        spending: daySpending
      })
    }

    console.log('Daily net worth data:', dailyNetWorthData)

    const aiSummary = generateAISummary(totalSpending, monthlyBudget, netWorth, currentMonthTransactions, budget.remaining)

    return {
      dashboardData: {
        net_worth: netWorth,
        budget: budget,
        assets_liabilities: assets_liabilities,
        transactions: allTransactions.slice(0, 20),
        daily_asset_data: dailyNetWorthData
      },
      aiSummary: aiSummary
    }
  }

  const determineCategory = (description) => {
    const desc = description.toLowerCase()

    if (desc.includes('starbucks') || desc.includes('coffee') || desc.includes('restaurant') || desc.includes('food')) {
      return 'Food'
    }
    if (desc.includes('grocery') || desc.includes('whole foods') || desc.includes('market')) {
      return 'Groceries'
    }
    if (desc.includes('uber') || desc.includes('lyft') || desc.includes('gas') || desc.includes('transport')) {
      return 'Transportation'
    }
    if (desc.includes('amazon') || desc.includes('shopping') || desc.includes('store')) {
      return 'Shopping'
    }
    if (desc.includes('movie') || desc.includes('netflix') || desc.includes('entertainment')) {
      return 'Entertainment'
    }

    return 'Other'
  }

  const generateMockData = () => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    const today = now.getDate()

    console.log('Generating mock data...')

    const transactions = []
    const dailySpending = []

    // Generate daily transactions ($1-$100)
    for (let day = 1; day <= today; day++) {
      const numTransactions = Math.floor(Math.random() * 3) + 1
      let dayTotal = 0

      for (let i = 0; i < numTransactions; i++) {
        const amount = Math.random() * 99 + 1
        dayTotal += amount

        transactions.push({
          id: `trans-${day}-${i}`,
          date: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          amount: amount,
          merchant: ['Starbucks', 'Whole Foods', 'Amazon', 'Uber', 'Target', 'CVS', 'Shell Gas', 'Chipotle'][Math.floor(Math.random() * 8)],
          description: 'Purchase',
          category: ['Food', 'Groceries', 'Shopping', 'Transportation', 'Entertainment'][Math.floor(Math.random() * 5)],
          type: 'debit'
        })
      }

      dailySpending.push({ day: day, amount: dayTotal })
    }

    // Add fixed charges
    const fixedCharges = [
      { day: 1, amount: 1450, merchant: 'Property Management', category: 'Housing' },
      { day: 5, amount: 95, merchant: 'Verizon', category: 'Utilities' },
      { day: 10, amount: 85, merchant: 'Internet & Cable', category: 'Utilities' }
    ]

    fixedCharges.forEach(charge => {
      if (charge.day <= today) {
        transactions.push({
          id: `fixed-${charge.day}`,
          date: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(charge.day).padStart(2, '0')}`,
          amount: charge.amount,
          merchant: charge.merchant,
          description: charge.category,
          category: charge.category,
          type: 'debit',
          isFixed: true
        })

        const existingDay = dailySpending.find(d => d.day === charge.day)
        if (existingDay) {
          existingDay.amount += charge.amount
        }
      }
    })

    // Add income
    if (today >= 1) {
      transactions.push({
        id: 'income-1',
        date: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`,
        amount: 2600,
        merchant: 'Employer Direct Deposit',
        description: 'Salary',
        category: 'Income',
        type: 'credit'
      })
    }

    if (today >= 15) {
      transactions.push({
        id: 'income-2',
        date: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-15`,
        amount: 2600,
        merchant: 'Employer Direct Deposit',
        description: 'Salary',
        category: 'Income',
        type: 'credit'
      })
    }

    transactions.sort((a, b) => new Date(b.date) - new Date(a.date))
    dailySpending.sort((a, b) => a.day - b.day)

    const totalIncome = transactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0)
    const totalSpending = transactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0)

    const checkingBalance = 3500
    const savingsBalance = 15000
    const creditCardBalance = 2300

    const netWorth = checkingBalance + savingsBalance - creditCardBalance

    const monthlyBudget = totalIncome - (totalIncome * 0.15)
    const projectedSpending = totalSpending + (totalSpending / today * (30 - today))

    const budget = {
      monthly_income: totalIncome,
      monthly_budget: monthlyBudget,
      spent_so_far: totalSpending,
      projected_total: projectedSpending,
      remaining: monthlyBudget - projectedSpending,
      daily_spending: dailySpending,
      status: projectedSpending > monthlyBudget ? 'over' : 'on-track'
    }

    const assets_liabilities = {
      checking: checkingBalance,
      savings: savingsBalance,
      credit_card: creditCardBalance,
      total_assets: checkingBalance + savingsBalance,
      total_liabilities: creditCardBalance
    }

    // Calculate daily net worth changes
    const dailyNetWorthData = []

    // Start with initial net worth (before this month's transactions)
    const initialNetWorth = (checkingBalance + savingsBalance - creditCardBalance) + totalSpending - totalIncome
    let runningNetWorth = initialNetWorth

    for (let day = 1; day <= today; day++) {
      // Get transactions for this day
      const dayTransactions = transactions.filter(t => {
        const transDate = new Date(t.date)
        return transDate.getDate() === day
      })

      // Calculate income and spending for the day
      const dayIncome = dayTransactions
        .filter(t => t.type === 'credit')
        .reduce((sum, t) => sum + t.amount, 0)

      const daySpending = dayTransactions
        .filter(t => t.type === 'debit')
        .reduce((sum, t) => sum + t.amount, 0)

      // Update net worth (income increases it, spending decreases it)
      runningNetWorth = runningNetWorth + dayIncome - daySpending

      dailyNetWorthData.push({
        day: day,
        netWorth: runningNetWorth,
        income: dayIncome,
        spending: daySpending
      })
    }

    const aiSummary = generateAISummary(totalSpending, monthlyBudget, netWorth, transactions, budget.remaining)

    return {
      dashboardData: {
        net_worth: netWorth,
        budget: budget,
        assets_liabilities: assets_liabilities,
        transactions: transactions,
        daily_asset_data: dailyNetWorthData
      },
      aiSummary: aiSummary
    }
  }

  const generateAISummary = (totalSpending, monthlyBudget, netWorth, transactions, remaining) => {
    const spendingTrend = totalSpending < monthlyBudget * 0.5 ? 'under control' :
      totalSpending > monthlyBudget * 0.8 ? 'running high' : 'on track'

    const topCategories = transactions
      .filter(t => t.type === 'debit' && !t.isFixed)
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount
        return acc
      }, {})

    const topCategory = Object.entries(topCategories).sort((a, b) => b[1] - a[1])[0]

    return `Your spending is ${spendingTrend} this month. You've spent $${totalSpending.toFixed(0)} of your $${monthlyBudget.toFixed(0)} budget. ${topCategory ? `Your highest spending category is ${topCategory[0]} at $${topCategory[1].toFixed(0)}.` : ''
      } Your net worth is $${netWorth.toLocaleString()}. ${remaining > 0
        ? `You have $${remaining.toFixed(0)} remaining for the month.`
        : `You're projected to exceed your budget by $${Math.abs(remaining).toFixed(0)}.`
      }`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-gray-400">loading your financial data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">⚠️ error</div>
          <p className="text-gray-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-white text-black rounded hover:bg-gray-200"
          >
            retry
          </button>
        </div>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">no data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-8 pb-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light text-white mb-2">financial dashboard</h1>
            <p className="text-gray-500 text-sm">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toLowerCase()}
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-8 pt-6">

        {/* Net Worth Section */}
        <div className="mb-8">
          <NetWorthCard
            netWorth={dashboardData.net_worth}
            dailyData={dashboardData.daily_asset_data || []}
          />
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Budget Overview */}
          <div className="lg:col-span-1">
            <BudgetOverview budget={dashboardData.budget} />
          </div>

          {/* Assets & Liabilities */}
          <div className="lg:col-span-2">
            <AssetsLiabilities assetsLiabilities={dashboardData.assets_liabilities} />
          </div>
        </div>

        {/* AI Summary */}
        <div className="mb-8">
          <Summary summary={aiSummary} />
        </div>

        {/* Recent Transactions */}
        <div>
          <RecentTransactions transactions={dashboardData.transactions} />
        </div>

      </div>
    </div>
  )
}

export default DashboardView