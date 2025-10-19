import React, { useState, useEffect } from 'react'
import EnhancedTransactionRow from './EnhancedTransactionRow'
import { getCategoryColor, getCategoryIcon } from '../utils/categoryColors'

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

  // Use deterministic color/icon mapping for categories
  // getCategoryColor and getCategoryIcon are imported from utils/categoryColors

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
    <div className="flex flex-col h-full overflow-hidden bg-black">
      {/* Header */}
      <div className="flex-shrink-0 p-8 pb-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-light text-white">transactions</h1>
            <p className="text-gray-500 mt-1 text-sm">all your transaction history</p>
          </div>
          
          {/* Date Range Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">time period:</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-gray-500 text-sm font-medium"
            >
              <option value="7">last 7 days</option>
              <option value="30">last 30 days</option>
              <option value="60">last 60 days</option>
              <option value="90">last 90 days</option>
              <option value="180">last 6 months</option>
              <option value="365">last year</option>
              <option value="730">last 2 years</option>
            </select>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <div className="text-sm text-gray-400 mb-2">total transactions</div>
              <div className="text-2xl font-light text-white">{filteredTransactions.length}</div>
              <div className="text-xs text-gray-500 mt-1">in selected period</div>
            </div>
            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <div className="text-sm text-gray-400 mb-2">total spent</div>
              <div className="text-2xl font-light text-red-400">{formatCurrency(stats.totalSpent)}</div>
            </div>
            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <div className="text-sm text-gray-400 mb-2">total income</div>
              <div className="text-2xl font-light text-green-400">{formatCurrency(stats.totalIncome)}</div>
            </div>
            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <div className="text-sm text-gray-400 mb-2">net change</div>
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
            <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-800 [&::-webkit-scrollbar-thumb]:rounded-full">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                  filter === 'all' ? 'bg-white text-black' : 'bg-gray-900 text-gray-400 hover:text-white'
                }`}
              >
                all
              </button>
              <button
                onClick={() => setFilter('expenses')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                  filter === 'expenses' ? 'bg-white text-black' : 'bg-gray-900 text-gray-400 hover:text-white'
                }`}
              >
                expenses
              </button>
              <button
                onClick={() => setFilter('income')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                  filter === 'income' ? 'bg-white text-black' : 'bg-gray-900 text-gray-400 hover:text-white'
                }`}
              >
                income
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-800 [&::-webkit-scrollbar-thumb]:rounded-full">
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
                <p className="text-lg">no transactions found</p>
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
      </div>
    </div>
  )
}

export default Transactions