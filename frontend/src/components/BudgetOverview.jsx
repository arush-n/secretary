import React from 'react'

function BudgetOverview({ budget }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'under_budget':
        return 'text-green-400'
      case 'over_budget':
        return 'text-red-400'
      default:
        return 'text-gray-400'
    }
  }

  const getStatusText = (category) => {
    const diff = category.current - category.budget
    if (diff > 0) {
      return `$${Math.abs(diff).toFixed(0)} EXTRA`
    } else if (diff < 0) {
      return `$${Math.abs(diff).toFixed(0)} UNDER`
    }
    return 'on track'
  }

  return (
    <div className="bg-black rounded-lg p-6 border border-white/10">
      <div className="flex items-center mb-6">
        <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center mr-3">
          <span className="text-white text-sm">💰</span>
        </div>
        <h2 className="text-lg font-medium text-white">Day to Day</h2>
      </div>
      
      <div className="space-y-5">
        {/* Income */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-500 uppercase tracking-wider">OCT 2025</span>
            <span className={`text-xs font-medium ${getStatusColor(budget.income.status)}`}>
              {getStatusText(budget.income)}
            </span>
          </div>
          <div className="text-sm text-gray-300">
            Current: {formatCurrency(budget.income.current)} / Budget: {formatCurrency(budget.income.budget)}
          </div>
        </div>

        {/* Expenses */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Expenses</span>
            <span className={`text-xs font-medium ${getStatusColor(budget.expenses.status)}`}>
              {getStatusText(budget.expenses)}
            </span>
          </div>
          <div className="text-sm text-gray-300">
            Current: {formatCurrency(budget.expenses.current)} / Budget: {formatCurrency(budget.expenses.budget)}
          </div>
        </div>

        {/* Savings */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Savings</span>
            <span className={`text-xs font-medium ${getStatusColor(budget.savings.status)}`}>
              {getStatusText(budget.savings)}
            </span>
          </div>
          <div className="text-sm text-gray-300">
            Current: {formatCurrency(budget.savings.current)} / Budget: {formatCurrency(budget.savings.budget)}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BudgetOverview
