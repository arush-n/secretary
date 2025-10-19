import React from 'react'

function Budgeting() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-light text-white">budgeting</h1>
        <p className="text-gray-500 mt-1 text-sm">track your spending and manage your budget</p>
      </div>
      
      <div className="text-center text-gray-500 mt-20">
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <p className="text-lg font-medium">budgeting tools coming soon</p>
        <p className="text-sm mt-2 text-gray-600">set spending limits and track expenses</p>
      </div>
    </div>
  )
}

export default Budgeting