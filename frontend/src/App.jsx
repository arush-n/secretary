import React, { useState } from 'react'
import Sidebar from './components/Sidebar'
import DashboardView from './components/DashboardView'
import Chat from './components/Chat'
import BudgetingGoals from './components/BudgetingGoals'
import Investments from './components/Investments'
import Vacations from './components/Vacations'
import Transactions from './components/Transactions'
import RecurringExpenses from './components/RecurringExpenses'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />
      case 'transactions':
        return <Transactions />
      case 'recurring':
        return <RecurringExpenses />
      case 'chat':
        return <Chat />
      case 'budgeting':
        return <BudgetingGoals />
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