import React from 'react'

function Summary({ summary }) {
  return (
    <div className="bg-black rounded-lg p-6 border border-white/10">
      <div className="flex items-center mb-4">
        <span className="text-xl mr-3">💡</span>
        <h2 className="text-lg font-medium text-white">AI Financial Summary</h2>
      </div>
      <p className="text-gray-300 leading-relaxed">
        {summary || 'No summary available at this time.'}
      </p>
    </div>
  )
}

export default Summary
