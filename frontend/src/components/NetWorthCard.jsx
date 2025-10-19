import React, { useState } from 'react'

function NetWorthCard({ netWorth, dailyData }) {
  const [timeframe, setTimeframe] = useState('1m') // 1w, 1m, 3m, ytd, 1y, all

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  // Calculate percentage change
  const calculateChange = () => {
    if (!dailyData || dailyData.length < 2) {
      return { amount: 0, percentage: 0 }
    }

    const firstValue = dailyData[0].netWorth
    const lastValue = dailyData[dailyData.length - 1].netWorth
    const change = lastValue - firstValue
    const percentage = firstValue !== 0 ? (change / firstValue) * 100 : 0

    return { amount: change, percentage }
  }

  const change = calculateChange()
  const isPositive = change.amount >= 0

  // Filter data based on timeframe
  const getFilteredData = () => {
    if (!dailyData || dailyData.length === 0) return []
    
    switch (timeframe) {
      case '1w':
        return dailyData.slice(Math.max(0, dailyData.length - 7))
      case '1m':
        return dailyData
      case '3m':
        return dailyData
      default:
        return dailyData
    }
  }

  const filteredData = getFilteredData()

  // Calculate chart dimensions
  const chartWidth = 800
  const chartHeight = 120
  const padding = { top: 10, right: 10, bottom: 10, left: 10 }

  // Get min and max values for scaling
  const values = filteredData.map(d => d.netWorth)
  const minValue = values.length > 0 ? Math.min(...values) : 0
  const maxValue = values.length > 0 ? Math.max(...values) : 100
  const valueRange = maxValue - minValue || 1

  // Create SVG path
  const createPath = () => {
    if (filteredData.length === 0) return ''
    if (filteredData.length === 1) {
      const x = chartWidth / 2
      const y = chartHeight / 2
      return `M ${x},${y} L ${x},${y}`
    }

    const points = filteredData.map((data, index) => {
      const x = (index / (filteredData.length - 1)) * (chartWidth - padding.left - padding.right) + padding.left
      const y = chartHeight - padding.bottom - ((data.netWorth - minValue) / valueRange) * (chartHeight - padding.top - padding.bottom)
      return `${x},${y}`
    })

    return `M ${points.join(' L ')}`
  }

  // Create area fill path
  const createAreaPath = () => {
    if (filteredData.length === 0) return ''

    const pathData = createPath()
    const lastIndex = filteredData.length - 1
    const lastX = (lastIndex / (filteredData.length - 1)) * (chartWidth - padding.left - padding.right) + padding.left
    const bottomY = chartHeight - padding.bottom
    
    return `${pathData} L ${lastX},${bottomY} L ${padding.left},${bottomY} Z`
  }

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="text-sm text-gray-400 mb-2">net worth</div>
        <div className="flex items-baseline gap-4 flex-wrap">
          <div className="text-4xl font-light text-white">
            {formatCurrency(netWorth || 0)}
          </div>
          <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            <span>{isPositive ? '▲' : '▼'}</span>
            <span>{formatCurrency(Math.abs(change.amount))}</span>
            <span>({Math.abs(change.percentage).toFixed(1)}%)</span>
            <span className="text-gray-500">past month</span>
          </div>
        </div>
      </div>

      {/* Timeframe Buttons */}
      <div className="flex gap-2 mb-4">
        {['1w', '1m', '3m', 'ytd', '1y', 'all'].map(tf => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              timeframe === tf
                ? 'bg-white text-black'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Line Graph */}
      <div className="relative bg-black/30 rounded-lg p-4">
        {filteredData && filteredData.length > 0 ? (
          <svg 
            width="100%" 
            height={chartHeight}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="none"
            className="w-full"
          >
            {/* Grid lines */}
            <defs>
              <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity="0.2"/>
                <stop offset="100%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity="0"/>
              </linearGradient>
            </defs>

            {/* Horizontal grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = chartHeight - padding.bottom - (ratio * (chartHeight - padding.top - padding.bottom))
              return (
                <line
                  key={i}
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="1"
                />
              )
            })}

            {/* Area fill */}
            <path
              d={createAreaPath()}
              fill="url(#areaGradient)"
            />

            {/* Line */}
            <path
              d={createPath()}
              fill="none"
              stroke={isPositive ? "#10b981" : "#ef4444"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data points */}
            {filteredData.map((data, index) => {
              const x = (index / (filteredData.length - 1)) * (chartWidth - padding.left - padding.right) + padding.left
              const y = chartHeight - padding.bottom - ((data.netWorth - minValue) / valueRange) * (chartHeight - padding.top - padding.bottom)
              
              return (
                <g key={index}>
                  <circle
                    cx={x}
                    cy={y}
                    r="4"
                    fill={isPositive ? "#10b981" : "#ef4444"}
                    className="hover:r-6 transition-all cursor-pointer"
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r="8"
                    fill="transparent"
                    className="cursor-pointer"
                  >
                    <title>
                      Day {data.day}: {formatCurrency(data.netWorth)}
                      {'\n'}income: {formatCurrency(data.income)}
                      {'\n'}spending: {formatCurrency(data.spending)}
                    </title>
                  </circle>
                </g>
              )
            })}
          </svg>
        ) : (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
            loading chart data...
          </div>
        )}

        {/* Min/Max Labels */}
        {filteredData && filteredData.length > 0 && (
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>Low: {formatCurrency(minValue)}</span>
            <span>High: {formatCurrency(maxValue)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default NetWorthCard