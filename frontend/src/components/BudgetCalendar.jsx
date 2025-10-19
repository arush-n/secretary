import React, { useState, useEffect } from 'react'
import logo from '../assets/logo.png'

const BudgetCalendar = () => {
  const [budget, setBudget] = useState(() => {
    const saved = localStorage.getItem('monthlyBudget')
    return saved || '3720' // Default to expenses budget from dashboard
  })
  const [transactions, setTransactions] = useState([])
  const [predictions, setPredictions] = useState({})
  const [fixedCharges, setFixedCharges] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [geminiAdvice, setGeminiAdvice] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Month navigation
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [viewYear, setViewYear] = useState(new Date().getFullYear())

  const now = new Date()
  const isCurrentMonth = viewMonth === now.getMonth() && viewYear === now.getFullYear()
  const today = isCurrentMonth ? now.getDate() : null

  // Get days in current month
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay()
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December']

  const loadMockData = () => {
    setLoading(true)
    setError(null)
    
    const mockTransactions = []
    const daysToGenerate = isCurrentMonth ? today : daysInMonth
    
    // Generate daily variable spending for past days
    for (let day = 1; day <= daysToGenerate; day++) {
      const numTransactions = Math.floor(Math.random() * 3) + 1
      for (let i = 0; i < numTransactions; i++) {
        mockTransactions.push({
          id: `mock-${day}-${i}`,
          date: `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          amount: Math.random() * 40 + 40, // $40-$80 per transaction
          merchant: ['Starbucks', 'Whole Foods', 'Amazon', 'Uber', 'Target', 'CVS'][Math.floor(Math.random() * 6)],
          description: 'Daily expense',
          type: 'debit'
        })
      }
    }

    // Add some fixed charges (only for past months or current month)
    const fixed = []
    if (viewYear < now.getFullYear() || (viewYear === now.getFullYear() && viewMonth <= now.getMonth())) {
      fixed.push(
        {
          id: 'fixed-rent',
          date: `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`,
          amount: 1450,
          merchant: 'Property Management',
          description: 'Rent',
          type: 'debit',
          isFixed: true
        },
        {
          id: 'fixed-phone',
          date: `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-05`,
          amount: 95,
          merchant: 'Verizon',
          description: 'Phone bill',
          type: 'debit',
          isFixed: true
        }
      )
    }

    setTransactions([...mockTransactions, ...fixed])
    setFixedCharges(fixed)

    // Simple predictions (only for current month) - use average instead of increasing trend
    if (isCurrentMonth && mockTransactions.length > 0) {
      const variableSpend = mockTransactions.reduce((sum, t) => sum + t.amount, 0)
      const avgDailySpend = variableSpend / mockTransactions.length
      const predictionsObj = {}
      // Include prediction for today AND future days
      for (let day = today; day <= daysInMonth; day++) {
        // Use average with small random variance instead of linear trend
        predictionsObj[day] = parseFloat((avgDailySpend + (Math.random() - 0.5) * 10).toFixed(2))
      }
      setPredictions(predictionsObj)
    } else {
      setPredictions({})
    }
    
    setLoading(false)
  }

  useEffect(() => {
    loadMockData()
  }, [viewMonth, viewYear])

  // Group transactions by day
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

  // Calculate totals
  const getDayTotal = (day) => {
    const dayTransactions = transactionsByDay[day] || []
    return dayTransactions.reduce((sum, t) => sum + (t.type === 'debit' ? t.amount : 0), 0)
  }

  const actualSpent = transactions
    .filter(t => t.type === 'debit')
    .reduce((sum, t) => sum + t.amount, 0)

  const predictedFutureSpend = Object.values(predictions).reduce((sum, val) => sum + val, 0)
  
  const futureFixedCharges = fixedCharges
    .filter(t => parseInt(t.date.split('-')[2]) > (today || daysInMonth))
    .reduce((sum, t) => sum + t.amount, 0)

  const projectedTotal = isCurrentMonth ? (actualSpent + predictedFutureSpend + futureFixedCharges) : actualSpent

  const budgetNum = parseFloat(budget) || 0
  const remaining = isCurrentMonth ? (budgetNum - projectedTotal) : (budgetNum - actualSpent)
  const isOverBudget = remaining < 0

  // Ask Gemini for advice
  const askGemini = async () => {
    if (!budget || remaining <= 0) return

    setLoading(true)
    try {
      const response = await fetch('http://localhost:5001/api/gemini/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leeway: Math.abs(remaining),
          context: {
            budget: budgetNum,
            projectedTotal,
            riskTolerance: 'moderate'
          }
        })
      })

      const data = await response.json()
      setGeminiAdvice(data.suggestion || 'Unable to get advice at this time.')
    } catch (err) {
      setGeminiAdvice('AI advice temporarily unavailable. Consider saving any surplus for emergency funds or investing in low-cost index funds.')
    }
    setLoading(false)
  }

  // Save preferences
  const saveBudget = (value) => {
    setBudget(value)
    localStorage.setItem('monthlyBudget', value)
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
    // Don't allow going beyond current month
    if (viewYear === now.getFullYear() && viewMonth === now.getMonth()) {
      return
    }
    
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

  // Render calendar grid
  const renderCalendar = () => {
    const cells = []

    // Empty cells for days before month starts
    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push(<div key={`empty-${i}`} className="h-24 bg-zinc-950 border border-zinc-800 rounded"></div>)
    }

    // Day cells
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
          onClick={() => isPast && setSelectedDay(day)}
          className={`h-24 p-2 border rounded cursor-pointer transition-all relative
            ${isToday ? 'bg-zinc-800 border-zinc-600' : 'bg-zinc-950 border-zinc-800'}
            ${isPast && 'hover:bg-zinc-900'}
            ${isFuture && 'bg-zinc-900/50'}
          `}
        >
          <div className="text-xs font-light text-gray-400">{day}</div>
          {isPast && dayTotal > 0 && (
            <div className="mt-1">
              <div className="text-base font-light text-green-400">
                ${dayTotal.toFixed(2)}
              </div>
              {hasFixed && (
                <div className="text-xs text-orange-400">📌</div>
              )}
            </div>
          )}
          {(isToday || isFuture) && predicted > 0 && (
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

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-8 pb-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light text-white mb-2">budgeting</h1>
            <p className="text-gray-500 text-sm">track spending and forecast budget</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={goToPreviousMonth}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded transition-colors text-sm"
            >
              ← previous
            </button>
            {isCurrentMonth ? (
              <span className="text-sm font-light text-gray-400 min-w-[180px] text-center">
                {monthNames[viewMonth]} {viewYear}
              </span>
            ) : (
              <button
                onClick={goToCurrentMonth}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded transition-colors min-w-[180px] text-sm"
              >
                today
              </button>
            )}
            <button
              onClick={goToNextMonth}
              disabled={isCurrentMonth}
              className={`px-4 py-2 rounded transition-colors text-sm ${
                isCurrentMonth 
                  ? 'bg-gray-900 text-gray-600 cursor-not-allowed' 
                  : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              next →
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-8 pt-6">

        {/* Budget Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          {/* Budget Input */}
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 hover:bg-white/[0.04] transition-all group">
            <div className="text-sm text-gray-400 mb-3 flex items-center gap-2">
              monthly budget
              <svg className="w-3 h-3 text-gray-500 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div className="relative">
              <span className="absolute left-0 top-1 text-3xl font-light text-gray-400">$</span>
              <input
                type="text"
                value={budget ? parseFloat(budget).toLocaleString('en-US') : ''}
                onChange={(e) => {
                  // Remove commas and non-numeric characters except decimal point
                  const numericValue = e.target.value.replace(/[^0-9.]/g, '')
                  saveBudget(numericValue)
                }}
                placeholder="3,720"
                className="w-full pl-6 px-0 py-1 bg-transparent border-none text-3xl font-light text-white focus:outline-none placeholder-gray-600 focus:bg-white/[0.02] rounded transition-colors"
              />
            </div>
          </div>

          {/* Current Stats */}
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 hover:bg-white/[0.04] transition-all">
            <div className="text-sm text-gray-400 mb-3">{isCurrentMonth ? 'spent so far' : 'total spent'}</div>
            <div className="text-3xl font-light text-white">${actualSpent.toFixed(2)}</div>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 hover:bg-white/[0.04] transition-all">
            <div className="text-sm text-gray-400 mb-3">{isCurrentMonth ? 'projected total' : 'budget used'}</div>
            <div className="text-3xl font-light text-white">${isCurrentMonth ? projectedTotal.toFixed(2) : budgetNum.toFixed(2)}</div>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 hover:bg-white/[0.04] transition-all">
            <div className="text-sm text-gray-400 mb-3">status</div>
            <div className={`text-2xl font-light ${isOverBudget ? 'text-red-400' : 'text-green-400'} flex items-center gap-2`}>
              {isCurrentMonth ? (
                isOverBudget 
                  ? <>⚠️ over ${Math.abs(remaining).toFixed(0)}</>
                  : <>✓ ${remaining.toFixed(0)} left</>
              ) : (
                actualSpent <= budgetNum
                  ? <>✓ under ${(budgetNum - actualSpent).toFixed(0)}</>
                  : <>⚠️ over ${(actualSpent - budgetNum).toFixed(0)}</>
              )}
            </div>
          </div>
        </div>

        {/* AI Insights (only for current month) */}
        {budgetNum > 0 && isCurrentMonth && (
          <div className={`mb-8 bg-white/[0.02] border border-white/10 rounded-xl p-6 hover:bg-white/[0.04] transition-all ${isOverBudget ? 'border-red-500/20' : 'border-green-500/20'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-2 h-2 rounded-full ${isOverBudget ? 'bg-red-400' : 'bg-green-400'}`}></div>
              <h3 className="text-lg font-light text-white">
                {isOverBudget ? 'budget alert' : 'smart insights'}
              </h3>
            </div>
            <p className={`text-base font-light mb-4 ${isOverBudget ? 'text-red-300' : 'text-green-300'}`}>
              {isOverBudget 
                ? `you're on pace to exceed your budget by $${Math.abs(remaining).toFixed(2)}. consider reducing discretionary spending.`
                : `you have $${remaining.toFixed(2)} remaining this month. great job staying on track!`
              }
            </p>
            {!isOverBudget && (
              <div>
                {!geminiAdvice ? (
                  <button
                    onClick={askGemini}
                    disabled={loading}
                    className="px-6 py-2 bg-white text-black rounded-lg hover:bg-gray-200 font-light text-sm transition-colors disabled:opacity-50"
                  >
                    {loading ? 'thinking...' : 'get financial advice'}
                  </button>
                ) : (
                  <div className="flex items-start gap-4 p-4 bg-white/[0.02] border border-white/10 rounded-lg">
                    <img src={logo} alt="Secretary" className="w-12 h-12 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-white mb-2">ai secretary</div>
                      <p className="text-sm font-light text-gray-300 leading-relaxed">{geminiAdvice}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Calendar */}
      <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 mb-8">
        <h2 className="text-xl font-light text-white mb-4">
          {monthNames[viewMonth]} {viewYear}
        </h2>
        
        {/* Legend */}
        <div className="flex gap-6 mb-4 text-xs text-gray-500 font-light">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-white/5 border border-white/20 rounded"></div>
            <span>today</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-zinc-950 border border-zinc-800 rounded"></div>
            <span>past days</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-zinc-900/50 border border-zinc-800 rounded"></div>
            <span>future days</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-orange-400">📌</span>
            <span>fixed charge</span>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(day => (
            <div key={day} className="text-center text-xs font-light text-gray-500 py-2">
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
            className="bg-white/[0.02] border border-white/10 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-light text-white">
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
                <div key={t.id} className="flex justify-between items-center py-3 border-b border-zinc-800">
                  <div>
                    <div className="font-light text-white">{t.merchant}</div>
                    <div className="text-sm text-gray-500 font-light">{t.description}</div>
                    {t.isFixed && <span className="text-xs text-orange-400">📌 fixed charge</span>}
                  </div>
                  <div className="text-lg font-light text-red-400">
                    ${t.amount.toFixed(2)}
                  </div>
                </div>
              ))}
              
              <div className="pt-4 flex justify-between items-center font-light">
                <div className="text-white">total</div>
                <div className="text-xl text-white">
                  ${getDayTotal(selectedDay).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  )
}

export default BudgetCalendar