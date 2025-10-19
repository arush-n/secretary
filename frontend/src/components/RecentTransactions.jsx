import React from 'react'

function RecentTransactions({ transactions }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now - date)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return 'today'
    if (diffDays === 2) return 'yesterday'
    if (diffDays <= 7) return `${diffDays - 1} DAYS AGO`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getTransactionIcon = (description) => {
    const firstLetter = description.charAt(0).toUpperCase()
    const colors = ['bg-gray-600', 'bg-gray-500', 'bg-gray-400', 'bg-white', 'bg-gray-700']
    const colorIndex = firstLetter.charCodeAt(0) % colors.length
    return { letter: firstLetter, color: colors[colorIndex] }
  }

  return (
    <div className="bg-black rounded-lg p-6 border border-white/10">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-white">RECENT TRANSACTIONS</h2>
        <button className="text-gray-400 text-sm hover:text-white">
          VIEW ALL →
        </button>
      </div>
      
      <div className="space-y-5">
        {transactions.slice(0, 5).map((transaction, index) => {
          const icon = getTransactionIcon(transaction.description)
          const isNegative = parseFloat(transaction.amount) < 0
          
          return (
            <div key={transaction._id || index} className="flex items-center">
              <div className={`w-6 h-6 ${icon.color} rounded-full flex items-center justify-center mr-4`}>
                <span className={`text-sm font-medium ${icon.color === 'bg-white' ? 'text-black' : 'text-white'}`}>
                  {icon.letter}
                </span>
              </div>
              <div className="flex-1">
                <div className="text-sm text-white font-medium">
                  {transaction.description}
                </div>
                <div className="text-xs text-gray-500">
                  {formatDate(transaction.purchase_date)}
                </div>
              </div>
              <div className={`text-sm font-medium ${
                isNegative ? 'text-red-400' : 'text-green-400'
              }`}>
                {isNegative ? '-' : '+'}{formatCurrency(Math.abs(parseFloat(transaction.amount)))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default RecentTransactions
