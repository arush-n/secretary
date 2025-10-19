import React, { useState } from 'react'

function NetWorthCard({ netWorth }) {
  const [selectedPeriod, setSelectedPeriod] = useState('1m')
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  // Data for different time periods
  const periodData = {
    '1w': [18500, 18200, 18800, 19200, 19000, 19300, 19550],
    '1m': [17800, 18200, 18600, 19000, 18800, 19400, 19550],
    '3m': [16500, 17200, 17800, 18300, 18100, 18900, 19550],
    'ytd': [15000, 16200, 17100, 17800, 18200, 18800, 19550],
    '1y': [14500, 15800, 16900, 17500, 18000, 18600, 19550],
    'all': [12000, 13500, 15200, 16800, 17900, 18700, 19550]
  }

  const getCurrentData = () => {
    return periodData[selectedPeriod] || periodData['1m']
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
      
      {/* Line chart with color-coded dots */}
      <div className="h-48 bg-gray-900 rounded p-4 mb-4 relative">
        <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
          {/* Define gradients */}
          <defs>
            <linearGradient id="greenGlow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(16, 185, 129, 0.3)" />
              <stop offset="100%" stopColor="rgba(16, 185, 129, 0.05)" />
            </linearGradient>
            <linearGradient id="redGlow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(239, 68, 68, 0.3)" />
              <stop offset="100%" stopColor="rgba(239, 68, 68, 0.05)" />
            </linearGradient>
          </defs>
          
          {/* Define the data points */}
          {(() => {
            const data = getCurrentData()
            const minValue = Math.min(...data);
            const maxValue = Math.max(...data);
            const range = maxValue - minValue;
            
            // Determine overall trend (compare first and last values)
            const overallIncrease = data[data.length - 1] > data[0];
            const trendColor = overallIncrease ? '#10b981' : '#ef4444';
            const gradientId = overallIncrease ? 'greenGlow' : 'redGlow';
            
            const points = data.map((value, index) => ({
              x: (index / (data.length - 1)) * 400, // Full width in viewBox coordinates (0 to 400)
              y: 200 - ((value - minValue) / range) * 160 - 20, // Map to viewBox height with padding
              value,
              isIncrease: index === 0 ? true : value > data[index - 1]
            }));
            
            // Create path for the line
            const pathData = points.map((point, index) => 
              `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`
            ).join(' ');
            
            // Create path for the gradient fill - edge to edge
            const fillPath = `M 0,${points[0].y} ${pathData.substring(1)} L 400,${points[points.length - 1].y} L 400,200 L 0,200 Z`;
            
            return (
              <>
                {/* Gradient fill area - edge to edge */}
                <path
                  d={fillPath}
                  fill={`url(#${gradientId})`}
                />
                
                {/* Line connecting all points - edge to edge */}
                <path
                  d={`M 0,${points[0].y} ${pathData.substring(1)} L 400,${points[points.length - 1].y}`}
                  stroke={trendColor}
                  strokeWidth="3"
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                />
                
                {/* Data points as compensated ellipses that appear as perfect circles */}
                {points.map((point, index) => (
                  <ellipse
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    rx="3"
                    ry="9"
                    fill={point.isIncrease ? '#10b981' : '#ef4444'}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </>
            );
          })()}
        </svg>
      </div>
      
      <div className="flex space-x-1">
        {['1w', '1m', '3m', 'ytd', '1y', 'all'].map((period) => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              selectedPeriod === period
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
