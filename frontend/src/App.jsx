import React, { useState } from 'react'
import Sidebar from './components/Sidebar'
import DashboardView from './components/DashboardView'
import Chat from './components/Chat'
import Budgeting from './components/Budgeting'
import Investments from './components/Investments'
import Vacations from './components/Vacations'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />
      case 'chat':
        return <Chat />
      case 'budgeting':
        return <Budgeting />
      case 'investments':
        return <Investments />
      case 'vacations':
        return <Vacations />
      default:
        return <DashboardView />
    }
  }

  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {/* Main Content */}
      <div className="flex-1">
        {renderContent()}
      </div>
    </div>
  )
}

export default App
