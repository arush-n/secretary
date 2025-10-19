import React, { useState, useEffect } from 'react'

function RecurringExpenses() {
  const [recurringExpenses, setRecurringExpenses] = useState([])
  const [totalMonthly, setTotalMonthly] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [categories, setCategories] = useState([])
  const [upcomingBills, setUpcomingBills] = useState([])
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all categories')
  const [viewMode, setViewMode] = useState('list') // 'list' or 'grid'

  useEffect(() => {
    fetchRecurringExpenses()
  }, [])

  const fetchRecurringExpenses = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const customerId = '68f3e5a29683f20dd519e4ea'
      
      const response = await fetch(`http://localhost:5001/get-recurring-expenses?customerId=${customerId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch recurring expenses')
      }
      
      const data = await response.json()
      const expenses = data.recurring_expenses || []
      setRecurringExpenses(expenses)
      setTotalMonthly(data.total_monthly || 0)
      
      // Calculate category breakdown
      const categoryBreakdown = calculateCategoryBreakdown(expenses)
      setCategories(categoryBreakdown)
      
      // Calculate upcoming bills (next 30 days)
      const upcoming = calculateUpcomingBills(expenses)
      setUpcomingBills(upcoming)
      
    } catch (err) {
      setError(err.message)
      console.error('Error fetching recurring expenses:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const calculateCategoryBreakdown = (expenses) => {
    const categoryMap = {}
    
    expenses.forEach(expense => {
      const category = expense.category || 'Other'
      if (!categoryMap[category]) {
        categoryMap[category] = {
          name: category,
          amount: 0,
          icon: getCategoryIcon(category),
          color: getCategoryColor(category)
        }
      }
      categoryMap[category].amount += expense.amount
    })
    
    const total = Object.values(categoryMap).reduce((sum, cat) => sum + cat.amount, 0)
    
    return Object.values(categoryMap)
      .map(cat => ({
        ...cat,
        percentage: total > 0 ? (cat.amount / total) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount)
  }

  const calculateUpcomingBills = (expenses) => {
    const today = new Date()
    const thirtyDaysFromNow = new Date(today)
    thirtyDaysFromNow.setDate(today.getDate() + 30)
    
    return expenses
      .map(expense => ({
        ...expense,
        nextDate: new Date(expense.next_date),
        daysUntil: Math.ceil((new Date(expense.next_date) - today) / (1000 * 60 * 60 * 24))
      }))
      .filter(expense => expense.nextDate >= today && expense.nextDate <= thirtyDaysFromNow)
      .sort((a, b) => a.nextDate - b.nextDate)
  }

  const getCategoryIcon = (category) => {
    const icons = {
      'housing': '🏠',
      'transportation': '🚗',
      'utilities': '💡',
      'insurance': '🛡️',
      'phone': '📱',
      'subscriptions': '📺',
      'entertainment': '🎮',
      'fitness': '💪',
      'other': '📋'
    }
    return icons[category] || '📋'
  }

  const getCategoryColor = (category) => {
    const colors = {
      'Housing': { bar: 'bg-indigo-500', bg: 'bg-indigo-500/10', text: 'text-indigo-400' },
      'Transportation': { bar: 'bg-pink-500', bg: 'bg-pink-500/10', text: 'text-pink-400' },
      'Utilities': { bar: 'bg-yellow-500', bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
      'Insurance': { bar: 'bg-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-400' },
      'Phone': { bar: 'bg-red-500', bg: 'bg-red-500/10', text: 'text-red-400' },
      'Subscriptions': { bar: 'bg-cyan-500', bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
      'Entertainment': { bar: 'bg-green-500', bg: 'bg-green-500/10', text: 'text-green-400' },
      'Fitness': { bar: 'bg-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-400' },
      'Other': { bar: 'bg-gray-500', bg: 'bg-gray-500/10', text: 'text-gray-400' }
    }
    return colors[category] || colors['Other']
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getRelativeDate = (daysUntil) => {
    if (daysUntil === 0) return 'Today'
    if (daysUntil === 1) return 'Tomorrow'
    if (daysUntil < 7) return `in ${daysUntil} days`
    if (daysUntil < 14) return `in ${Math.floor(daysUntil / 7)} week`
    return `in ${Math.floor(daysUntil / 7)} weeks`
  }

  const getRelativeDateColor = (daysUntil) => {
    if (daysUntil <= 3) return 'text-red-400'
    if (daysUntil <= 7) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getExpensesForCategory = (categoryName) => {
    if (categoryName === 'All Categories') {
      return recurringExpenses
    }
    return recurringExpenses.filter(expense => expense.category === categoryName)
  }

  const getFrequencyBadgeColor = (frequency) => {
    switch (frequency?.toLowerCase()) {
      case 'monthly':
        return 'bg-white/10 text-gray-300 border-white/20'
      case 'weekly':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'yearly':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">Loading recurring expenses...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div 
          className="bg-red-500/10 border rounded-lg p-6"
          style={{
            border: '2px solid transparent',
            backgroundImage: 'linear-gradient(#18181b, #18181b), linear-gradient(135deg, #991b1b, #dc2626, #991b1b)',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box'
          }}
        >
          <p className="text-red-400">Error: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-8 pb-6 border-b border-white/10">
                <h1 className="text-3xl font-light text-white mb-2">recurring expenses</h1>
        <p className="text-gray-500 text-sm">track and manage your recurring financial commitments</p>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-8 pt-6">
        
        {/* Demo Data Info Banner */}
        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 mb-6 flex items-start gap-3">
          <div className="text-2xl">ℹ️</div>
          <div>
            <p className="text-gray-300 font-medium text-sm">Demo Data</p>
            <p className="text-gray-400 text-xs mt-1">
              Showing realistic demo recurring expenses. The Nessie API has limited transaction data, so we're displaying typical bills, subscriptions, and loan payments you might have.
            </p>
          </div>
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Total Monthly Card */}
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 hover:bg-white/[0.04] transition-all">
            <div className="text-sm text-gray-400 mb-2">Total Monthly</div>
            <div className="text-3xl font-light text-white mb-1">{formatCurrency(totalMonthly)}</div>
            <div className="text-xs text-gray-500">{recurringExpenses.length} recurring expenses</div>
          </div>

          {/* Due This Week Card */}
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 hover:bg-white/[0.04] transition-all">
            <div className="text-sm text-gray-400 mb-2">Due This Week</div>
            <div className="text-3xl font-light text-white mb-1">
              {upcomingBills.filter(b => b.daysUntil <= 7).length}
            </div>
            <div className="text-xs text-gray-500">
              {formatCurrency(upcomingBills.filter(b => b.daysUntil <= 7).reduce((sum, b) => sum + b.amount, 0))}
            </div>
          </div>

          {/* Largest Expense Card */}
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 hover:bg-white/[0.04] transition-all">
            <div className="text-sm text-gray-400 mb-2">Largest Expense</div>
            <div className="text-3xl font-light text-white mb-1">
              {recurringExpenses.length > 0 
                ? formatCurrency(Math.max(...recurringExpenses.map(e => e.amount)))
                : '$0.00'
              }
            </div>
            <div className="text-xs text-gray-500">
              {recurringExpenses.length > 0
                ? recurringExpenses.reduce((max, e) => e.amount > max.amount ? e : max, recurringExpenses[0]).name
                : 'N/A'
              }
            </div>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-3 mb-8 flex-wrap">
          <button
            onClick={() => setSelectedCategoryFilter('All Categories')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedCategoryFilter === 'All Categories'
                ? 'bg-white/10 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
            }`}
          >
            All Categories
          </button>
          {categories.map((category) => (
            <button
              key={category.name}
              onClick={() => setSelectedCategoryFilter(category.name)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                selectedCategoryFilter === category.name
                  ? 'bg-white/10 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
              }`}
            >
              <span>{category.icon}</span>
              <span>{category.name}</span>
            </button>
          ))}
        </div>

        {/* Itemized Expenses Breakdown - Shows when a specific category is selected */}
        {selectedCategoryFilter !== 'All Categories' && (
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">
                {categories.find(c => c.name === selectedCategoryFilter)?.icon}
              </span>
              <div>
                <h2 className="text-xl font-light text-white">{selectedCategoryFilter} Breakdown</h2>
                <p className="text-sm text-gray-400">
                  {getExpensesForCategory(selectedCategoryFilter).length} expense{getExpensesForCategory(selectedCategoryFilter).length !== 1 ? 's' : ''} in this category
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {getExpensesForCategory(selectedCategoryFilter).map((expense) => (
                <div 
                  key={expense.id}
                  className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-lg hover:bg-white/[0.04] transition-all"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <span className="text-2xl">{getCategoryIcon(expense.category || 'Other')}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-white font-light">{expense.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getFrequencyBadgeColor(expense.frequency)}`}>
                          {expense.frequency}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400">
                        Next payment: {formatDate(expense.next_date)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right ml-4">
                    <div className="text-white font-light text-xl">{formatCurrency(expense.amount)}</div>
                    <div className="text-xs text-gray-500">per {expense.frequency?.toLowerCase() || 'month'}</div>
                  </div>
                </div>
              ))}
              
              {/* Total for this category */}
              <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                <div className="text-gray-400 font-medium">Total {selectedCategoryFilter}</div>
                <div className="text-2xl font-light text-white">
                  {formatCurrency(
                    getExpensesForCategory(selectedCategoryFilter).reduce((sum, exp) => sum + exp.amount, 0)
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* By Category Section */}
        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-light text-white">By Category</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'list' ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
                title="List View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'grid' ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
                title="Grid View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              </button>
            </div>
          </div>
          
          {viewMode === 'list' ? (
            <div className="space-y-6">
              {(selectedCategoryFilter === 'All Categories' ? categories : categories.filter(c => c.name === selectedCategoryFilter)).map((category) => (
                <div key={category.name}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{category.icon}</span>
                      <span className="text-white font-light">{category.name}</span>
                    </div>
                    <span className="text-white font-light text-lg">{formatCurrency(category.amount)}</span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={`absolute top-0 left-0 h-full ${category.color.bar} transition-all duration-500`}
                      style={{ width: `${category.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {(selectedCategoryFilter === 'All Categories' ? categories : categories.filter(c => c.name === selectedCategoryFilter)).map((category) => (
                <div 
                  key={category.name}
                  className="bg-white/[0.02] border border-white/5 rounded-lg p-5 hover:bg-white/[0.04] transition-all"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl">{category.icon}</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${category.color.bg} ${category.color.text}`}>
                      {category.percentage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-white font-light mb-1">{category.name}</div>
                  <div className="text-2xl font-light text-white">{formatCurrency(category.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Bills Section */}
        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
          <h2 className="text-xl font-light text-white mb-4">Upcoming Bills</h2>
          <p className="text-sm text-gray-400 mb-6">You have {upcomingBills.length} bills due in the next 30 days</p>
          
          {upcomingBills.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-3">📅</div>
              <p>No bills due in the next 30 days</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingBills.map((bill) => (
                <div 
                  key={bill.id}
                  className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-lg hover:bg-white/[0.04] transition-all"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{getCategoryIcon(bill.category || 'Other')}</span>
                    <div>
                      <div className="text-white font-light">{bill.name}</div>
                      <div className="text-sm text-gray-400">{bill.category || 'Other'}</div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-white font-light text-lg">{formatCurrency(bill.amount)}</div>
                    <div className={`text-sm ${getRelativeDateColor(bill.daysUntil)}`}>
                      {getRelativeDate(bill.daysUntil)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default RecurringExpenses
