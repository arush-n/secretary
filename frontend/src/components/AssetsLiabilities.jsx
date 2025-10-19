import React from 'react'

function AssetsLiabilities({ assetsLiabilities }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const assetsTotal = assetsLiabilities.assets.total
  const liabilitiesTotal = assetsLiabilities.liabilities.total
  const total = assetsTotal + liabilitiesTotal
  const assetsPercentage = total > 0 ? (assetsTotal / total) * 100 : 0
  const liabilitiesPercentage = total > 0 ? (liabilitiesTotal / total) * 100 : 0

  return (
    <div className="bg-black rounded-lg p-6 border border-white/10">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-white">ASSETS</h2>
        <h2 className="text-lg font-medium text-white">LIABILITIES</h2>
      </div>
      
      <div className="flex justify-between items-center mb-6">
        <div className="text-3xl font-light text-green-400">
          {formatCurrency(assetsTotal)}
        </div>
        <div className="text-3xl font-light text-red-400">
          {formatCurrency(liabilitiesTotal)}
        </div>
      </div>

      {/* Distribution bar */}
      <div className="mb-6">
        <div className="flex h-3 bg-gray-900 rounded-full overflow-hidden">
          <div 
            className="bg-white"
            style={{ width: `${assetsPercentage}%` }}
          />
          <div 
            className="bg-gray-600"
            style={{ width: `${liabilitiesPercentage}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>{assetsPercentage.toFixed(1)}% assets</span>
          <span>{liabilitiesPercentage.toFixed(1)}% liabilities</span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-4">
        {/* Assets */}
        <div>
          <div className="flex items-center mb-2">
            <div className="w-3 h-3 bg-gray-600 rounded mr-3"></div>
            <span className="text-sm text-gray-300">Depository</span>
            <span className="text-sm text-gray-300 ml-auto">
              {formatCurrency(assetsLiabilities.assets.breakdown.checking + assetsLiabilities.assets.breakdown.savings)}
            </span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-white rounded mr-3"></div>
            <span className="text-sm text-gray-300">Investments</span>
            <span className="text-sm text-gray-300 ml-auto">
              {formatCurrency(assetsLiabilities.assets.breakdown.investments)}
            </span>
          </div>
        </div>

        {/* Liabilities */}
        <div>
          <div className="flex items-center mb-2">
            <div className="w-3 h-3 bg-gray-500 rounded mr-3"></div>
            <span className="text-sm text-gray-300">Credit Cards</span>
            <span className="text-sm text-gray-300 ml-auto">
              {formatCurrency(assetsLiabilities.liabilities.breakdown.credit_cards)}
            </span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-gray-400 rounded mr-3"></div>
            <span className="text-sm text-gray-300">Loans</span>
            <span className="text-sm text-gray-300 ml-auto">
              {formatCurrency(assetsLiabilities.liabilities.breakdown.loans)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AssetsLiabilities
