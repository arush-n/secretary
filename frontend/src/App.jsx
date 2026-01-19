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
import OnboardingWizard from './components/OnboardingWizard'

// Default categories and tags
const DEFAULT_CATEGORIES = [
  'Food & Drink',
  'Shopping',
  'Transport',
  'Bills & Utilities',
  'Entertainment',
  'Groceries',
  'Healthcare',
  'Travel',
  'Other'
]

const DEFAULT_TAGS = [
  'Business',
  'Personal',
  'Tax Deductible',
  'Reimbursable'
]

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingChecked, setOnboardingChecked] = useState(false)

  // Load categories, tags, and preferences from localStorage or use defaults
  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('secretary_categories')
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES
  })

  const [tags, setTags] = useState(() => {
    const saved = localStorage.getItem('secretary_tags')
    return saved ? JSON.parse(saved) : DEFAULT_TAGS
  })

  const [preferences, setPreferences] = useState(() => {
    const saved = localStorage.getItem('secretary_preferences')
    return saved ? JSON.parse(saved) : []
  })

  // Check if onboarding is needed on mount
  useEffect(() => {
    const checkOnboarding = async () => {
      // Check localStorage first for quick skip
      const skipped = localStorage.getItem('secretary_onboarding_skipped')
      const completed = localStorage.getItem('secretary_onboarding_completed')

      if (skipped || completed) {
        setOnboardingChecked(true)
        return
      }

      // Check backend for onboarding status
      try {
        const res = await fetch('http://localhost:5001/api/profile')
        if (res.ok) {
          const profile = await res.json()
          if (!profile.core?.onboarding_completed) {
            setShowOnboarding(true)
          }
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error)
      }
      setOnboardingChecked(true)
    }

    checkOnboarding()
  }, [])

  const handleOnboardingComplete = () => {
    localStorage.setItem('secretary_onboarding_completed', 'true')
    setShowOnboarding(false)
  }

  const handleOnboardingSkip = () => {
    localStorage.setItem('secretary_onboarding_skipped', 'true')
    setShowOnboarding(false)
  }

  // Fetch categories and tags from backend on mount
  useEffect(() => {
    const fetchCategoriesAndTags = async () => {
      try {
        // Fetch categories
        const categoriesRes = await fetch('http://localhost:5001/get-categories')
        if (categoriesRes.ok) {
          const fetchedCategories = await categoriesRes.json()
          // Merge with localStorage - localStorage takes precedence
          const savedCategories = localStorage.getItem('secretary_categories')
          if (savedCategories) {
            setCategories(JSON.parse(savedCategories))
          } else if (fetchedCategories && fetchedCategories.length > 0) {
            setCategories(fetchedCategories)
            localStorage.setItem('secretary_categories', JSON.stringify(fetchedCategories))
          }
        }

        // Fetch tags
        const tagsRes = await fetch('http://localhost:5001/get-tags')
        if (tagsRes.ok) {
          const fetchedTags = await tagsRes.json()
          // Merge with localStorage - localStorage takes precedence
          const savedTags = localStorage.getItem('secretary_tags')
          if (savedTags) {
            setTags(JSON.parse(savedTags))
          } else if (fetchedTags && fetchedTags.length > 0) {
            setTags(fetchedTags)
            localStorage.setItem('secretary_tags', JSON.stringify(fetchedTags))
          }
        }
      } catch (error) {
        console.error('Error fetching categories/tags from backend:', error)
        // Continue with localStorage or defaults on error
      }
    }

    fetchCategoriesAndTags()
  }, [])

  // Initialize RAG data on app startup
  useEffect(() => {
    const initializeRAG = async () => {
      try {
        const res = await fetch('http://localhost:5001/api/rag/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force_refresh: false })
        });
        const data = await res.json();
        if (data.success) {
          console.log('RAG initialized:', data.message, data.stats);
        } else {
          console.warn('RAG initialization skipped:', data.message);
        }
      } catch (err) {
        console.warn('RAG initialization failed (non-blocking):', err.message);
      }
    };
    initializeRAG();
  }, [])

  // Save to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('secretary_categories', JSON.stringify(categories))
  }, [categories])

  useEffect(() => {
    localStorage.setItem('secretary_tags', JSON.stringify(tags))
  }, [tags])

  useEffect(() => {
    localStorage.setItem('secretary_preferences', JSON.stringify(preferences))
  }, [preferences])

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView categories={categories} tags={tags} />
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
            preferences={preferences}
            onCategoriesUpdate={setCategories}
            onTagsUpdate={setTags}
            onPreferencesUpdate={setPreferences}
          />
        )
      case 'recurring':
        return <RecurringExpenses categories={categories} tags={tags} />
      case 'transactions':
        return <Transactions categories={categories} tags={tags} />
      default:
        return <DashboardView categories={categories} tags={tags} />
    }
  }

  return (
    <div className="h-screen bg-black flex overflow-hidden">
      {/* Onboarding Wizard */}
      {showOnboarding && (
        <OnboardingWizard
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}

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