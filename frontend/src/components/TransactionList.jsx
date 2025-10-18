import React from 'react'

function TransactionList({ transactions }) {
  const getCategoryColor = (category) => {
    const colors = {
      'Food & Drink': 'bg-red-500',
      'Shopping': 'bg-purple-500',
      'Transport': 'bg-blue-500',
      'Bills & Utilities': 'bg-yellow-500',
      'Entertainment': 'bg-pink-500',
      'Groceries': 'bg-green-500',
      'General Merchandise': 'bg-indigo-500',
      'Income': 'bg-emerald-500',
      'Other': 'bg-gray-500'
    }
    return colors[category] || 'bg-gray-500'
  }

  const formatAmount = (amount) => {
    const numAmount = parseFloat(amount)
    return numAmount >= 0 ? `+$${numAmount.toFixed(2)}` : `-$${Math.abs(numAmount).toFixed(2)}`
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Recent Transactions</h2>
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No transactions found
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {transactions.map((transaction, index) => (
              <div key={transaction._id || index} className="p-4 hover:bg-gray-750 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className="flex-1">
                        <h3 className="text-white font-medium">
                          {transaction.description || transaction.merchant_name || 'Unknown Transaction'}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {formatDate(transaction.purchase_date || transaction.date)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-semibold ${
                          parseFloat(transaction.amount) >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {formatAmount(transaction.amount)}
                        </div>
                        {transaction.category && (
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium text-white ${getCategoryColor(transaction.category)}`}>
                            {transaction.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default TransactionList
