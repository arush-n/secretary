import React from 'react'

function NetWorthCard({ netWorth }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  return (
    <div className="bg-black rounded-lg p-6 border border-white/10">
      <div className="mb-6">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">NET WORTH</h2>
        <div className="text-4xl font-light text-white mb-2">
          {formatCurrency(netWorth.current)}
        </div>
        <div className="flex items-center">
          <span className="text-green-400 text-sm font-medium">
            ▲ {formatCurrency(netWorth.change)} ({netWorth.change_percent}%)
          </span>
          <span className="text-gray-500 text-sm ml-2">Past Month</span>
        </div>
      </div>
      
      {/* Mock trend chart */}
      <div className="h-16 bg-gray-900 rounded flex items-end justify-between p-2 mb-4">
        {[40, 35, 45, 60, 55, 70, 65].map((height, index) => (
          <div
            key={index}
            className="bg-white rounded-sm"
            style={{ height: `${height}%`, width: '12%' }}
          />
        ))}
      </div>
      
      <div className="flex space-x-1">
        {['1w', '1m', '3m', 'ytd', '1y', 'all'].map((period, index) => (
          <button
            key={period}
            className={`px-3 py-1 text-xs rounded ${
              index === 1 
                ? 'bg-white text-black' 
                : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {period}
          </button>
        ))}
      </div>
    </div>
  )
}

export default NetWorthCard
