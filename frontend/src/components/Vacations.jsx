import React from 'react'

function Vacations() {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-black">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-8 pb-6 border-b border-white/10">
        <h1 className="text-3xl font-light text-white mb-2">vacations</h1>
        <p className="text-gray-500 text-sm">plan and budget for your dream getaways</p>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-8 pt-6">
        <div className="text-center text-gray-500 mt-20">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-medium">vacation planning coming soon</p>
          <p className="text-sm mt-2 text-gray-600">save and budget for your next adventure</p>
        </div>
      </div>
    </div>
  )
}

export default Vacations