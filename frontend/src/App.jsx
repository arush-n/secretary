import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import DashboardView from './components/DashboardView'
import Chat from './components/Chat'
import BudgetingGoals from './components/BudgetingGoals'
import Investments from './components/Investments'
import Vacations from './components/Vacations'
import RecurringExpenses from './components/RecurringExpenses'
import Transactions from './components/Transactions'
import SettingsPage from './components/SettingsPage'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [categories, setCategories] = useState([])
  const [tags, setTags] = useState([])

  useEffect(() => {
    // fetch categories and tags from backend
    fetch('/get-categories')
      .then(r => r.json())
      .then(data => {
        // Backend now returns metadata {name,color}. Normalize to names for SettingsPage
        if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
          setCategories(data.map(c => c.name))
          // store raw metadata under window for components that may want it (lightweight)
          window.__CATEGORIES_META = data
        } else {
          setCategories(data || [])
        }
      })
      .catch(() => {})

    fetch('/get-tags')
      .then(r => r.json())
      .then(data => setTags(data || []))
      .catch(() => {})
  }, [])

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />
      case 'chat':
        return <Chat />
      case 'budgeting':
        return <BudgetingGoals />
      case 'investments':
        return <Investments />
      case 'vacations':
        return <Vacations setActiveTab={setActiveTab} />
      case 'settings':
        return (
          <SettingsPage
            categories={categories}
            tags={tags}
            onCategoriesUpdate={(newCats) => {
              // newCats is expected to be list of {name,color} objects
              if (Array.isArray(newCats) && newCats.length > 0 && typeof newCats[0] === 'object') {
                setCategories(newCats.map(c => c.name))
                window.__CATEGORIES_META = newCats
              } else {
                setCategories(newCats)
              }
              fetch('/set-categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categories: newCats })
              }).catch(() => {})
            }}
            onTagsUpdate={(newTags) => {
              setTags(newTags)
              fetch('/set-tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tags: newTags })
              }).catch(() => {})
            }}
          />
        )
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
      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  )
}

export default App