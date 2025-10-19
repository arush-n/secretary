import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import DashboardView from './components/DashboardView'
import Chat from './components/Chat'
import BudgetingGoals from './components/BudgetingGoals'
import Investments from './components/Investments'
import Vacations from './components/Vacations'
import Transactions from './components/Transactions'
import RecurringExpenses from './components/RecurringExpenses'
import SettingsPage from './components/SettingsPage'

const API_BASE = 'http://localhost:5001';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [categories, setCategories] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)

  // Load categories and tags on mount
  useEffect(() => {
    loadGlobalData()
  }, [])

  const loadGlobalData = async () => {
    try {
      const [categoriesRes, tagsRes] = await Promise.all([
        fetch(`${API_BASE}/get-categories`),
        fetch(`${API_BASE}/get-tags`)
      ])

      const categoriesData = await categoriesRes.json()
      const tagsData = await tagsRes.json()

      setCategories(categoriesData)
      setTags(tagsData)
      setLoading(false)
    } catch (error) {
      console.error('Error loading global data:', error)
      setLoading(false)
    }
  }

  // Callback functions for settings page
  const handleCategoriesUpdate = (updatedCategories) => {
    setCategories(updatedCategories)
  }

  const handleTagsUpdate = (updatedTags) => {
    setTags(updatedTags)
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-white text-xl">Loading...</div>
        </div>
      )
    }

    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />
      case 'transactions':
        return <Transactions categories={categories} tags={tags} />
      case 'recurring':
        return <RecurringExpenses categories={categories} tags={tags} />
      case 'chat':
        return <Chat />
      case 'budgeting':
        return <BudgetingGoals />
      case 'investments':
        return <Investments />
      case 'vacations':
        return <Vacations />
      case 'settings':
        return (
          <SettingsPage 
            categories={categories}
            tags={tags}
            onCategoriesUpdate={handleCategoriesUpdate}
            onTagsUpdate={handleTagsUpdate}
          />
        )
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