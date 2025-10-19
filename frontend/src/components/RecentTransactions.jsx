import React from 'react'

function RecentTransactions({ transactions }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(amount))
  }

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString)
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Recent'
      }
      
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric'
      })
    } catch (e) {
      return 'Recent'
    }
  }

  const getCategoryIcon = (category) => {
    const icons = {
      'Food': '🍔',
      'Groceries': '🛒',
      'Shopping': '🛍️',
      'Transportation': '🚗',
      'Entertainment': '🎬',
      'Housing': '🏠',
      'Utilities': '⚡',
      'Health': '⚕️',
      'Income': '💰',
      'Other': '📦'
    }
    return icons[category] || '📦'
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-light text-white">recent transactions</h2>
        </div>
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">no transactions yet</p>
          <p className="text-sm">your recent transactions will appear here</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-light text-white">recent transactions</h2>
        <span className="text-sm text-gray-500">{transactions.length} transactions</span>
      </div>

      <div className="space-y-3">
        {transactions.slice(0, 10).map((transaction) => {
          const isIncome = transaction.type === 'credit'
          const isExpense = transaction.type === 'debit'
          
          return (
            <div 
              key={transaction.id} 
              className="flex items-center justify-between py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors rounded px-2"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="text-2xl">
                  {getCategoryIcon(transaction.category)}
                </div>
                <div className="flex-1">
                  <div className="text-white font-light">{transaction.merchant}</div>
                  <div className="text-sm text-gray-500 flex items-center gap-2">
                    <span>{formatDate(transaction.date)}</span>
                    <span>•</span>
                    <span>{transaction.category}</span>
                    {transaction.isFixed && (
                      <>
                        <span>•</span>
                        <span className="text-orange-400">📌 fixed</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              <div className={`text-lg font-light ${
                isIncome ? 'text-green-400' : 'text-red-400'
              }`}>
                {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default RecentTransactions