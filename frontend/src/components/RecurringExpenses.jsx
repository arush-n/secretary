import React, { useState, useEffect } from 'react'

function RecurringExpenses() {
  const [recurringExpenses, setRecurringExpenses] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [totalMonthly, setTotalMonthly] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [viewMode, setViewMode] = useState('list') // 'list' or 'calendar'

  useEffect(() => {
    fetchRecurringExpenses()
  }, [])

  const fetchRecurringExpenses = async () => {
    try {
      setIsLoading(true)
      const customerId = '68f3e5a29683f20dd519e4ea'
      const response = await fetch(`/api/get-recurring-expenses?customerId=${customerId}`)
      
      if (!response.ok) throw new Error('Failed to fetch recurring expenses')
      
      const data = await response.json()
      setRecurringExpenses(data.recurring_expenses || [])
      setTotalMonthly(data.total_monthly || 0)
      
      // Check if using demo data
      if (data.recurring_expenses && data.recurring_expenses.length > 0) {
        const isDemo = data.recurring_expenses[0].source === 'demo'
        if (isDemo) {
          console.log('📊 Using demo recurring expenses data')
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getDaysUntilDue = (nextDueDate) => {
    if (!nextDueDate) return null
    const today = new Date()
    const due = new Date(nextDueDate)
    const diffTime = due - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getDueDateColor = (daysUntil) => {
    if (daysUntil === null) return 'text-gray-500'
    if (daysUntil < 0) return 'text-red-400'
    if (daysUntil <= 3) return 'text-orange-400'
    if (daysUntil <= 7) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getCategoryIcon = (category) => {
    const icons = {
      'Housing': '🏠',
      'Utilities': '💡',
      'Insurance': '🛡️',
      'Subscriptions': '📺',
      'Transportation': '🚗',
      'Phone': '📱',
      'Other': '📦'
    }
    return icons[category] || '📦'
  }

  const getCategoryColor = (category) => {
    const colors = {
      'Housing': 'bg-blue-500',
      'Utilities': 'bg-yellow-500',
      'Insurance': 'bg-purple-500',
      'Subscriptions': 'bg-pink-500',
      'Transportation': 'bg-green-500',
      'Phone': 'bg-indigo-500',
      'Other': 'bg-gray-500'
    }
    return colors[category] || 'bg-gray-500'
  }

  const getFilteredExpenses = () => {
    if (selectedCategory === 'all') return recurringExpenses
    return recurringExpenses.filter(exp => exp.category === selectedCategory)
  }

  const getCategoryTotals = () => {
    const totals = {}
    recurringExpenses.forEach(exp => {
      const category = exp.category || 'Other'
      totals[category] = (totals[category] || 0) + exp.average_amount
    })
    return totals
  }

  const getUpcomingExpenses = () => {
    return recurringExpenses
      .map(exp => ({
        ...exp,
        daysUntil: getDaysUntilDue(exp.next_due)
      }))
      .filter(exp => exp.daysUntil !== null && exp.daysUntil >= 0 && exp.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil)
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">Analyzing recurring expenses...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  const filteredExpenses = getFilteredExpenses()
  const categoryTotals = getCategoryTotals()
  const upcomingExpenses = getUpcomingExpenses()
  const isDemoData = recurringExpenses.length > 0 && recurringExpenses[0].source === 'demo'

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-light text-white">Recurring Expenses</h1>
        <p className="text-gray-500 mt-1 text-sm">Track and manage your regular bills</p>
      </div>

      {/* Demo Data Notice */}
      {isDemoData && (
        <div className="mb-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">ℹ️</span>
            <div className="flex-1">
              <h3 className="text-white font-medium mb-1">Demo Data</h3>
              <p className="text-sm text-blue-300">
                Showing realistic demo recurring expenses. The Nessie API has limited transaction data, so we're displaying typical bills, subscriptions, and loan payments you might have.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">Total Monthly</div>
          <div className="text-3xl font-light text-white">{formatCurrency(totalMonthly)}</div>
          <div className="text-xs text-gray-500 mt-2">{recurringExpenses.length} recurring expenses</div>
        </div>
        
        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">Due This Week</div>
          <div className="text-3xl font-light text-orange-400">
            {upcomingExpenses.filter(e => e.daysUntil <= 7).length}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {formatCurrency(upcomingExpenses.filter(e => e.daysUntil <= 7).reduce((sum, e) => sum + e.average_amount, 0))}
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">Largest Expense</div>
          <div className="text-3xl font-light text-red-400">
            {recurringExpenses.length > 0 ? formatCurrency(recurringExpenses[0].average_amount) : '$0.00'}
          </div>
          <div className="text-xs text-gray-500 mt-2 truncate">
            {recurringExpenses.length > 0 ? recurringExpenses[0].description : 'N/A'}
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="mb-8 bg-black border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-medium text-white mb-4">By Category</h3>
        <div className="space-y-3">
          {Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([category, total]) => {
            const percentage = (total / totalMonthly) * 100
            return (
              <div key={category}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getCategoryIcon(category)}</span>
                    <span className="text-sm text-white font-medium">{category}</span>
                  </div>
                  <span className="text-sm text-white">{formatCurrency(total)}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${getCategoryColor(category)}`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
              selectedCategory === 'all' ? 'bg-white text-black' : 'bg-gray-900 text-gray-400 hover:text-white'
            }`}
          >
            All Categories
          </button>
          {Object.keys(categoryTotals).map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex items-center gap-2 ${
                selectedCategory === category ? 'bg-white text-black' : 'bg-gray-900 text-gray-400 hover:text-white'
              }`}
            >
              <span>{getCategoryIcon(category)}</span>
              <span>{category}</span>
            </button>
          ))}
        </div>
        
        <div className="flex gap-2 ml-4">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-white text-black' : 'bg-gray-900 text-gray-400'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`p-2 rounded-lg ${viewMode === 'calendar' ? 'bg-white text-black' : 'bg-gray-900 text-gray-400'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Upcoming Expenses Alert */}
      {upcomingExpenses.length > 0 && (
        <div className="mb-6 bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⏰</span>
            <div className="flex-1">
              <h3 className="text-white font-medium mb-1">Upcoming Bills</h3>
              <p className="text-sm text-orange-300">
                You have {upcomingExpenses.length} bill{upcomingExpenses.length !== 1 ? 's' : ''} due in the next 30 days
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {upcomingExpenses.slice(0, 3).map((exp, idx) => (
                  <div key={idx} className="bg-gray-900 rounded-lg px-3 py-2 text-xs">
                    <span className="text-white font-medium">{exp.description}</span>
                    <span className="text-gray-400 mx-2">•</span>
                    <span className={getDueDateColor(exp.daysUntil)}>
                      {exp.daysUntil === 0 ? 'Today' : exp.daysUntil === 1 ? 'Tomorrow' : `in ${exp.daysUntil} days`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recurring Expenses List/Calendar */}
      {viewMode === 'list' ? (
        <div className="space-y-4">
          {filteredExpenses.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <p className="text-lg">No recurring expenses found</p>
              <p className="text-sm mt-2">We'll detect patterns as you add more transactions</p>
            </div>
          ) : (
            filteredExpenses.map((expense, idx) => {
              const daysUntil = getDaysUntilDue(expense.next_due)
              
              return (
                <div 
                  key={idx}
                  className="bg-gray-900 border border-gray-800 rounded-lg p-5 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`w-12 h-12 ${getCategoryColor(expense.category)} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <span className="text-2xl">{getCategoryIcon(expense.category)}</span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium text-lg mb-1">{expense.description}</h4>
                        
                        <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {expense.frequency}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {expense.occurrences} occurrence{expense.occurrences !== 1 ? 's' : ''}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Last: {formatDate(expense.last_date)}
                          </span>
                        </div>

                        {expense.next_due && (
                          <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 ${getDueDateColor(daysUntil)}`}>
                            <span className="text-sm font-medium">
                              {daysUntil !== null && (
                                daysUntil < 0 ? 'Overdue' :
                                daysUntil === 0 ? 'Due Today' :
                                daysUntil === 1 ? 'Due Tomorrow' :
                                `Due in ${daysUntil} days`
                              )}
                            </span>
                            <span className="text-xs opacity-75">({formatDate(expense.next_due)})</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 ml-4">
                      <div className="text-2xl font-light text-white mb-1">
                        {formatCurrency(expense.average_amount)}
                      </div>
                      <div className="text-xs text-gray-500">per {expense.frequency.toLowerCase()}</div>
                    </div>
                  </div>

                  {/* Show transaction history */}
                  {expense.transactions && expense.transactions.length > 0 && (
                    <details className="mt-4">
                      <summary className="text-xs text-gray-400 cursor-pointer hover:text-white">
                        View transaction history ({expense.transactions.length})
                      </summary>
                      <div className="mt-3 space-y-2 ml-4">
                        {expense.transactions.slice(0, 5).map((t, i) => (
                          <div key={i} className="flex justify-between text-xs text-gray-500">
                            <span>{formatDate(t.date)}</span>
                            <span>{formatCurrency(t.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )
            })
          )}
        </div>
      ) : (
        /* Calendar View */
        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">Next 30 Days</h3>
          <div className="space-y-2">
            {upcomingExpenses.map((expense, idx) => {
              const date = new Date(expense.next_due)
              const daysUntil = expense.daysUntil
              
              return (
                <div key={idx} className="flex items-center gap-4 p-3 bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors">
                  <div className="flex-shrink-0 w-16 text-center">
                    <div className="text-2xl font-light text-white">{date.getDate()}</div>
                    <div className="text-xs text-gray-500 uppercase">{date.toLocaleDateString('en-US', { month: 'short' })}</div>
                  </div>
                  
                  <div className={`w-1 h-12 rounded-full ${getCategoryColor(expense.category)}`}></div>
                  
                  <div className="flex-1">
                    <div className="text-white font-medium">{expense.description}</div>
                    <div className="text-xs text-gray-400">{expense.category}</div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-white font-medium">{formatCurrency(expense.average_amount)}</div>
                    <div className={`text-xs ${getDueDateColor(daysUntil)}`}>
                      {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days`}
                    </div>
                  </div>
                </div>
              )
            })}
            
            {upcomingExpenses.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <p>No expenses due in the next 30 days</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default RecurringExpenses