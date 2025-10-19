import React from 'react'
import logo from '../logo.png'

function Sidebar({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'dashboard', name: 'financial dashboard', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { id: 'chat', name: 'chat', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    { id: 'budgeting', name: 'budgeting', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'recurring', name: 'recurring expenses', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
    { id: 'transactions', name: 'transactions', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { id: 'investments', name: 'investments', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
    { id: 'vacations', name: 'vacations', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }
  ]

  return (
    <div className="w-64 bg-gradient-to-b from-black via-[#0a1628] to-black border-r border-white/10 flex flex-col h-full">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Secretary Logo" className="w-24 h-24" />
          <h1 className="text-xl font-semibold text-white">secretary</h1>
        </div>
      </div>
      
      <div className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full rounded-lg p-3 transition-all flex items-center gap-3 ${
              activeTab === item.id
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-gray-400 hover:bg-gradient-to-r hover:from-blue-600/10 hover:to-transparent hover:text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
            </svg>
            <span className="font-medium">{item.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default Sidebar