import React from 'react'

function Sidebar({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'dashboard', name: 'Financial Dashboard', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { id: 'chat', name: 'Chat', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    { id: 'budgeting', name: 'Budgeting', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
    { id: 'investments', name: 'Investments', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
    { id: 'vacations', name: 'Vacations', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }
  ]

  return (
    <div className="w-64 bg-black border-r border-gray-800 flex flex-col h-full">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center mr-3">
            <span className="text-black text-lg font-bold">₿</span>
          </div>
          <h1 className="text-xl font-bold text-white">Secretary</h1>
        </div>
      </div>
      
      <div className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full rounded-lg p-3 border transition-all ${
              activeTab === item.id
                ? 'bg-gray-900 border-gray-700'
                : 'bg-transparent border-transparent hover:bg-gray-900/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              <span className="font-medium text-white">{item.name}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default Sidebar