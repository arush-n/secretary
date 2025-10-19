import React from 'react'

function AssetsLiabilities({ assetsLiabilities }) {
  if (!assetsLiabilities) {
    return (
      <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
        <p className="text-gray-400">loading assets data...</p>
      </div>
    )
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const totalAssets = assetsLiabilities.total_assets || 0
  const totalLiabilities = assetsLiabilities.total_liabilities || 0
  const netWorth = totalAssets - totalLiabilities

  const checkingBalance = assetsLiabilities.checking || 0
  const savingsBalance = assetsLiabilities.savings || 0
  const creditCardBalance = assetsLiabilities.credit_card || 0

  // Calculate percentages for visualization
  const totalAmount = totalAssets + totalLiabilities
  const assetsPercentage = totalAmount > 0 ? (totalAssets / totalAmount) * 100 : 50
  const liabilitiesPercentage = totalAmount > 0 ? (totalLiabilities / totalAmount) * 100 : 50

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
      <h2 className="text-xl font-light text-white mb-6">assets & liabilities</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">total assets</div>
          <div className="text-2xl font-light text-green-400">
            {formatCurrency(totalAssets)}
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">total liabilities</div>
          <div className="text-2xl font-light text-red-400">
            {formatCurrency(totalLiabilities)}
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">net worth</div>
          <div className={`text-2xl font-light ${netWorth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(netWorth)}
          </div>
        </div>
      </div>

      {/* Visualization Bar */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-sm text-gray-400">assets</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-sm text-gray-400">liabilities</span>
          </div>
        </div>
        <div className="w-full h-8 bg-gray-800 rounded-lg overflow-hidden flex">
          <div 
            className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
            style={{ width: `${assetsPercentage}%` }}
          >
            {assetsPercentage > 15 && `${assetsPercentage.toFixed(0)}%`}
          </div>
          <div 
            className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
            style={{ width: `${liabilitiesPercentage}%` }}
          >
            {liabilitiesPercentage > 15 && `${liabilitiesPercentage.toFixed(0)}%`}
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-400 mb-3">breakdown</h3>

        {/* Assets */}
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4">
          <div className="text-sm text-green-400 mb-3 font-medium">assets</div>
          <div className="space-y-2">
            {savingsBalance > 0 && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💰</span>
                  <span className="text-sm text-gray-300">savings account</span>
                </div>
                <span className="text-sm text-white">{formatCurrency(savingsBalance)}</span>
              </div>
            )}
            {checkingBalance > 0 && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏦</span>
                  <span className="text-sm text-gray-300">checking account</span>
                </div>
                <span className="text-sm text-white">{formatCurrency(checkingBalance)}</span>
              </div>
            )}
            {savingsBalance === 0 && checkingBalance === 0 && (
              <div className="text-xs text-gray-500">no assets recorded</div>
            )}
          </div>
        </div>

        {/* Liabilities */}
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4">
          <div className="text-sm text-red-400 mb-3 font-medium">liabilities</div>
          <div className="space-y-2">
            {creditCardBalance > 0 && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💳</span>
                  <span className="text-sm text-gray-300">credit card</span>
                </div>
                <span className="text-sm text-white">{formatCurrency(creditCardBalance)}</span>
              </div>
            )}
            {creditCardBalance === 0 && (
              <div className="text-xs text-gray-500">no liabilities recorded</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AssetsLiabilities