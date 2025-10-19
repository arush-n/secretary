import React, { useState, useEffect } from 'react'
import EnhancedTransactionRow from './EnhancedTransactionRow'

const API_BASE = 'http://localhost:5001';

function Transactions({ categories, tags }) {
  const [transactions, setTransactions] = useState([])
  const [groupedTransactions, setGroupedTransactions] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateRange, setDateRange] = useState('30') // Default 30 days
  const [stats, setStats] = useState({
    totalSpent: 0,
    totalIncome: 0,
    averageTransaction: 0,
    categoryBreakdown: {}
  })

  useEffect(() => {
    fetchTransactions()
  }, [dateRange])

  useEffect(() => {
    if (transactions.length > 0) {
      calculateStats()
    }
  }, [transactions, filter])

  const fetchTransactions = async () => {
    try {
      setIsLoading(true)
      const customerId = '68f3e5a29683f20dd519e4ea'
      const response = await fetch(`${API_BASE}/get-all-transactions?customerId=${customerId}&days=${dateRange}`)
      
      if (!response.ok) throw new Error('Failed to fetch transactions')
      
      const data = await response.json()
      setTransactions(data.transactions || [])
      setGroupedTransactions(data.grouped || {})
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const calculateStats = () => {
    const filtered = getFilteredTransactions()
    
    const spent = filtered
      .filter(t => parseFloat(t.amount) < 0)
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0)
    
    const income = filtered
      .filter(t => parseFloat(t.amount) > 0)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0)
    
    const categoryBreakdown = {}
    filtered.forEach(t => {
      const category = t.category || 'Other'
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + Math.abs(parseFloat(t.amount))
    })

    setStats({
      totalSpent: spent,
      totalIncome: income,
      averageTransaction: filtered.length > 0 ? spent / filtered.length : 0,
      categoryBreakdown
    })
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
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    
    const diffTime = Math.abs(today - date)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays <= 7) return `${diffDays} days ago`
    
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const getCategoryColor = (category) => {
    const colors = {
      'Food & Drink': 'bg-red-500',
      'Shopping': 'bg-purple-500',
      'Transport': 'bg-blue-500',
      'Bills & Utilities': 'bg-yellow-500',
      'Entertainment': 'bg-pink-500',
      'Groceries': 'bg-green-500',
      'Healthcare': 'bg-teal-500',
      'Travel': 'bg-indigo-500',
      'Other': 'bg-gray-500'
    }
    return colors[category] || 'bg-gray-500'
  }

  const getCategoryIcon = (category) => {
    const icons = {
      'Food & Drink': '🍔',
      'Shopping': '🛍️',
      'Transport': '🚗',
      'Bills & Utilities': '💡',
      'Entertainment': '🎬',
      'Groceries': '🛒',
      'Healthcare': '⚕️',
      'Travel': '✈️',
      'Other': '📦'
    }
    return icons[category] || '📦'
  }

  const getFilteredTransactions = () => {
    return transactions.filter(t => {
      const matchesFilter = filter === 'all' || 
        (filter === 'expenses' && parseFloat(t.amount) < 0) ||
        (filter === 'income' && parseFloat(t.amount) > 0) ||
        (filter !== 'all' && filter !== 'expenses' && filter !== 'income' && t.category === filter)
      
      const matchesSearch = !searchTerm || 
        t.description.toLowerCase().includes(searchTerm.toLowerCase())
      
      return matchesFilter && matchesSearch
    })
  }

  const groupTransactionsByDate = (transactions) => {
    const grouped = {}
    transactions.forEach(t => {
      const date = t.purchase_date
      if (!grouped[date]) grouped[date] = []
      grouped[date].push(t)
    })
    return grouped
  }

  const handleTransactionUpdate = (updatedTransaction) => {
    setTransactions(prevTransactions => 
      prevTransactions
        .map(t => t._id === updatedTransaction._id ? updatedTransaction : t)
        .filter(t => !t.deleted)
    )
  }

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
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  const filteredTransactions = getFilteredTransactions()
  const groupedByDate = groupTransactionsByDate(filteredTransactions)
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a))

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-light text-white">Transactions</h1>
            <p className="text-gray-500 mt-1 text-sm">All your transaction history</p>
          </div>
          
          {/* Date Range Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Time Period:</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-gray-500 text-sm font-medium"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="60">Last 60 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="180">Last 6 Months</option>
              <option value="365">Last Year</option>
              <option value="730">Last 2 Years</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">Total Transactions</div>
          <div className="text-2xl font-light text-white">{filteredTransactions.length}</div>
          <div className="text-xs text-gray-500 mt-1">in selected period</div>
        </div>
        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">Total Spent</div>
          <div className="text-2xl font-light text-red-400">{formatCurrency(stats.totalSpent)}</div>
        </div>
        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">Total Income</div>
          <div className="text-2xl font-light text-green-400">{formatCurrency(stats.totalIncome)}</div>
        </div>
        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">Net Change</div>
          <div className={`text-2xl font-light ${(stats.totalIncome - stats.totalSpent) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(stats.totalIncome - stats.totalSpent)}
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-gray-500"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
              filter === 'all' ? 'bg-white text-black' : 'bg-gray-900 text-gray-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('expenses')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
              filter === 'expenses' ? 'bg-white text-black' : 'bg-gray-900 text-gray-400 hover:text-white'
            }`}
          >
            Expenses
          </button>
          <button
            onClick={() => setFilter('income')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
              filter === 'income' ? 'bg-white text-black' : 'bg-gray-900 text-gray-400 hover:text-white'
            }`}
          >
            Income
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {Object.keys(stats.categoryBreakdown).map(category => (
          <button
            key={category}
            onClick={() => setFilter(category)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-2 ${
              filter === category 
                ? `${getCategoryColor(category)} text-white` 
                : 'bg-gray-900 text-gray-400 hover:text-white'
            }`}
          >
            <span>{getCategoryIcon(category)}</span>
            <span>{category}</span>
            <span className="text-xs opacity-75">{formatCurrency(stats.categoryBreakdown[category])}</span>
          </button>
        ))}
      </div>

      {/* Transaction Timeline */}
      <div className="space-y-8">
        {sortedDates.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p className="text-lg">No transactions found</p>
          </div>
        ) : (
          sortedDates.map(date => (
            <div key={date} className="relative">
              {/* Date Header */}
              <div className="sticky top-0 bg-black z-10 py-3 mb-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0 w-3 h-3 bg-white rounded-full mr-4"></div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-white">{formatDate(date)}</h3>
                    <p className="text-xs text-gray-500">{new Date(date).toLocaleDateString('en-US', { weekday: 'long' })}</p>
                  </div>
                  <div className="text-sm text-gray-400">
                    {groupedByDate[date].length} transaction{groupedByDate[date].length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Timeline Line */}
              <div className="absolute left-[5px] top-12 bottom-0 w-0.5 bg-gray-800"></div>

              {/* Transactions */}
              <div className="ml-8 space-y-3">
                {groupedByDate[date].map((transaction) => (
                  <EnhancedTransactionRow
                    key={transaction._id}
                    transaction={transaction}
                    categories={categories}
                    availableTags={tags}
                    onUpdate={handleTransactionUpdate}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Transactions