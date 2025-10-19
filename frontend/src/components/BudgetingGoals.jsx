import React, { useState, useEffect } from 'react'

function BudgetingGoals() {
  const [budgets, setBudgets] = useState([])
  const [goals, setGoals] = useState([])
  const [recurringExpenses, setRecurringExpenses] = useState([])
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [totalSpending, setTotalSpending] = useState(0)
  const [availableForSavings, setAvailableForSavings] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [activeTab, setActiveTab] = useState('overview') // overview, budgets, goals

  // Form states
  const [newBudget, setNewBudget] = useState({
    category: '',
    amount: '',
    type: 'flexible' // mandatory or flexible
  })

  const [newGoal, setNewGoal] = useState({
    name: '',
    targetAmount: '',
    currentAmount: 0,
    savingsAllocation: 10, // percentage
    deadline: ''
  })

  useEffect(() => {
    fetchBudgetData()
  }, [])

  useEffect(() => {
    calculateFinancials()
  }, [budgets, recurringExpenses, goals])

  const fetchBudgetData = async () => {
    try {
      setIsLoading(true)
      const customerId = '68f3e5a29683f20dd519e4ea'
      
      // Fetch recurring expenses
      const recurringResponse = await fetch(`/api/get-recurring-expenses?customerId=${customerId}`)
      const recurringData = await recurringResponse.json()
      setRecurringExpenses(recurringData.recurring_expenses || [])
      
      // Fetch transactions to calculate income
      const transactionsResponse = await fetch(`/api/get-all-transactions?customerId=${customerId}&days=30`)
      const transactionsData = await transactionsResponse.json()
      
      const income = transactionsData.transactions
        .filter(t => parseFloat(t.amount) > 0)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0)
      
      setMonthlyIncome(income)
      
      // Load saved budgets and goals from localStorage
      const savedBudgets = JSON.parse(localStorage.getItem('budgets') || '[]')
      const savedGoals = JSON.parse(localStorage.getItem('goals') || '[]')
      
      setBudgets(savedBudgets)
      setGoals(savedGoals)
      
    } catch (err) {
      console.error('Error fetching budget data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const calculateFinancials = () => {
    // Calculate mandatory expenses (recurring)
    const mandatoryTotal = recurringExpenses.reduce((sum, exp) => sum + exp.average_amount, 0)
    
    // Calculate discretionary budget total
    const discretionaryTotal = budgets.reduce((sum, budget) => sum + parseFloat(budget.amount || 0), 0)
    
    const total = mandatoryTotal + discretionaryTotal
    setTotalSpending(total)
    
    const available = monthlyIncome - total
    setAvailableForSavings(available)
  }

  const addBudget = () => {
    if (!newBudget.category || !newBudget.amount) return
    
    const budget = {
      id: Date.now(),
      ...newBudget,
      amount: parseFloat(newBudget.amount)
    }
    
    const updated = [...budgets, budget]
    setBudgets(updated)
    localStorage.setItem('budgets', JSON.stringify(updated))
    
    setNewBudget({ category: '', amount: '', type: 'flexible' })
    setShowBudgetModal(false)
  }

  const deleteBudget = (id) => {
    const updated = budgets.filter(b => b.id !== id)
    setBudgets(updated)
    localStorage.setItem('budgets', JSON.stringify(updated))
  }

  const addGoal = () => {
    if (!newGoal.name || !newGoal.targetAmount) return
    
    const goal = {
      id: Date.now(),
      ...newGoal,
      targetAmount: parseFloat(newGoal.targetAmount),
      currentAmount: parseFloat(newGoal.currentAmount || 0),
      createdAt: new Date().toISOString()
    }
    
    const updated = [...goals, goal]
    setGoals(updated)
    localStorage.setItem('goals', JSON.stringify(updated))
    
    setNewGoal({ name: '', targetAmount: '', currentAmount: 0, savingsAllocation: 10, deadline: '' })
    setShowGoalModal(false)
  }

  const updateGoalProgress = (goalId, amount) => {
    const updated = goals.map(g => 
      g.id === goalId ? { ...g, currentAmount: g.currentAmount + amount } : g
    )
    setGoals(updated)
    localStorage.setItem('goals', JSON.stringify(updated))
  }

  const deleteGoal = (id) => {
    const updated = goals.filter(g => g.id !== id)
    setGoals(updated)
    localStorage.setItem('goals', JSON.stringify(updated))
  }

  const calculateGoalProjection = (goal) => {
    const remaining = goal.targetAmount - goal.currentAmount
    const monthlyContribution = (availableForSavings * goal.savingsAllocation) / 100
    
    if (monthlyContribution <= 0) return { months: Infinity, achievable: false }
    
    const months = Math.ceil(remaining / monthlyContribution)
    const projectedDate = new Date()
    projectedDate.setMonth(projectedDate.getMonth() + months)
    
    return {
      months,
      projectedDate: projectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      monthlyContribution,
      achievable: true
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const getCategoryIcon = (category) => {
    const icons = {
      'Food': '🍔',
      'Entertainment': '🎬',
      'Shopping': '🛍️',
      'Transportation': '🚗',
      'Healthcare': '⚕️',
      'Education': '📚',
      'Personal': '👤',
      'Other': '📦'
    }
    return icons[category] || '📦'
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">Loading budget data...</p>
        </div>
      </div>
    )
  }

  const savingsRate = monthlyIncome > 0 ? ((availableForSavings / monthlyIncome) * 100) : 0

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-light text-white">Budgeting & Goals</h1>
        <p className="text-gray-500 mt-1 text-sm">Manage your budget and track your financial goals</p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8 flex gap-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-3 rounded-lg font-medium ${
            activeTab === 'overview' ? 'bg-white text-black' : 'bg-gray-900 text-gray-400 hover:text-white'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('budgets')}
          className={`px-6 py-3 rounded-lg font-medium ${
            activeTab === 'budgets' ? 'bg-white text-black' : 'bg-gray-900 text-gray-400 hover:text-white'
          }`}
        >
          Budgets
        </button>
        <button
          onClick={() => setActiveTab('goals')}
          className={`px-6 py-3 rounded-lg font-medium ${
            activeTab === 'goals' ? 'bg-white text-black' : 'bg-gray-900 text-gray-400 hover:text-white'
          }`}
        >
          Goals
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Financial Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <div className="text-sm text-gray-400 mb-2">Monthly Income</div>
              <div className="text-3xl font-light text-green-400">{formatCurrency(monthlyIncome)}</div>
            </div>
            
            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <div className="text-sm text-gray-400 mb-2">Total Spending</div>
              <div className="text-3xl font-light text-red-400">{formatCurrency(totalSpending)}</div>
              <div className="text-xs text-gray-500 mt-1">
                {recurringExpenses.length} recurring + {budgets.length} budgets
              </div>
            </div>
            
            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <div className="text-sm text-gray-400 mb-2">Available for Savings</div>
              <div className={`text-3xl font-light ${availableForSavings >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(availableForSavings)}
              </div>
            </div>
            
            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <div className="text-sm text-gray-400 mb-2">Savings Rate</div>
              <div className={`text-3xl font-light ${savingsRate >= 20 ? 'text-green-400' : savingsRate >= 10 ? 'text-yellow-400' : 'text-red-400'}`}>
                {savingsRate.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Target: 20%+
              </div>
            </div>
          </div>

          {/* Budget Breakdown Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Spending Breakdown */}
            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-medium text-white mb-4">Monthly Breakdown</h3>
              
              <div className="space-y-4">
                {/* Mandatory Expenses */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-white font-medium">Mandatory Expenses</span>
                    <span className="text-sm text-red-400">
                      {formatCurrency(recurringExpenses.reduce((sum, exp) => sum + exp.average_amount, 0))}
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-3">
                    <div 
                      className="bg-red-500 h-3 rounded-full" 
                      style={{ 
                        width: `${monthlyIncome > 0 ? (recurringExpenses.reduce((sum, exp) => sum + exp.average_amount, 0) / monthlyIncome * 100) : 0}%` 
                      }}
                    />
                  </div>
                </div>

                {/* Discretionary Budget */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-white font-medium">Discretionary Budget</span>
                    <span className="text-sm text-orange-400">
                      {formatCurrency(budgets.reduce((sum, budget) => sum + budget.amount, 0))}
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-3">
                    <div 
                      className="bg-orange-500 h-3 rounded-full" 
                      style={{ 
                        width: `${monthlyIncome > 0 ? (budgets.reduce((sum, budget) => sum + budget.amount, 0) / monthlyIncome * 100) : 0}%` 
                      }}
                    />
                  </div>
                </div>

                {/* Available for Savings */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-white font-medium">Available for Savings</span>
                    <span className={`text-sm ${availableForSavings >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(availableForSavings)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full ${availableForSavings >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ 
                        width: `${monthlyIncome > 0 ? Math.abs(availableForSavings / monthlyIncome * 100) : 0}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Goals Progress Summary */}
            <div className="bg-black border border-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-white">Active Goals</h3>
                <button
                  onClick={() => setShowGoalModal(true)}
                  className="text-sm text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg"
                >
                  + Add Goal
                </button>
              </div>
              
              {goals.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <p className="text-sm">No goals set yet</p>
                  <p className="text-xs mt-1">Create a goal to start saving!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {goals.slice(0, 3).map(goal => {
                    const progress = (goal.currentAmount / goal.targetAmount) * 100
                    const projection = calculateGoalProjection(goal)
                    
                    return (
                      <div key={goal.id} className="p-4 bg-gray-900 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="text-white font-medium">{goal.name}</h4>
                            <p className="text-xs text-gray-400 mt-1">
                              {projection.achievable ? `Est. ${projection.months} months` : 'Adjust budget to achieve'}
                            </p>
                          </div>
                          <span className="text-sm text-white">
                            {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2 mb-1">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all" 
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500">{progress.toFixed(0)}% complete</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Smart Insights */}
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg p-6 mb-8">
            <div className="flex items-start gap-3">
              <span className="text-3xl">💡</span>
              <div className="flex-1">
                <h3 className="text-white font-medium mb-2">Smart Insights</h3>
                <div className="space-y-2 text-sm text-gray-300">
                  {savingsRate < 10 && (
                    <p>• Your savings rate is below the recommended 20%. Consider reviewing your discretionary budgets.</p>
                  )}
                  {availableForSavings < 0 && (
                    <p className="text-red-400">• ⚠️ You're spending more than you earn! Review and reduce your budgets to avoid debt.</p>
                  )}
                  {availableForSavings > monthlyIncome * 0.3 && (
                    <p className="text-green-400">• 🎉 Excellent! You're saving over 30% of your income. Consider increasing goal allocations.</p>
                  )}
                  {goals.length === 0 && (
                    <p>• Set specific financial goals to stay motivated and track your progress.</p>
                  )}
                  {budgets.length === 0 && (
                    <p>• Create discretionary budgets to better control your spending on non-essential categories.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Budgets Tab */}
      {activeTab === 'budgets' && (
        <>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-medium text-white">Your Budgets</h2>
              <p className="text-sm text-gray-400 mt-1">Manage your spending limits by category</p>
            </div>
            <button
              onClick={() => setShowBudgetModal(true)}
              className="bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              + Create Budget
            </button>
          </div>

          {/* Mandatory Expenses (Recurring) */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <span>🔒</span>
              Mandatory Expenses (Recurring)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recurringExpenses.slice(0, 6).map((expense, idx) => (
                <div key={idx} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="text-white font-medium text-sm">{expense.description}</h4>
                      <p className="text-xs text-gray-500 mt-1">{expense.category}</p>
                    </div>
                    <span className="text-lg font-light text-red-400">
                      {formatCurrency(expense.average_amount)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {expense.frequency} • Fixed
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Discretionary Budgets */}
          <div>
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <span>📊</span>
              Discretionary Budgets
            </h3>
            
            {budgets.length === 0 ? (
              <div className="text-center text-gray-500 py-12 bg-gray-900 rounded-lg">
                <p className="text-lg mb-2">No budgets created yet</p>
                <p className="text-sm">Create budgets for categories like dining out, entertainment, shopping, etc.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {budgets.map(budget => (
                  <div key={budget.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 relative group">
                    <button
                      onClick={() => deleteBudget(budget.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white p-1.5 rounded-lg text-xs"
                    >
                      Delete
                    </button>
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-2xl">{getCategoryIcon(budget.category)}</span>
                      <div className="flex-1">
                        <h4 className="text-white font-medium">{budget.category}</h4>
                        <p className="text-xs text-gray-500 capitalize">{budget.type} budget</p>
                      </div>
                    </div>
                    <div className="text-2xl font-light text-white mb-1">
                      {formatCurrency(budget.amount)}
                    </div>
                    <div className="text-xs text-gray-500">per month</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Goals Tab */}
      {activeTab === 'goals' && (
        <>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-medium text-white">Your Financial Goals</h2>
              <p className="text-sm text-gray-400 mt-1">Track progress and see when you'll reach your goals</p>
            </div>
            <button
              onClick={() => setShowGoalModal(true)}
              className="bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              + Create Goal
            </button>
          </div>

          {goals.length === 0 ? (
            <div className="text-center text-gray-500 py-12 bg-gray-900 rounded-lg">
              <span className="text-5xl mb-4 block">🎯</span>
              <p className="text-lg mb-2">No goals set yet</p>
              <p className="text-sm">Create financial goals like emergency fund, vacation, down payment, etc.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {goals.map(goal => {
                const progress = (goal.currentAmount / goal.targetAmount) * 100
                const projection = calculateGoalProjection(goal)
                const remaining = goal.targetAmount - goal.currentAmount
                
                return (
                  <div key={goal.id} className="bg-gray-900 border border-gray-800 rounded-lg p-6 relative group">
                    <button
                      onClick={() => deleteGoal(goal.id)}
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                    >
                      Delete Goal
                    </button>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Goal Info */}
                      <div className="lg:col-span-2">
                        <h3 className="text-2xl font-light text-white mb-2">{goal.name}</h3>
                        
                        <div className="flex items-center gap-4 mb-4">
                          <div>
                            <span className="text-sm text-gray-400">Progress: </span>
                            <span className="text-lg font-medium text-white">
                              {formatCurrency(goal.currentAmount)}
                            </span>
                            <span className="text-gray-500"> / {formatCurrency(goal.targetAmount)}</span>
                          </div>
                          <div className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
                            {progress.toFixed(0)}% Complete
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-gray-800 rounded-full h-4 mb-4">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-4 rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Remaining</div>
                            <div className="text-lg font-medium text-white">{formatCurrency(remaining)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Allocation</div>
                            <div className="text-lg font-medium text-white">{goal.savingsAllocation}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Monthly Contribution</div>
                            <div className="text-lg font-medium text-green-400">
                              {formatCurrency(projection.monthlyContribution)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Projection */}
                      <div className="bg-black border border-gray-700 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-400 mb-3">📊 Projection</h4>
                        
                        {projection.achievable ? (
                          <>
                            <div className="mb-4">
                              <div className="text-xs text-gray-500 mb-1">Estimated Time</div>
                              <div className="text-2xl font-light text-white mb-1">
                                {projection.months} months
                              </div>
                              <div className="text-xs text-gray-400">
                                Target: {projection.projectedDate}
                              </div>
                            </div>

                            {goal.deadline && (
                              <div className="pt-3 border-t border-gray-800">
                                <div className="text-xs text-gray-500 mb-1">Your Deadline</div>
                                <div className="text-sm text-white">
                                  {new Date(goal.deadline).toLocaleDateString('en-US', { 
                                    month: 'long', 
                                    day: 'numeric',
                                    year: 'numeric' 
                                  })}
                                </div>
                                {new Date(goal.deadline) < new Date(projection.projectedDate) && (
                                  <div className="text-xs text-orange-400 mt-1">
                                    ⚠️ May miss deadline. Increase allocation.
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-sm text-red-400">
                            ⚠️ Not enough savings available. Review your budget to allocate more funds.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Add Budget Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowBudgetModal(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-md w-full m-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-medium text-white mb-4">Create New Budget</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-2">Category</label>
                <select
                  value={newBudget.category}
                  onChange={(e) => setNewBudget({...newBudget, category: e.target.value})}
                  className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
                >
                  <option value="">Select Category</option>
                  <option value="Food">Food & Dining</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Transportation">Transportation</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Education">Education</option>
                  <option value="Personal">Personal Care</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-2">Monthly Amount</label>
                <input
                  type="number"
                  value={newBudget.amount}
                  onChange={(e) => setNewBudget({...newBudget, amount: e.target.value})}
                  placeholder="500"
                  className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-2">Type</label>
                <select
                  value={newBudget.type}
                  onChange={(e) => setNewBudget({...newBudget, type: e.target.value})}
                  className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
                >
                  <option value="flexible">Flexible (Can adjust)</option>
                  <option value="mandatory">Mandatory (Fixed)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBudgetModal(false)}
                className="flex-1 bg-gray-800 text-white px-4 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addBudget}
                className="flex-1 bg-white text-black px-4 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Create Budget
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowGoalModal(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-md w-full m-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-medium text-white mb-4">Create New Goal</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-2">Goal Name</label>
                <input
                  type="text"
                  value={newGoal.name}
                  onChange={(e) => setNewGoal({...newGoal, name: e.target.value})}
                  placeholder="Emergency Fund"
                  className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-2">Target Amount</label>
                <input
                  type="number"
                  value={newGoal.targetAmount}
                  onChange={(e) => setNewGoal({...newGoal, targetAmount: e.target.value})}
                  placeholder="10000"
                  className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-2">Current Amount (Optional)</label>
                <input
                  type="number"
                  value={newGoal.currentAmount}
                  onChange={(e) => setNewGoal({...newGoal, currentAmount: e.target.value})}
                  placeholder="0"
                  className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-2">
                  Savings Allocation ({newGoal.savingsAllocation}% of available savings)
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={newGoal.savingsAllocation}
                  onChange={(e) => setNewGoal({...newGoal, savingsAllocation: parseInt(e.target.value)})}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1%</span>
                  <span className="text-white font-medium">
                    {formatCurrency((availableForSavings * newGoal.savingsAllocation) / 100)}/month
                  </span>
                  <span>100%</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-2">Target Deadline (Optional)</label>
                <input
                  type="date"
                  value={newGoal.deadline}
                  onChange={(e) => setNewGoal({...newGoal, deadline: e.target.value})}
                  className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowGoalModal(false)}
                className="flex-1 bg-gray-800 text-white px-4 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addGoal}
                className="flex-1 bg-white text-black px-4 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Create Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BudgetingGoals