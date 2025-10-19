import React from 'react'

function Investments() {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-black">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-8 pb-6 border-b border-white/10">
        <h1 className="text-3xl font-light text-white mb-2">investments</h1>
        <p className="text-gray-500 text-sm">monitor your portfolio and investment performance</p>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-8 pt-6">
        <div className="text-center text-gray-500 mt-20">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <p className="text-lg font-medium">investment tracking coming soon</p>
          <p className="text-sm mt-2 text-gray-600">analyze your portfolio and investment returns</p>
        </div>
      </div>
    </div>
  )
}

export default Investments