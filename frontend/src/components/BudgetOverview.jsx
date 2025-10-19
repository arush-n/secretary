import React from 'react'

function BudgetOverview({ budget }) {
  if (!budget) {
    return (
      <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
        <p className="text-gray-400">loading budget data...</p>
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

  // Calculate max value for scaling the chart
  const maxSpending = Math.max(...budget.daily_spending.map(d => d.amount), 100)
  const chartHeight = 120

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
      <h2 className="text-xl font-light text-white mb-6">budget overview</h2>

      {/* Budget Summary Cards */}
      <div className="space-y-4 mb-6">
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">monthly budget</div>
          <div className="text-2xl font-light text-white">
            {formatCurrency(budget.monthly_budget || 0)}
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">spent so far</div>
          <div className="text-2xl font-light text-red-400">
            {formatCurrency(budget.spent_so_far || 0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {budget.monthly_budget > 0 ? ((budget.spent_so_far / budget.monthly_budget) * 100).toFixed(0) : 0}% of budget
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">projected total</div>
          <div className={`text-2xl font-light ${
            budget.projected_total > budget.monthly_budget ? 'text-orange-400' : 'text-white'
          }`}>
            {formatCurrency(budget.projected_total || 0)}
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">remaining</div>
          <div className={`text-2xl font-light ${
            budget.remaining >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {formatCurrency(budget.remaining || 0)}
          </div>
        </div>
      </div>

      {/* Daily Spending Chart */}
      <div className="mt-6">
        <h3 className="text-sm font-medium text-gray-400 mb-4">daily spending</h3>
        <div className="relative" style={{ height: `${chartHeight}px` }}>
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-500 pr-2">
            <span>${Math.round(maxSpending)}</span>
            <span>${Math.round(maxSpending / 2)}</span>
            <span>$0</span>
          </div>

          {/* Chart area */}
          <div className="ml-12 h-full flex items-end gap-1">
            {budget.daily_spending && budget.daily_spending.length > 0 ? (
              budget.daily_spending.map((day, index) => {
                const heightPercentage = maxSpending > 0 ? (day.amount / maxSpending) * 100 : 0
                
                return (
                  <div 
                    key={index}
                    className="flex-1 flex flex-col items-center group relative"
                  >
                    {/* Bar */}
                    <div 
                      className="w-full bg-gradient-to-t from-red-500 to-red-400 rounded-t transition-all hover:opacity-80"
                      style={{ height: `${heightPercentage}%`, minHeight: heightPercentage > 0 ? '2px' : '0' }}
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                        day {day.day}: {formatCurrency(day.amount)}
                      </div>
                    </div>
                    
                    {/* Day label (show every 5 days) */}
                    {day.day % 5 === 0 && (
                      <div className="text-[10px] text-gray-500 mt-1">{day.day}</div>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                no spending data yet
              </div>
            )}
          </div>

          {/* X-axis line */}
          {budget.daily_spending && budget.daily_spending.length > 0 && (
            <div className="ml-12 h-px bg-white/10 mt-1"></div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BudgetOverview