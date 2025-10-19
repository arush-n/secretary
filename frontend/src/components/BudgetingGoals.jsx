import React, { useState, useEffect } from 'react'
import secretaryLogo from '../assets/logo.png'

// BudgetCalendar Component (integrated)
function BudgetCalendar({ 
  allMonthsTransactions, 
  allMonthsPredictions, 
  monthlyIncome, 
  totalSpending, 
  budgets, 
  recurringExpenses, 
  actualSpent, 
  projectedTotal,
  monthlyBudget,
  onMonthChange
}) {
  const [selectedDay, setSelectedDay] = useState(null)
  const [geminiAdvice, setGeminiAdvice] = useState('')
  const [loading, setLoading] = useState(false)
  
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [viewYear, setViewYear] = useState(new Date().getFullYear())

  const now = new Date()
  const isCurrentMonth = viewMonth === now.getMonth() && viewYear === now.getFullYear()
  const today = isCurrentMonth ? now.getDate() : null

  const monthKey = `${viewYear}-${viewMonth}`
  const transactions = allMonthsTransactions[monthKey] || []
  const predictions = allMonthsPredictions[monthKey] || {}

  useEffect(() => {
    if (onMonthChange) {
      onMonthChange(viewYear, viewMonth)
    }
  }, [viewMonth, viewYear])

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay()
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December']

  const getTransactionsByDay = () => {
    const byDay = {}
    transactions.forEach(t => {
      const day = parseInt(t.date.split('-')[2])
      if (!byDay[day]) byDay[day] = []
      byDay[day].push(t)
    })
    return byDay
  }

  const transactionsByDay = getTransactionsByDay()

  const getDayTotal = (day) => {
    const dayTransactions = transactionsByDay[day] || []
    return dayTransactions.reduce((sum, t) => sum + (t.type === 'debit' ? t.amount : 0), 0)
  }

  const currentActualSpent = transactions
    .filter(t => t.type === 'debit')
    .reduce((sum, t) => sum + t.amount, 0)

  const predictedFutureSpend = Object.values(predictions).reduce((sum, val) => sum + val, 0)
  
  const fixedCharges = transactions.filter(t => t.isFixed)
  const futureFixedCharges = fixedCharges
    .filter(t => parseInt(t.date.split('-')[2]) > (today || daysInMonth))
    .reduce((sum, t) => sum + t.amount, 0)

  const currentProjectedTotal = isCurrentMonth ? (currentActualSpent + predictedFutureSpend + futureFixedCharges) : currentActualSpent

  const remaining = isCurrentMonth ? (monthlyBudget - currentProjectedTotal) : (monthlyBudget - currentActualSpent)
  const isOverBudget = remaining < 0

  const askGemini = () => {
    setLoading(true)
    setTimeout(() => {
      setGeminiAdvice('Consider allocating your surplus into a high-yield savings account or investing in diversified index funds. With your current savings rate, you could build a solid emergency fund within 6 months.')
      setLoading(false)
    }, 1000)
  }
  
  const goToPreviousMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(viewYear - 1)
    } else {
      setViewMonth(viewMonth - 1)
    }
    setSelectedDay(null)
    setGeminiAdvice('')
  }
  
  const goToNextMonth = () => {
    const now = new Date()
    if (viewYear === now.getFullYear() && viewMonth === now.getMonth()) return
    
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(viewYear + 1)
    } else {
      setViewMonth(viewMonth + 1)
    }
    setSelectedDay(null)
    setGeminiAdvice('')
  }
  
  const goToCurrentMonth = () => {
    const now = new Date()
    setViewMonth(now.getMonth())
    setViewYear(now.getFullYear())
    setSelectedDay(null)
    setGeminiAdvice('')
  }

  const renderCalendar = () => {
    const cells = []

    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push(<div key={`empty-${i}`} className="h-24 bg-gray-950 border border-gray-800 rounded"></div>)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayTotal = getDayTotal(day)
      const isPast = !isCurrentMonth || day < today
      const isToday = isCurrentMonth && day === today
      const isFuture = isCurrentMonth && day > today
      const predicted = predictions[day] || 0
      const dayTransactions = transactionsByDay[day] || []
      const hasFixed = dayTransactions.some(t => t.isFixed)

      cells.push(
        <div
          key={day}
          onClick={() => (isPast || isToday) && setSelectedDay(day)}
          className={`h-24 p-2 border rounded cursor-pointer transition-all relative
            ${isToday ? 'bg-gray-800 border-gray-600' : 'bg-gray-950 border-gray-800'}
            ${(isPast || isToday) && 'hover:bg-gray-900'}
            ${isFuture && 'bg-gray-900/50'}
          `}
        >
          <div className="text-xs font-light text-gray-400">{day}</div>
          {(isPast || isToday) && dayTotal > 0 && (
            <div className="mt-1">
              <div className="text-base font-light text-green-400">
                ${dayTotal.toFixed(2)}
              </div>
              {hasFixed && (
                <div className="text-xs text-orange-400">📌</div>
              )}
            </div>
          )}
          {isFuture && predicted > 0 && (
            <div className="mt-1">
              <div className="text-base font-light text-gray-600">
                ~${predicted.toFixed(2)}
              </div>
              <div className="text-[10px] text-gray-700">predicted</div>
            </div>
          )}
        </div>
      )
    }

    return cells
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-light text-white">calendar view</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={goToPreviousMonth}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-sm"
          >
            ← Previous
          </button>
          {isCurrentMonth ? (
            <span className="text-sm font-light text-gray-400 min-w-[180px] text-center">
              {monthNames[viewMonth]} {viewYear}
            </span>
          ) : (
            <button
              onClick={goToCurrentMonth}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors min-w-[180px] text-sm"
            >
              Today
            </button>
          )}
          <button
            onClick={goToNextMonth}
            disabled={isCurrentMonth}
            className={`px-4 py-2 rounded-lg transition-colors text-sm ${
              isCurrentMonth 
                ? 'bg-gray-900 text-gray-600 cursor-not-allowed' 
                : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            Next →
          </button>
        </div>
      </div>

      {/* Budget Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-3">monthly budget</div>
          <div className="text-3xl font-light text-white">{formatCurrency(monthlyBudget)}</div>
          <div className="text-xs text-gray-500 mt-1">income - savings</div>
        </div>

        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-3">{isCurrentMonth ? 'spent so far' : 'total spent'}</div>
          <div className="text-3xl font-light text-white">{formatCurrency(currentActualSpent)}</div>
        </div>

        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-3">{isCurrentMonth ? 'projected total' : 'final total'}</div>
          <div className="text-3xl font-light text-white">{formatCurrency(currentProjectedTotal)}</div>
        </div>

        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-3">status</div>
          <div className={`text-2xl font-light ${isOverBudget ? 'text-red-400' : 'text-green-400'}`}>
            {isCurrentMonth ? (
              isOverBudget 
                ? `⚠️ Over ${formatCurrency(Math.abs(remaining))}`
                : `✓ ${formatCurrency(remaining)} Left`
            ) : (
              currentActualSpent <= monthlyBudget
                ? `✓ Under ${formatCurrency(monthlyBudget - currentActualSpent)}`
                : `⚠️ Over ${formatCurrency(currentActualSpent - monthlyBudget)}`
            )}
          </div>
        </div>
      </div>

      {/* AI Insights */}
      {monthlyBudget > 0 && isCurrentMonth && (
        <div className={`bg-black border rounded-lg p-6 ${isOverBudget ? 'border-red-500/30' : 'border-green-500/30'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-2 h-2 rounded-full ${isOverBudget ? 'bg-red-400' : 'bg-green-400'}`}></div>
            <h3 className="text-lg font-medium text-white">
              {isOverBudget ? 'Budget Alert' : 'Smart Insights'}
            </h3>
          </div>
          <p className={`text-base mb-4 ${isOverBudget ? 'text-red-300' : 'text-green-300'}`}>
            {isOverBudget 
              ? `You're on pace to exceed your budget by ${formatCurrency(Math.abs(remaining))}. Consider reducing discretionary spending.`
              : `You have ${formatCurrency(remaining)} remaining this month. Great job staying on track!`
            }
          </p>
          {!isOverBudget && (
            <div>
              {!geminiAdvice ? (
                <button
                  onClick={askGemini}
                  disabled={loading}
                  className="px-6 py-2 bg-white text-black rounded-lg hover:bg-gray-200 font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {loading ? 'Thinking...' : 'Get Financial Advice'}
                </button>
              ) : (
                <div className="flex items-start gap-4 p-4 bg-gray-900 border border-gray-800 rounded-lg">
                  <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                    <img 
                      src={secretaryLogo} 
                      alt="Secretary" 
                      className="w-12 h-12 object-contain"
                    />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white mb-2">Secretary</div>
                    <p className="text-sm text-gray-300 leading-relaxed">{geminiAdvice}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Calendar */}
      <div className="bg-black border border-gray-800 rounded-lg p-6">
        <h3 className="text-xl font-medium text-white mb-4">
          {monthNames[viewMonth]} {viewYear}
        </h3>
        
        {/* Legend */}
        <div className="flex gap-6 mb-4 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-800 border border-gray-600 rounded"></div>
            <span>today</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-950 border border-gray-800 rounded"></div>
            <span>past days</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-900/50 border border-gray-800 rounded"></div>
            <span>future days</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-orange-400">📌</span>
            <span>fixed charge</span>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-2">
          {renderCalendar()}
        </div>
      </div>

      {/* Transaction Details Modal */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={() => setSelectedDay(null)}>
          <div 
            className="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-medium text-white">
                {monthNames[viewMonth]} {selectedDay}, {viewYear}
              </h3>
              <button
                onClick={() => setSelectedDay(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-2">
              {transactionsByDay[selectedDay]?.map(t => (
                <div key={t.id} className="flex justify-between items-center py-3 border-b border-gray-800">
                  <div>
                    <div className="font-medium text-white">{t.merchant}</div>
                    <div className="text-sm text-gray-400">{t.description}</div>
                    {t.isFixed && <span className="text-xs text-orange-400">📌 Fixed Charge</span>}
                  </div>
                  <div className="text-lg font-medium text-red-400">
                    {formatCurrency(t.amount)}
                  </div>
                </div>
              ))}
              
              <div className="pt-4 flex justify-between items-center font-medium">
                <div className="text-white">Total</div>
                <div className="text-xl text-white">
                  {formatCurrency(getDayTotal(selectedDay))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Main BudgetingGoals Component
function BudgetingGoals() {
  const [budgets, setBudgets] = useState([])
  const [goals, setGoals] = useState([])
  const [recurringExpenses, setRecurringExpenses] = useState([])
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [totalSpending, setTotalSpending] = useState(0)
  const [availableForSavings, setAvailableForSavings] = useState(0)
  const [monthlyBudget, setMonthlyBudget] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  
  // Transaction data for all months
  const [allMonthsTransactions, setAllMonthsTransactions] = useState({})
  const [allMonthsPredictions, setAllMonthsPredictions] = useState({})
  const [actualSpent, setActualSpent] = useState(0)
  const [projectedTotal, setProjectedTotal] = useState(0)

  const [newBudget, setNewBudget] = useState({
    category: '',
    amount: '',
    type: 'flexible'
  })

  const [newGoal, setNewGoal] = useState({
    name: '',
    targetAmount: '',
    currentAmount: 0,
    savingsAllocation: 10,
    deadline: ''
  })

  useEffect(() => {
    fetchBudgetData()
  }, [])

  useEffect(() => {
    calculateFinancials()
  }, [budgets, recurringExpenses, goals, actualSpent, projectedTotal, monthlyIncome])

  const generateTransactionsForMonth = (year, month, isCurrentMonth = false) => {
    const mockTransactions = []
    const now = new Date()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = now.getDate()
    const daysToGenerate = isCurrentMonth ? today : daysInMonth
    
    // Generate daily variable spending
    for (let day = 1; day <= daysToGenerate; day++) {
      const numTransactions = Math.floor(Math.random() * 3) + 1
      for (let i = 0; i < numTransactions; i++) {
        mockTransactions.push({
          id: `mock-${year}-${month}-${day}-${i}`,
          date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          amount: Math.random() * 99 + 1, // $1-$100 per transaction
          merchant: ['Starbucks', 'Whole Foods', 'Amazon', 'Uber', 'Target', 'CVS', 'Shell Gas', 'Chipotle'][Math.floor(Math.random() * 8)],
          description: 'Daily expense',
          type: 'debit'
        })
      }
    }

    return mockTransactions
  }

  const generateFixedChargesForMonth = (year, month, expenses) => {
    const fixed = []
    expenses.slice(0, 3).forEach((exp, idx) => {
      fixed.push({
        id: `fixed-${year}-${month}-${idx}`,
        date: `${year}-${String(month + 1).padStart(2, '0')}-${String(idx * 5 + 1).padStart(2, '0')}`,
        amount: exp.average_amount,
        merchant: exp.description,
        description: exp.category,
        type: 'debit',
        isFixed: true
      })
    })
    return fixed
  }

  const fetchBudgetData = async () => {
    try {
      setIsLoading(true)
      
      const mockRecurringExpenses = [
        { description: 'Property Management', category: 'Housing', average_amount: 1450, frequency: 'Monthly' },
        { description: 'Verizon', category: 'Utilities', average_amount: 95, frequency: 'Monthly' },
        { description: 'Internet & Cable', category: 'Utilities', average_amount: 85, frequency: 'Monthly' },
        { description: 'Car Insurance', category: 'Transportation', average_amount: 120, frequency: 'Monthly' },
        { description: 'Gym Membership', category: 'Health', average_amount: 45, frequency: 'Monthly' },
        { description: 'Netflix', category: 'Entertainment', average_amount: 15, frequency: 'Monthly' },
        { description: 'Spotify', category: 'Entertainment', average_amount: 11, frequency: 'Monthly' },
      ]
      
      setRecurringExpenses(mockRecurringExpenses)
      
      const now = new Date()
      const currentMonth = now.getMonth()
      const currentYear = now.getFullYear()
      const today = now.getDate()
      
      const transactionsByMonth = {}
      const predictionsByMonth = {}
      
      // Generate data for last 3 months + current month
      for (let i = 3; i >= 0; i--) {
        let month = currentMonth - i
        let year = currentYear
        
        if (month < 0) {
          month += 12
          year -= 1
        }
        
        const isCurrentMonth = month === currentMonth && year === currentYear
        const monthKey = `${year}-${month}`
        
        const variableTransactions = generateTransactionsForMonth(year, month, isCurrentMonth)
        const fixedCharges = generateFixedChargesForMonth(year, month, mockRecurringExpenses)
        
        transactionsByMonth[monthKey] = [...variableTransactions, ...fixedCharges]
        
        // Generate predictions only for current month
        if (isCurrentMonth && variableTransactions.length > 0) {
          const variableSpend = variableTransactions.reduce((sum, t) => sum + t.amount, 0)
          const avgDailySpend = variableSpend / variableTransactions.length
          const predictionsObj = {}
          const daysInMonth = new Date(year, month + 1, 0).getDate()
          
          for (let day = today; day <= daysInMonth; day++) {
            predictionsObj[day] = parseFloat((avgDailySpend + (Math.random() - 0.5) * 20).toFixed(2))
          }
          predictionsByMonth[monthKey] = predictionsObj
        }
      }
      
      setAllMonthsTransactions(transactionsByMonth)
      setAllMonthsPredictions(predictionsByMonth)
      
      // Calculate current month spending
      const currentMonthKey = `${currentYear}-${currentMonth}`
      const currentTransactions = transactionsByMonth[currentMonthKey] || []
      
      const spent = currentTransactions
        .filter(t => t.type === 'debit')
        .reduce((sum, t) => sum + t.amount, 0)
      setActualSpent(spent)

      // Calculate projected total
      const currentPredictions = predictionsByMonth[currentMonthKey] || {}
      const predictedFutureSpend = Object.values(currentPredictions).reduce((sum, val) => sum + val, 0)
      const fixedCharges = currentTransactions.filter(t => t.isFixed)
      const futureFixedCharges = fixedCharges
        .filter(t => parseInt(t.date.split('-')[2]) > today)
        .reduce((sum, t) => sum + t.amount, 0)
      
      setProjectedTotal(spent + predictedFutureSpend + futureFixedCharges)
      
      // Mock income (2 paychecks if past mid-month)
      let totalIncome = 0
      if (today >= 15) {
        totalIncome = 5000 // Two paychecks
      } else if (today >= 1) {
        totalIncome = 2500 // One paycheck
      }
      setMonthlyIncome(totalIncome)
      
      const savedBudgets = JSON.parse(localStorage.getItem('budgets') || '[]')
      const savedGoals = JSON.parse(localStorage.getItem('goals') || '[]')
      
      setBudgets(savedBudgets)
      setGoals(savedGoals)
      
    } catch (err) {
      console.error('Error fetching budget data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const calculateFinancials = () => {
    // Calculate total savings allocation from goals
    const totalSavingsAllocation = goals.reduce((sum, goal) => {
      const monthlyContribution = (monthlyIncome * goal.savingsAllocation) / 100
      return sum + monthlyContribution
    }, 0)
    
    // Monthly budget = Income - Savings
    const budget = monthlyIncome - totalSavingsAllocation
    setMonthlyBudget(budget)
    
    // Use actual spending from transactions
    setTotalSpending(actualSpent)
    
    const available = monthlyIncome - projectedTotal - totalSavingsAllocation
    setAvailableForSavings(available)
  }

  const handleMonthChange = (year, month) => {
    // If month doesn't have data, generate it
    const monthKey = `${year}-${month}`
    if (!allMonthsTransactions[monthKey]) {
      const variableTransactions = generateTransactionsForMonth(year, month, false)
      const fixedCharges = generateFixedChargesForMonth(year, month, recurringExpenses)
      
      setAllMonthsTransactions(prev => ({
        ...prev,
        [monthKey]: [...variableTransactions, ...fixedCharges]
      }))
    }
  }

  const addBudget = () => {
    if (!newBudget.category || !newBudget.amount) return
    
    const budget = {
      id: Date.now(),
      ...newBudget,
      amount: parseFloat(newBudget.amount)
    }
    
    const updated = [...budgets, budget]
    setBudgets(updated)
    localStorage.setItem('budgets', JSON.stringify(updated))
    
    setNewBudget({ category: '', amount: '', type: 'flexible' })
    setShowBudgetModal(false)
  }

  const deleteBudget = (id) => {
    const updated = budgets.filter(b => b.id !== id)
    setBudgets(updated)
    localStorage.setItem('budgets', JSON.stringify(updated))
  }

  const addGoal = () => {
    if (!newGoal.name || !newGoal.targetAmount) return
    
    const goal = {
      id: Date.now(),
      ...newGoal,
      targetAmount: parseFloat(newGoal.targetAmount),
      currentAmount: parseFloat(newGoal.currentAmount || 0),
      createdAt: new Date().toISOString()
    }
    
    const updated = [...goals, goal]
    setGoals(updated)
    localStorage.setItem('goals', JSON.stringify(updated))
    
    setNewGoal({ name: '', targetAmount: '', currentAmount: 0, savingsAllocation: 10, deadline: '' })
    setShowGoalModal(false)
  }

  const deleteGoal = (id) => {
    const updated = goals.filter(g => g.id !== id)
    setGoals(updated)
    localStorage.setItem('goals', JSON.stringify(updated))
  }

  const calculateGoalProjection = (goal) => {
    const remaining = goal.targetAmount - goal.currentAmount
    const monthlyContribution = (monthlyIncome * goal.savingsAllocation) / 100
    
    if (monthlyContribution <= 0) return { months: Infinity, achievable: false, monthlyContribution: 0 }
    
    const months = Math.ceil(remaining / monthlyContribution)
    const projectedDate = new Date()
    projectedDate.setMonth(projectedDate.getMonth() + months)
    
    return {
      months,
      projectedDate: projectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      monthlyContribution,
      achievable: true
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const getCategoryIcon = (category) => {
    const icons = {
      'Food': '🍔',
      'Entertainment': '🎬',
      'Shopping': '🛍️',
      'Transportation': '🚗',
      'Healthcare': '⚕️',
      'Education': '📚',
      'Personal': '👤',
      'Other': '📦'
    }
    return icons[category] || '📦'
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">loading budget data...</p>
        </div>
      </div>
    )
  }

  const savingsRate = monthlyIncome > 0 ? ((availableForSavings / monthlyIncome) * 100) : 0
  const totalSavingsAllocation = goals.reduce((sum, goal) => (monthlyIncome * goal.savingsAllocation) / 100 + sum, 0)

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-light text-white">budgeting & goals</h1>
        <p className="text-gray-500 mt-1 text-sm">manage your budget and track your financial goals</p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8 flex gap-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-3 rounded-lg font-medium ${
            activeTab === 'overview' ? 'bg-white text-black' : 'bg-gray-900 text-gray-400 hover:text-white'
          }`}
        >
          overview
        </button>
        <button
          onClick={() => setActiveTab('budgets')}
          className={`px-6 py-3 rounded-lg font-medium ${
            activeTab === 'budgets' ? 'bg-white text-black' : 'bg-gray-900 text-gray-400 hover:text-white'
          }`}
        >
          budgets
        </button>
        <button
          onClick={() => setActiveTab('goals')}
          className={`px-6 py-3 rounded-lg font-medium ${
            activeTab === 'goals' ? 'bg-white text-black' : 'bg-gray-900 text-gray-400 hover:text-white'
          }`}
        >
          goals
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`px-6 py-3 rounded-lg font-medium ${
            activeTab === 'calendar' ? 'bg-white text-black' : 'bg-gray-900 text-gray-400 hover:text-white'
          }`}
        >
          calendar
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <div className="text-sm text-gray-400 mb-2">monthly income</div>
              <div className="text-3xl font-light text-green-400">{formatCurrency(monthlyIncome)}</div>
            </div>
            
            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <div className="text-sm text-gray-400 mb-2">monthly budget</div>
              <div className="text-3xl font-light text-blue-400">{formatCurrency(monthlyBudget)}</div>
              <div className="text-xs text-gray-500 mt-1">
                income - savings ({formatCurrency(totalSavingsAllocation)})
              </div>
            </div>
            
            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <div className="text-sm text-gray-400 mb-2">spent so far</div>
              <div className="text-3xl font-light text-red-400">{formatCurrency(actualSpent)}</div>
              <div className="text-xs text-gray-500 mt-1">
                actual spending to date
              </div>
            </div>
            
            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <div className="text-sm text-gray-400 mb-2">projected total</div>
              <div className={`text-3xl font-light ${projectedTotal > monthlyBudget ? 'text-orange-400' : 'text-white'}`}>
                {formatCurrency(projectedTotal)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                estimated month-end
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-medium text-white mb-4">spending breakdown</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-white font-medium">spent so far</span>
                    <span className="text-sm text-red-400">
                      {formatCurrency(actualSpent)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-3">
                    <div 
                      className="bg-red-500 h-3 rounded-full" 
                      style={{ 
                        width: `${monthlyBudget > 0 ? Math.min((actualSpent / monthlyBudget * 100), 100) : 0}%` 
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-white font-medium">predicted future spend</span>
                    <span className="text-sm text-orange-400">
                      {formatCurrency(projectedTotal - actualSpent)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-3">
                    <div 
                      className="bg-orange-500 h-3 rounded-full" 
                      style={{ 
                        width: `${monthlyBudget > 0 ? Math.min(((projectedTotal - actualSpent) / monthlyBudget * 100), 100) : 0}%` 
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-white font-medium">budget remaining</span>
                    <span className={`text-sm ${(monthlyBudget - projectedTotal) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(monthlyBudget - projectedTotal)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full ${(monthlyBudget - projectedTotal) >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ 
                        width: `${monthlyBudget > 0 ? Math.min(Math.abs((monthlyBudget - projectedTotal) / monthlyBudget * 100), 100) : 0}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-white">Active Goals</h3>
                <button
                  onClick={() => setShowGoalModal(true)}
                  className="text-sm text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg"
                >
                  + add goal
                </button>
              </div>
              
              {goals.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <p className="text-sm">no goals set yet</p>
                  <p className="text-xs mt-1">create a goal to start saving!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {goals.slice(0, 3).map(goal => {
                    const progress = (goal.currentAmount / goal.targetAmount) * 100
                    const projection = calculateGoalProjection(goal)
                    
                    return (
                      <div key={goal.id} className="p-4 bg-gray-900 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="text-white font-medium">{goal.name}</h4>
                            <p className="text-xs text-gray-400 mt-1">
                              {projection.achievable ? `Est. ${projection.months} months` : 'Adjust budget to achieve'}
                            </p>
                          </div>
                          <span className="text-sm text-white">
                            {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2 mb-1">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all" 
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500">{progress.toFixed(0)}% complete</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg p-6 mb-8">
            <div className="flex items-start gap-3">
              <span className="text-3xl">💡</span>
              <div className="flex-1">
                <h3 className="text-white font-medium mb-2">Smart Insights</h3>
                <div className="space-y-2 text-sm text-gray-300">
                  {savingsRate < 10 && (
                    <p>• your savings rate is below the recommended 20%. consider reviewing your spending habits.</p>
                  )}
                  {(monthlyBudget - projectedTotal) < 0 && (
                    <p className="text-red-400">• ⚠️ you're projected to overspend this month! review your expenses and cut discretionary spending.</p>
                  )}
                  {(monthlyBudget - projectedTotal) > monthlyIncome * 0.3 && (
                    <p className="text-green-400">• 🎉 excellent! you're staying well within budget. consider increasing goal allocations.</p>
                  )}
                  {goals.length === 0 && (
                    <p>• set specific financial goals to stay motivated and track your progress.</p>
                  )}
                  {projectedTotal > actualSpent * 1.5 && (
                    <p className="text-yellow-400">• your projected spending is significantly higher than current spending. monitor your expenses closely.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Budgets Tab */}
      {activeTab === 'budgets' && (
        <>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-medium text-white">Your Budgets</h2>
              <p className="text-sm text-gray-400 mt-1">Manage your spending limits by category</p>
            </div>
            <button
              onClick={() => setShowBudgetModal(true)}
              className="bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              + Create Budget
            </button>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <span>🔒</span>
              Mandatory Expenses (Recurring)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recurringExpenses.map((expense, idx) => (
                <div key={idx} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="text-white font-medium text-sm">{expense.description}</h4>
                      <p className="text-xs text-gray-500 mt-1">{expense.category}</p>
                    </div>
                    <span className="text-lg font-light text-red-400">
                      {formatCurrency(expense.average_amount)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {expense.frequency} • Fixed
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <span>📊</span>
              Discretionary Budgets
            </h3>
            
            {budgets.length === 0 ? (
              <div className="text-center text-gray-500 py-12 bg-gray-900 rounded-lg">
                <p className="text-lg mb-2">No budgets created yet</p>
                <p className="text-sm">Create budgets for categories like dining out, entertainment, shopping, etc.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {budgets.map(budget => (
                  <div key={budget.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 relative group">
                    <button
                      onClick={() => deleteBudget(budget.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white p-1.5 rounded-lg text-xs"
                    >
                      Delete
                    </button>
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-2xl">{getCategoryIcon(budget.category)}</span>
                      <div className="flex-1">
                        <h4 className="text-white font-medium">{budget.category}</h4>
                        <p className="text-xs text-gray-500 capitalize">{budget.type} budget</p>
                      </div>
                    </div>
                    <div className="text-2xl font-light text-white mb-1">
                      {formatCurrency(budget.amount)}
                    </div>
                    <div className="text-xs text-gray-500">per month</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Goals Tab */}
      {activeTab === 'goals' && (
        <>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-medium text-white">Your Financial Goals</h2>
              <p className="text-sm text-gray-400 mt-1">Track progress and see when you'll reach your goals</p>
            </div>
            <button
              onClick={() => setShowGoalModal(true)}
              className="bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              + Create Goal
            </button>
          </div>

          {goals.length === 0 ? (
            <div className="text-center text-gray-500 py-12 bg-gray-900 rounded-lg">
              <span className="text-5xl mb-4 block">🎯</span>
              <p className="text-lg mb-2">No goals set yet</p>
              <p className="text-sm">Create financial goals like emergency fund, vacation, down payment, etc.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {goals.map(goal => {
                const progress = (goal.currentAmount / goal.targetAmount) * 100
                const projection = calculateGoalProjection(goal)
                const remaining = goal.targetAmount - goal.currentAmount
                
                return (
                  <div key={goal.id} className="bg-gray-900 border border-gray-800 rounded-lg p-6 relative group">
                    <button
                      onClick={() => deleteGoal(goal.id)}
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                    >
                      Delete Goal
                    </button>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2">
                        <h3 className="text-2xl font-light text-white mb-2">{goal.name}</h3>
                        
                        <div className="flex items-center gap-4 mb-4">
                          <div>
                            <span className="text-sm text-gray-400">Progress: </span>
                            <span className="text-lg font-medium text-white">
                              {formatCurrency(goal.currentAmount)}
                            </span>
                            <span className="text-gray-500"> / {formatCurrency(goal.targetAmount)}</span>
                          </div>
                          <div className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
                            {progress.toFixed(0)}% Complete
                          </div>
                        </div>

                        <div className="w-full bg-gray-800 rounded-full h-4 mb-4">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-4 rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Remaining</div>
                            <div className="text-lg font-medium text-white">{formatCurrency(remaining)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Allocation</div>
                            <div className="text-lg font-medium text-white">{goal.savingsAllocation}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Monthly Contribution</div>
                            <div className="text-lg font-medium text-green-400">
                              {formatCurrency(projection.monthlyContribution)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-black border border-gray-700 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-400 mb-3">📊 Projection</h4>
                        
                        {projection.achievable ? (
                          <>
                            <div className="mb-4">
                              <div className="text-xs text-gray-500 mb-1">Estimated Time</div>
                              <div className="text-2xl font-light text-white mb-1">
                                {projection.months} months
                              </div>
                              <div className="text-xs text-gray-400">
                                Target: {projection.projectedDate}
                              </div>
                            </div>

                            {goal.deadline && (
                              <div className="pt-3 border-t border-gray-800">
                                <div className="text-xs text-gray-500 mb-1">Your Deadline</div>
                                <div className="text-sm text-white">
                                  {new Date(goal.deadline).toLocaleDateString('en-US', { 
                                    month: 'long', 
                                    day: 'numeric',
                                    year: 'numeric' 
                                  })}
                                </div>
                                {new Date(goal.deadline) < new Date(projection.projectedDate) && (
                                  <div className="text-xs text-orange-400 mt-1">
                                    ⚠️ May miss deadline. Increase allocation.
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-sm text-red-400">
                            ⚠️ Not enough savings available. Review your budget to allocate more funds.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Calendar Tab */}
      {activeTab === 'calendar' && (
        <BudgetCalendar 
          allMonthsTransactions={allMonthsTransactions}
          allMonthsPredictions={allMonthsPredictions}
          monthlyIncome={monthlyIncome}
          totalSpending={totalSpending}
          budgets={budgets}
          recurringExpenses={recurringExpenses}
          actualSpent={actualSpent}
          projectedTotal={projectedTotal}
          monthlyBudget={monthlyBudget}
          onMonthChange={handleMonthChange}
        />
      )}

      {/* Add Budget Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowBudgetModal(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-md w-full m-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-medium text-white mb-4">Create New Budget</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-2">Category</label>
                <select
                  value={newBudget.category}
                  onChange={(e) => setNewBudget({...newBudget, category: e.target.value})}
                  className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
                >
                  <option value="">Select Category</option>
                  <option value="Food">Food & Dining</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Transportation">Transportation</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Education">Education</option>
                  <option value="Personal">Personal Care</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-2">Monthly Amount</label>
                <input
                  type="number"
                  value={newBudget.amount}
                  onChange={(e) => setNewBudget({...newBudget, amount: e.target.value})}
                  placeholder="500"
                  className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-2">Type</label>
                <select
                  value={newBudget.type}
                  onChange={(e) => setNewBudget({...newBudget, type: e.target.value})}
                  className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
                >
                  <option value="flexible">Flexible (Can adjust)</option>
                  <option value="mandatory">Mandatory (Fixed)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBudgetModal(false)}
                className="flex-1 bg-gray-800 text-white px-4 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addBudget}
                className="flex-1 bg-white text-black px-4 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Create Budget
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowGoalModal(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-md w-full m-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-medium text-white mb-4">Create New Goal</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-2">Goal Name</label>
                <input
                  type="text"
                  value={newGoal.name}
                  onChange={(e) => setNewGoal({...newGoal, name: e.target.value})}
                  placeholder="Emergency Fund"
                  className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-2">Target Amount</label>
                <input
                  type="number"
                  value={newGoal.targetAmount}
                  onChange={(e) => setNewGoal({...newGoal, targetAmount: e.target.value})}
                  placeholder="10000"
                  className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-2">Current Amount (Optional)</label>
                <input
                  type="number"
                  value={newGoal.currentAmount}
                  onChange={(e) => setNewGoal({...newGoal, currentAmount: e.target.value})}
                  placeholder="0"
                  className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-2">
                  Savings Allocation ({newGoal.savingsAllocation}% of income)
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={newGoal.savingsAllocation}
                  onChange={(e) => setNewGoal({...newGoal, savingsAllocation: parseInt(e.target.value)})}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1%</span>
                  <span className="text-white font-medium">
                    {formatCurrency((monthlyIncome * newGoal.savingsAllocation) / 100)}/month
                  </span>
                  <span>50%</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-2">Target Deadline (Optional)</label>
                <input
                  type="date"
                  value={newGoal.deadline}
                  onChange={(e) => setNewGoal({...newGoal, deadline: e.target.value})}
                  className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowGoalModal(false)}
                className="flex-1 bg-gray-800 text-white px-4 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addGoal}
                className="flex-1 bg-white text-black px-4 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Create Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BudgetingGoals