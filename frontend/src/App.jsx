import React, { useState } from 'react'
import Sidebar from './components/Sidebar'
import DashboardView from './components/DashboardView'
import Chat from './components/Chat'
import BudgetCalendar from './components/BudgetCalendar'
import Investments from './components/Investments'
import Vacations from './components/Vacations'
import RecurringExpenses from './components/RecurringExpenses'
import Transactions from './components/Transactions'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />
      case 'chat':
        return <Chat />
      case 'budgeting':
        return <BudgetCalendar />
      case 'investments':
        return <Investments />
      case 'vacations':
        return <Vacations />
      case 'recurring':
        return <RecurringExpenses />
      case 'transactions':
        return <Transactions />
      default:
        return <DashboardView />
    }
  }

  return (
    <div className="h-screen bg-black flex overflow-hidden">
      {/* Sidebar - Fixed */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  )
}

export default App
