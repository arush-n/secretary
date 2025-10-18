import React, { useState, useEffect } from 'react'
import Header from './Header'
import Summary from './Summary'
import NetWorthCard from './NetWorthCard'
import BudgetOverview from './BudgetOverview'
import AssetsLiabilities from './AssetsLiabilities'
import RecentTransactions from './RecentTransactions'

function DashboardView() {
  const [dashboardData, setDashboardData] = useState(null)
  const [aiSummary, setAiSummary] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Fetch dashboard data
        const customerId = '68f3e5a29683f20dd519e4ea'
        const dashboardResponse = await fetch(`/api/get-dashboard-data?customerId=${customerId}`)
        
        if (!dashboardResponse.ok) {
          throw new Error('Failed to fetch dashboard data')
        }
        
        const dashboardData = await dashboardResponse.json()
        setDashboardData(dashboardData)
        
        // Get AI summary
        const summaryResponse = await fetch('/api/get-ai-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ transactions: dashboardData.transactions }),
        })
        
        if (!summaryResponse.ok) {
          throw new Error('Failed to get AI summary')
        }
        
        const summaryData = await summaryResponse.json()
        setAiSummary(summaryData.summary || 'Unable to generate summary')
        
      } catch (err) {
        setError(err.message)
        console.error('Error fetching data:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading your financial data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-400">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-white text-black rounded hover:bg-gray-200"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-light text-white">Financial Dashboard</h1>
            <p className="text-gray-500 mt-1 text-sm">Friday, October 18</p>
          </div>
        </div>
      </div>

      {/* Net Worth Section */}
      <div className="mb-8">
        <NetWorthCard netWorth={dashboardData.net_worth} />
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Budget Overview */}
        <div className="lg:col-span-1">
          <BudgetOverview budget={dashboardData.budget} />
        </div>
        
        {/* Assets & Liabilities */}
        <div className="lg:col-span-2">
          <AssetsLiabilities assetsLiabilities={dashboardData.assets_liabilities} />
        </div>
      </div>

      {/* AI Summary */}
      <div className="mb-8">
        <Summary summary={aiSummary} />
      </div>

      {/* Recent Transactions */}
      <div>
        <RecentTransactions transactions={dashboardData.transactions} />
      </div>
    </div>
  )
}

export default DashboardView