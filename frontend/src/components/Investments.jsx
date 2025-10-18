import React from 'react'

function Investments() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-light text-white">Investments</h1>
        <p className="text-gray-500 mt-1 text-sm">Monitor your portfolio and investment performance</p>
      </div>
      
      <div className="text-center text-gray-500 mt-20">
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        <p className="text-lg font-medium">Investment Tracking Coming Soon</p>
        <p className="text-sm mt-2 text-gray-600">Analyze your portfolio and investment returns</p>
      </div>
    </div>
  )
}

export default Investments