import React, { useState, useEffect } from 'react'

function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [filteredTransactions, setFilteredTransactions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all', 'expenses', 'income'
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [timePeriod, setTimePeriod] = useState('last 30 days')
  const [dataSource, setDataSource] = useState('mock')
  
  const categoryScrollRef = React.useRef(null)

  useEffect(() => {
    fetchTransactions()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [transactions, searchQuery, filterType, selectedCategory, timePeriod])

  const fetchTransactions = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const customerId = '68f3e5a29683f20dd519e4ea'
      
      const response = await fetch(`http://localhost:5001/get-transaction-history?customerId=${customerId}&limit=100&page=1&use_nessie=false`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch transactions')
      }
      
      const data = await response.json()
      setTransactions(data.transactions || [])
      setDataSource(data.source || 'mock')
      
    } catch (err) {
      setError(err.message)
      console.error('Error fetching transactions:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...transactions]

    // Apply time period filter
    const now = new Date()
    const filterDate = new Date()
    
    switch (timePeriod) {
      case 'Last 7 Days':
        filterDate.setDate(now.getDate() - 7)
        break
      case 'Last 30 Days':
        filterDate.setDate(now.getDate() - 30)
        break
      case 'Last 90 Days':
        filterDate.setDate(now.getDate() - 90)
        break
      case 'This Year':
        filterDate.setMonth(0, 1) // January 1st of current year
        break
      case 'All Time':
        filterDate.setFullYear(2000) // Far enough back to include all transactions
        break
      default:
        filterDate.setDate(now.getDate() - 30)
    }
    
    filtered = filtered.filter(t => {
      const transactionDate = new Date(t.date)
      return transactionDate >= filterDate
    })

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply type filter
    if (filterType === 'expenses') {
      filtered = filtered.filter(t => parseFloat(t.amount) < 0)
    } else if (filterType === 'income') {
      filtered = filtered.filter(t => parseFloat(t.amount) > 0)
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category?.toLowerCase() === selectedCategory.toLowerCase())
    }

    setFilteredTransactions(filtered)
  }

  const scrollCategories = (direction) => {
    if (categoryScrollRef.current) {
      const scrollAmount = 200
      categoryScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(Math.abs(amount))
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getCategoryColor = (category) => {
    const colors = {
      'food': 'bg-orange-500/20 text-orange-400',
      'utilities': 'bg-indigo-500/20 text-indigo-400',
      'entertainment': 'bg-purple-500/20 text-purple-400',
      'shopping': 'bg-pink-500/20 text-pink-400',
      'transport': 'bg-green-500/20 text-green-400',
      'healthcare': 'bg-red-500/20 text-red-400',
      'income': 'bg-emerald-500/20 text-emerald-400',
      'other': 'bg-gray-500/20 text-gray-400'
    }
    return colors[category?.toLowerCase()] || colors['other']
  }

  const getCategoryIcon = (category) => {
    const icons = {
      'food': '🍔',
      'utilities': '⚡',
      'entertainment': '🎬',
      'shopping': '🛍️',
      'transport': '🚗',
      'healthcare': '⚕️',
      'income': '💰',
      'other': '📦'
    }
    return icons[category?.toLowerCase()] || icons['other']
  }

  const getMerchantIcon = (description) => {
    const desc = description.toLowerCase()
    if (desc.includes('walmart') || desc.includes('target') || desc.includes('grocery')) return '🛒'
    if (desc.includes('uber') || desc.includes('lyft')) return '🚗'
    if (desc.includes('starbucks') || desc.includes('coffee')) return '☕'
    if (desc.includes('amazon')) return '📦'
    if (desc.includes('netflix') || desc.includes('spotify')) return '🎵'
    if (desc.includes('gas')) return '⛽'
    if (desc.includes('restaurant') || desc.includes('chipotle')) return '🍽️'
    if (desc.includes('pharmacy')) return '💊'
    if (desc.includes('insurance')) return '🛡️'
    if (desc.includes('electric') || desc.includes('phone') || desc.includes('bill')) return '💡'
    if (desc.includes('salary') || desc.includes('deposit')) return '💰'
    return '💳'
  }

  const getCategories = () => {
    const cats = new Set(transactions.map(t => t.category).filter(Boolean))
    return Array.from(cats)
  }

  const calculateStats = () => {
    const totalSpent = filteredTransactions
      .filter(t => parseFloat(t.amount) < 0)
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0)
    
    const totalIncome = filteredTransactions
      .filter(t => parseFloat(t.amount) > 0)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0)
    
    const netChange = totalIncome - totalSpent

    return { totalSpent, totalIncome, netChange }
  }

  const groupByDate = (transactions) => {
    const grouped = {}
    transactions.forEach(t => {
      const date = t.date || t.transaction_date
      if (!grouped[date]) {
        grouped[date] = []
      }
      grouped[date].push(t)
    })
    return grouped
  }

  const getRelativeDate = (dateString) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      return days[date.getDay()]
    }
  }

  const stats = calculateStats()
  const groupedTransactions = groupByDate(filteredTransactions)

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">Loading transactions...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
          <p className="text-red-400">Error: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black">
      {/* Header with Time Period Selector - Fixed */}
      <div className="flex-shrink-0 p-8 pb-6 flex justify-between items-start border-b border-white/10">
        <div>
          <h1 className="text-3xl font-light text-white mb-2">Transactions</h1>
          <p className="text-gray-500 text-sm">All your transaction history</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">Time Period:</span>
          <select 
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
            className="bg-white/5 text-white px-4 py-2 rounded-lg border border-white/10 focus:outline-none focus:border-white/30"
          >
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
            <option>Last 90 Days</option>
            <option>This Year</option>
            <option>All Time</option>
          </select>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-8 pt-6">

        {/* Demo Data Info Banner */}
        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 mb-6 flex items-start gap-3">
          <div className="text-2xl">ℹ️</div>
          <div>
            <p className="text-gray-300 font-medium text-sm">Demo Data</p>
            <p className="text-gray-400 text-xs mt-1">
              Showing realistic demo transaction data that matches your financial profile across all tabs.
            </p>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 hover:bg-white/[0.04] transition-all">
            <div className="text-sm text-gray-400 mb-2">Total Transactions</div>
            <div className="text-3xl font-light text-white mb-1">{filteredTransactions.length}</div>
            <div className="text-xs text-gray-500">in selected period</div>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 hover:bg-white/[0.04] transition-all">
            <div className="text-sm text-gray-400 mb-2">Total Spent</div>
            <div className="text-3xl font-light text-red-400">${stats.totalSpent.toFixed(2)}</div>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 hover:bg-white/[0.04] transition-all">
            <div className="text-sm text-gray-400 mb-2">Total Income</div>
            <div className="text-3xl font-light text-green-400">${stats.totalIncome.toFixed(2)}</div>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 hover:bg-white/[0.04] transition-all">
            <div className="text-sm text-gray-400 mb-2">Net Change</div>
            <div className={`text-3xl font-light ${stats.netChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.netChange >= 0 ? '+' : '-'}${Math.abs(stats.netChange).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex gap-4">
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-white/[0.02] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/30"
          />
          <button
            onClick={() => setFilterType('all')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              filterType === 'all'
                ? 'bg-white/10 text-white'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType('expenses')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              filterType === 'expenses'
                ? 'bg-white/10 text-white'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            Expenses
          </button>
          <button
            onClick={() => setFilterType('income')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              filterType === 'income'
                ? 'bg-white/10 text-white'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            Income
          </button>
        </div>

        {/* Category Filter Chips - Scrollable Row with Arrows */}
        <div className="mb-6 flex items-center gap-2">
          <button
            onClick={() => scrollCategories('left')}
            className="flex-shrink-0 w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div 
            ref={categoryScrollRef}
            className="flex-1 overflow-x-auto scrollbar-hide flex gap-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <button
              onClick={() => setSelectedCategory('all')}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              <span className="mr-1">📦</span> Other ${transactions.filter(t => !t.category || t.category === 'other').reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0).toFixed(2)}
            </button>
            {getCategories().map(cat => {
              const catTotal = transactions
                .filter(t => t.category?.toLowerCase() === cat.toLowerCase())
                .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0)
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    selectedCategory === cat
                      ? getCategoryColor(cat).replace('bg-', 'bg-') + ' border border-current'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <span className="mr-1">{getCategoryIcon(cat)}</span> {cat} ${catTotal.toFixed(2)}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => scrollCategories('right')}
            className="flex-shrink-0 w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center hover:bg-white/10 transition-all"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Transactions List - Grouped by Date */}
        <div className="space-y-6">
        {Object.keys(groupedTransactions).length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No transactions found
          </div>
        ) : (
          Object.entries(groupedTransactions).sort((a, b) => new Date(b[0]) - new Date(a[0])).map(([date, dayTransactions]) => (
            <div key={date}>
              {/* Date Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-white font-medium">{getRelativeDate(date)}</div>
                  <div className="text-gray-500 text-sm">{formatDate(date)}</div>
                </div>
                <div className="text-gray-400 text-sm">
                  {dayTransactions.length} transaction{dayTransactions.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Transactions for this date */}
              <div className="space-y-3">
                {dayTransactions.map((transaction) => {
                  const isNegative = parseFloat(transaction.amount) < 0
                  
                  return (
                    <div
                      key={transaction.id}
                      className="bg-white/[0.02] hover:bg-white/[0.04] rounded-xl p-4 border border-white/10 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Icon */}
                          <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-2xl">
                            {getMerchantIcon(transaction.description)}
                          </div>
                          
                          {/* Info */}
                          <div>
                            <div className="text-white font-medium">{transaction.description}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 rounded-full text-xs ${getCategoryColor(transaction.category)}`}>
                                {transaction.category || 'Other'}
                              </span>
                              <span className="text-gray-500 text-xs">My Checking Account</span>
                            </div>
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="text-right">
                          <div className={`text-xl font-medium ${isNegative ? 'text-red-400' : 'text-green-400'}`}>
                            {isNegative ? '-' : '+'}{formatCurrency(transaction.amount)}
                          </div>
                          <div className="text-gray-500 text-xs mt-1">Executed</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
        </div>
      </div>
    </div>
  )
}

export default Transactions
