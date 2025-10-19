import React, { useState, useEffect } from 'react'
import logo from '../assets/logo.png'

function Investments() {
  const [stockSymbol, setStockSymbol] = useState('')
  const [selectedAdvisor, setSelectedAdvisor] = useState('warren_buffett')
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [advisors, setAdvisors] = useState({})
  const [activeTab, setActiveTab] = useState('analysis') // analysis, comparison
  const [comparisonStocks, setComparisonStocks] = useState(['', ''])
  const [comparisonResult, setComparisonResult] = useState(null)

  // Load available advisors
  useEffect(() => {
    const loadAdvisors = async () => {
      try {
        const response = await fetch('http://localhost:5001/api/advisors')
        const data = await response.json()
        setAdvisors(data.advisors || {})
      } catch (error) {
        console.error('Failed to load advisors:', error)
      }
    }
    loadAdvisors()
  }, [])

  const analyzeStock = async () => {
    if (!stockSymbol.trim()) return

    setLoading(true)
    try {
      const response = await fetch(`http://localhost:5001/api/stock-analysis/${stockSymbol}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          advisor_id: selectedAdvisor,
          user_context: {
            risk_tolerance: 'moderate',
            timeline: '5-10 years',
            portfolio_size: 'moderate'
          }
        })
      })

      const data = await response.json()
      setAnalysis(data)
    } catch (error) {
      console.error('Analysis failed:', error)
      setAnalysis({
        error: 'analysis failed',
        stock_symbol: stockSymbol,
        advisor: selectedAdvisor
      })
    }
    setLoading(false)
  }

  const compareStocks = async () => {
    const validStocks = comparisonStocks.filter(stock => stock.trim())
    if (validStocks.length < 2) return

    setLoading(true)
    try {
      const response = await fetch('http://localhost:5001/api/compare-stocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_symbols: validStocks,
          advisor_id: selectedAdvisor,
          user_profile: {
            risk_tolerance: 'moderate',
            timeline: '5-10 years'
          }
        })
      })

      const data = await response.json()
      setComparisonResult(data)
    } catch (error) {
      console.error('Comparison failed:', error)
      setComparisonResult({
        error: 'comparison failed',
        stocks: validStocks
      })
    }
    setLoading(false)
  }

  const renderStandardAnalysis = (analysisData) => {
    const advisor = advisors[selectedAdvisor] || {}
    
    return (
      <div className="space-y-6">
        {/* Advisor Info */}
        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center">
              <span className="text-lg">👨‍💼</span>
            </div>
            <div>
              <h3 className="text-lg font-light text-white capitalize">{advisor.name}</h3>
              <p className="text-sm text-gray-400">{advisor.personality}</p>
            </div>
          </div>
        </div>

        {/* Bullish Case */}
        {analysisData.bullish_case && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6">
            <h3 className="text-lg font-light text-green-400 mb-3 flex items-center gap-2">
              📈 bullish case
              <span className="text-xs px-2 py-1 bg-green-500/20 rounded-full">
                {analysisData.bullish_case.confidence_level}
              </span>
            </h3>
            <p className="text-sm text-green-200 mb-4">{analysisData.bullish_case.summary}</p>
            <div className="space-y-2">
              {analysisData.bullish_case.key_points?.map((point, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">•</span>
                  <span className="text-sm text-green-300">{point}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bearish Case */}
        {analysisData.bearish_case && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
            <h3 className="text-lg font-light text-red-400 mb-3 flex items-center gap-2">
              📉 bearish case
              <span className="text-xs px-2 py-1 bg-red-500/20 rounded-full">
                {analysisData.bearish_case.confidence_level}
              </span>
            </h3>
            <p className="text-sm text-red-200 mb-4">{analysisData.bearish_case.summary}</p>
            <div className="space-y-2">
              {analysisData.bearish_case.key_points?.map((point, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">•</span>
                  <span className="text-sm text-red-300">{point}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendation */}
        {analysisData.recommendation && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
            <h3 className="text-lg font-light text-blue-400 mb-3 flex items-center gap-2">
              💡 recommendation
              <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                analysisData.recommendation.action === 'buy' 
                  ? 'bg-green-500/20 text-green-400'
                  : analysisData.recommendation.action === 'sell'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {analysisData.recommendation.action}
              </span>
            </h3>
            <p className="text-sm text-blue-200 mb-3">{analysisData.recommendation.reasoning}</p>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-400">outlook:</span>
                <span className="ml-2 text-white capitalize">{analysisData.recommendation.price_target_outlook}</span>
              </div>
              <div>
                <span className="text-gray-400">horizon:</span>
                <span className="ml-2 text-white capitalize">{analysisData.recommendation.time_horizon}</span>
              </div>
            </div>
          </div>
        )}

        {/* Risk Assessment */}
        {analysisData.risk_assessment && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-6">
            <h3 className="text-lg font-light text-orange-400 mb-3 flex items-center gap-2">
              ⚠️ risk assessment
              <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                analysisData.risk_assessment.overall_risk === 'high'
                  ? 'bg-red-500/20 text-red-400'
                  : analysisData.risk_assessment.overall_risk === 'low'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {analysisData.risk_assessment.overall_risk} risk
              </span>
            </h3>
            <div className="space-y-2">
              {analysisData.risk_assessment.key_risks?.map((risk, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">•</span>
                  <span className="text-sm text-orange-300">{risk}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderAnalysis = () => {
    if (!analysis) return null

    if (analysis.error) {
      return (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-light text-red-400 mb-2">analysis unavailable</h3>
          <p className="text-sm text-red-300">{analysis.error}</p>
          {analysis.error.includes('quota') && (
            <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-300">
                💡 the ai service has reached its quota limit. please try again later or check your api key configuration.
              </p>
            </div>
          )}
        </div>
      )
    }

    // Show fallback mode message if available
    if (analysis.ai_status === 'fallback_mode') {
      return (
        <div className="space-y-6">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-light text-yellow-400 mb-2">📊 fallback analysis</h3>
            <p className="text-sm text-yellow-300">{analysis.message}</p>
          </div>
          {renderStandardAnalysis(analysis)}
        </div>
      )
    }

    return renderStandardAnalysis(analysis)
  }

  const renderComparison = () => {
    if (!comparisonResult) return null

    if (comparisonResult.error) {
      return (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
          <h3 className="text-lg font-light text-red-400 mb-2">comparison unavailable</h3>
          <p className="text-sm text-red-300">{comparisonResult.error}</p>
        </div>
      )
    }

    const comparison = comparisonResult.advisor_comparisons?.[selectedAdvisor]?.comparison
    
    return (
      <div className="space-y-6">
        {comparison?.winner && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6">
            <h3 className="text-lg font-light text-green-400 mb-3">🏆 top pick</h3>
            <div className="text-2xl font-light text-white mb-2">{comparison.winner}</div>
            <p className="text-sm text-green-200">{comparison.ranking_reasoning}</p>
          </div>
        )}

        {comparison?.individual_analysis && (
          <div className="grid gap-4">
            {Object.entries(comparison.individual_analysis).map(([stock, data]) => (
              <div key={stock} className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-light text-white">{stock}</h4>
                  <div className="text-sm bg-white/10 px-3 py-1 rounded-full">
                    {data.rating}/10
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-sm text-green-400 mb-2">pros</h5>
                    <div className="space-y-1">
                      {data.pros?.map((pro, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="text-green-400 mt-1">+</span>
                          <span className="text-xs text-green-300">{pro}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h5 className="text-sm text-red-400 mb-2">cons</h5>
                    <div className="space-y-1">
                      {data.cons?.map((con, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="text-red-400 mt-1">-</span>
                          <span className="text-xs text-red-300">{con}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-8 pb-6 border-b border-white/10">
        <h1 className="text-3xl font-light text-white mb-2">investments</h1>
        <p className="text-gray-500 text-sm">ai-powered stock analysis and investment insights</p>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-8 pt-6">
        
        {/* Tab Navigation */}
        <div className="flex gap-1 mb-8 bg-white/[0.02] p-1 rounded-lg border border-white/10">
          {[
            { id: 'analysis', label: 'stock analysis', icon: '📊' },
            { id: 'comparison', label: 'compare stocks', icon: '⚖️' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 rounded-md text-sm font-light transition-all flex items-center justify-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Advisor Selection */}
        <div className="mb-6">
          <label className="block text-sm font-light text-gray-400 mb-3">choose your advisor</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(advisors).map(([id, advisor]) => (
              <button
                key={id}
                onClick={() => setSelectedAdvisor(id)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedAdvisor === id
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-white/[0.02] border-white/10 text-gray-400 hover:bg-white/[0.04] hover:border-white/20'
                }`}
              >
                <div className="font-light text-sm capitalize mb-1">{advisor.name}</div>
                <div className="text-xs text-gray-500">{advisor.focus}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'analysis' && (
          <div>
            {/* Stock Input */}
            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 mb-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="enter stock symbol (e.g., AAPL, GOOGL, TSLA)"
                    value={stockSymbol}
                    onChange={(e) => setStockSymbol(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-white/30 transition-colors"
                    onKeyPress={(e) => e.key === 'Enter' && analyzeStock()}
                  />
                </div>
                <button
                  onClick={analyzeStock}
                  disabled={loading || !stockSymbol.trim()}
                  className="px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-200 font-light text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'analyzing...' : 'analyze'}
                </button>
              </div>
            </div>

            {/* Analysis Results */}
            {renderAnalysis()}
          </div>
        )}

        {activeTab === 'comparison' && (
          <div>
            {/* Stock Comparison Input */}
            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-light text-white mb-4">compare stocks</h3>
              <div className="space-y-3 mb-4">
                {comparisonStocks.map((stock, index) => (
                  <input
                    key={index}
                    type="text"
                    placeholder={`stock ${index + 1} (e.g., AAPL)`}
                    value={stock}
                    onChange={(e) => {
                      const newStocks = [...comparisonStocks]
                      newStocks[index] = e.target.value.toUpperCase()
                      setComparisonStocks(newStocks)
                    }}
                    className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-white/30 transition-colors"
                  />
                ))}
              </div>
              <div className="flex justify-between items-center">
                <button
                  onClick={() => setComparisonStocks([...comparisonStocks, ''])}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  + add another stock
                </button>
                <button
                  onClick={compareStocks}
                  disabled={loading || comparisonStocks.filter(s => s.trim()).length < 2}
                  className="px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-200 font-light text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'comparing...' : 'compare'}
                </button>
              </div>
            </div>

            {/* Comparison Results */}
            {renderComparison()}
          </div>
        )}



      </div>
    </div>
  )
}

export default Investments