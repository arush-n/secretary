import React, { useState, useEffect } from 'react';
import { 
  MoreVertical, Edit2, EyeOff, Eye, Trash2, X, Plus, Sparkles 
} from 'lucide-react';

const API_BASE = 'http://localhost:5001';

// Editable Recurring Expense Row Component
const RecurringExpenseRow = ({ expense, categories, availableTags = [], onUpdate }) => {
  const [showActions, setShowActions] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [localExpense, setLocalExpense] = useState(expense);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [aiInsight, setAiInsight] = useState(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);

  const getAiInsight = async () => {
    if (aiInsight) {
      setAiInsight(null);
      return;
    }
    setIsLoadingInsight(true);
    try {
      const response = await fetch(`${API_BASE}/api/transaction-insight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction: localExpense })
      });
      const data = await response.json();
      setAiInsight(data);
    } catch (error) {
      console.error('Failed to get AI insight:', error);
      setAiInsight({ insight: 'Error', advice: 'Could not retrieve advice.' });
    } finally {
      setIsLoadingInsight(false);
    }
  };

  const handleTagToggle = async (tag) => {
    const tags = localExpense.tags || [];
    const updatedTags = tags.includes(tag) 
      ? tags.filter(t => t !== tag)
      : [...tags, tag];
    
    const updated = { ...localExpense, tags: updatedTags };
    setLocalExpense(updated);
    if (onUpdate) onUpdate(updated);
  };

  const toggleExcluded = () => {
    const updated = { ...localExpense, excluded: !localExpense.excluded };
    setLocalExpense(updated);
    if (onUpdate) onUpdate(updated);
  };

  const handleDelete = () => {
    if (!window.confirm('Are you sure you want to delete this recurring expense?')) return;
    const updated = { ...localExpense, deleted: true };
    if (onUpdate) onUpdate(updated);
  };

  const handleFieldSave = (field, value) => {
    const updated = { ...localExpense, [field]: value };
    setLocalExpense(updated);
    if (onUpdate) onUpdate(updated);
    setEditingField(null);
    setEditValue('');
  };

  const quickActions = [
    {
      icon: Sparkles,
      label: 'AI Insight',
      action: getAiInsight,
      color: 'text-cyan-400'
    },
    {
      icon: Edit2,
      label: 'Edit Name',
      action: () => {
        setEditingField('description');
        setEditValue(localExpense.description);
      },
      color: 'text-blue-400'
    },
    {
      icon: localExpense.excluded ? Eye : EyeOff,
      label: localExpense.excluded ? 'Include' : 'Exclude',
      action: toggleExcluded,
      color: localExpense.excluded ? 'text-green-400' : 'text-gray-400'
    },
    {
      icon: Trash2,
      label: 'Delete',
      action: handleDelete,
      color: 'text-red-400'
    }
  ];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDaysUntilDue = (nextDueDate) => {
    if (!nextDueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date
    const due = new Date(nextDueDate);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getDueDateColor = (daysUntil) => {
    if (daysUntil === null) return 'text-gray-500';
    if (daysUntil < 0) return 'text-red-400';
    if (daysUntil <= 3) return 'text-orange-400';
    if (daysUntil <= 7) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'Housing': '🏠', 'Utilities': '💡', 'Insurance': '🛡️',
      'Subscriptions': '📺', 'Transportation': '🚗', 'Phone': '📱', 'Other': '📦'
    };
    return icons[category] || '📦';
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Housing': 'bg-blue-500', 'Utilities': 'bg-yellow-500', 'Insurance': 'bg-purple-500',
      'Subscriptions': 'bg-pink-500', 'Transportation': 'bg-green-500', 'Phone': 'bg-indigo-500', 'Other': 'bg-gray-500'
    };
    return colors[category] || 'bg-gray-500';
  };

  const availableTagsToAdd = availableTags.filter(t => !localExpense.tags?.includes(t));
  const daysUntil = getDaysUntilDue(localExpense.next_due);

  if (localExpense.deleted) return null;

  return (
    <div className={`bg-gray-900 border rounded-lg p-5 transition-colors relative ${
      localExpense.excluded ? 'border-yellow-600 opacity-60' : 'border-gray-800 hover:border-gray-700'
    }`}>
      {localExpense.excluded && (
        <div className="absolute top-2 right-2 bg-yellow-600 text-xs px-2 py-1 rounded text-black font-medium">
          excluded
        </div>
      )}

      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          <div className={`w-12 h-12 ${getCategoryColor(localExpense.category)} rounded-lg flex items-center justify-center flex-shrink-0`}>
            <span className="text-2xl">{getCategoryIcon(localExpense.category)}</span>
          </div>
          
          <div className="flex-1 min-w-0">
            {editingField === 'description' ? (
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFieldSave('description', editValue);
                    if (e.key === 'Escape') setEditingField(null);
                  }}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <button
                  onClick={() => handleFieldSave('description', editValue)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition"
                >
                  save
                </button>
                <button
                  onClick={() => setEditingField(null)}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition"
                >
                  cancel
                </button>
              </div>
            ) : (
              <h4 className="text-white font-medium text-lg mb-1">{localExpense.description}</h4>
            )}
            
            <div className="flex flex-wrap gap-3 text-sm text-gray-400 mb-2">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {localExpense.frequency}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {localExpense.occurrences} occurrence{localExpense.occurrences !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                last: {formatDate(localExpense.last_date)}
              </span>
            </div>

            {/* MODIFICATION: Combined Due Date and Tags */}
            <div className="mt-3 flex items-center gap-4 flex-wrap">
              {localExpense.next_due && (
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 ${getDueDateColor(daysUntil)}`}>
                  <span className="text-sm font-medium">
                    {daysUntil !== null && (
                      daysUntil < 0 ? `Overdue by ${Math.abs(daysUntil)} days` :
                      daysUntil === 0 ? 'Due Today' :
                      daysUntil === 1 ? 'Due Tomorrow' :
                      `Due in ${daysUntil} days`
                    )}
                  </span>
                  <span className="text-xs opacity-75">({formatDate(localExpense.next_due)})</span>
                </div>
              )}

              <div className="flex flex-wrap gap-1 items-center">
                {(localExpense.tags || []).map(tag => (
                  <span key={tag} className="text-xs bg-blue-600 px-2 py-1 rounded flex items-center gap-1">
                    {tag}
                    <X className="w-3 h-3 cursor-pointer hover:text-red-300" onClick={() => handleTagToggle(tag)} />
                  </span>
                ))}
                
                {availableTagsToAdd.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowTagDropdown(!showTagDropdown)}
                      className="w-6 h-6 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded flex items-center justify-center transition"
                      title="Add tag"
                    >
                      <Plus className="w-3 h-3 text-gray-400" />
                    </button>
                    
                    {showTagDropdown && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowTagDropdown(false)} />
                        <div className="absolute left-0 top-8 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-20 py-1 min-w-[150px]">
                          {availableTagsToAdd.map(tag => (
                            <button
                              key={tag}
                              onClick={() => {
                                handleTagToggle(tag);
                                setShowTagDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-800 text-white text-xs transition"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 ml-4">
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-light text-white mb-1">
              {formatCurrency(localExpense.average_amount)}
            </div>
            <div className="text-xs text-gray-500">per {localExpense.frequency.toLowerCase()}</div>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-2 hover:bg-gray-700 rounded-lg transition"
            >
              <MoreVertical className="w-5 h-5 text-gray-400" />
            </button>

            {showActions && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
                <div className="absolute right-0 top-10 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-20 py-2 w-48">
                  {quickActions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        action.action();
                        setShowActions(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-800 flex items-center gap-3 transition"
                    >
                      <action.icon className={`w-4 h-4 ${action.color}`} />
                      <span className="text-white text-sm">{action.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      { (isLoadingInsight || aiInsight) && (
        <div className="mt-4 p-4 bg-gray-700 rounded-lg border border-gray-600">
          {isLoadingInsight ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              generating insight...
            </div>
          ) : (
            <div>
              <p className="text-sm text-cyan-300">{aiInsight.insight}</p>
              <p className="text-sm text-gray-300 mt-2">{aiInsight.advice}</p>
            </div>
          )}
        </div>
      )}
      
      {localExpense.transactions && localExpense.transactions.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-white">
            View transaction history ({localExpense.transactions.length})
          </summary>
          <div className="mt-3 space-y-2 ml-4">
            {localExpense.transactions.slice(0, 5).map((t, i) => (
              <div key={i} className="flex justify-between text-xs text-gray-500">
                <span>{formatDate(t.date)}</span>
                <span>{formatCurrency(t.amount)}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

// Main Component
function RecurringExpenses({ 
  categories = ['housing', 'utilities', 'insurance', 'subscriptions', 'transportation', 'phone', 'other'], 
  tags = ['personal', 'business', 'shared', 'tax-deductible'] 
}) {
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalMonthly, setTotalMonthly] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('list');

  useEffect(() => {
    fetchRecurringExpenses();
  }, []);

  useEffect(() => {
    const total = recurringExpenses
      .filter(exp => !exp.excluded && !exp.deleted)
      .reduce((sum, exp) => sum + exp.average_amount, 0);
    setTotalMonthly(total);
  }, [recurringExpenses]);

  const fetchRecurringExpenses = async () => {
    try {
      setIsLoading(true);
      const customerId = '68f3e5a29683f20dd519e4ea';
      const response = await fetch(`${API_BASE}/get-recurring-expenses?customerId=${customerId}`);
      
      if (!response.ok) throw new Error('Failed to fetch recurring expenses');
      
      let data = await response.json();

      const expensesWithIds = (data.recurring_expenses || []).map((exp, index) => ({
        ...exp,
        id: exp.id || `${exp.description}-${index}` 
      }));

      setRecurringExpenses(expensesWithIds);
      
      if (expensesWithIds.length > 0) {
        if (expensesWithIds[0].source === 'demo') {
          console.log('📊 Using demo recurring expenses data');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExpenseUpdate = (updatedExpense) => {
    setRecurringExpenses(prevExpenses =>
      prevExpenses
        .map(exp => (exp.id === updatedExpense.id ? updatedExpense : exp))
        .filter(exp => !exp.deleted)
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', minimumFractionDigits: 2
    }).format(amount);
  };
  
  const getCategoryIcon = (category) => {
    const icons = {
      'Housing': '🏠', 'Utilities': '💡', 'Insurance': '🛡️',
      'Subscriptions': '📺', 'Transportation': '🚗', 'Phone': '📱', 'Other': '📦'
    };
    return icons[category] || '📦';
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Housing': 'bg-blue-500', 'Utilities': 'bg-yellow-500', 'Insurance': 'bg-purple-500',
      'Subscriptions': 'bg-pink-500', 'Transportation': 'bg-green-500', 'Phone': 'bg-indigo-500', 'Other': 'bg-gray-500'
    };
    return colors[category] || 'bg-gray-500';
  };

  const getFilteredExpenses = () => {
    const filtered = recurringExpenses.filter(exp => !exp.deleted);
    if (selectedCategory === 'all') return filtered;
    return filtered.filter(exp => exp.category === selectedCategory);
  };

  const getCategoryTotals = () => {
    const totals = {};
    recurringExpenses.filter(exp => !exp.excluded && !exp.deleted).forEach(exp => {
      const category = exp.category || 'Other';
      totals[category] = (totals[category] || 0) + exp.average_amount;
    });
    return totals;
  };

  const getUpcomingExpenses = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return recurringExpenses
      .filter(exp => !exp.excluded && !exp.deleted && exp.next_due)
      .map(exp => {
        const due = new Date(exp.next_due);
        const diffTime = due.getTime() - today.getTime();
        const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { ...exp, daysUntil };
      })
      .filter(exp => exp.daysUntil >= 0 && exp.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">analyzing recurring expenses...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  const filteredExpenses = getFilteredExpenses();
  const categoryTotals = getCategoryTotals();
  const upcomingExpenses = getUpcomingExpenses();
  const isDemoData = recurringExpenses.length > 0 && recurringExpenses[0].source === 'demo';
  const activeExpenses = recurringExpenses.filter(e => !e.deleted && !e.excluded);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-light text-white">recurring expenses</h1>
        <p className="text-gray-500 mt-1 text-sm">track and manage your regular bills</p>
      </div>

      {isDemoData && (
        <div className="mb-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">ℹ️</span>
            <div>
              <h3 className="text-white font-medium mb-1">demo data</h3>
              <p className="text-sm text-blue-300">
                showing realistic demo recurring expenses. the nessie api has limited transaction data, so we're displaying typical bills, subscriptions, and loan payments you might have.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">total monthly</div>
          <div className="text-3xl font-light text-white">{formatCurrency(totalMonthly)}</div>
          <div className="text-xs text-gray-500 mt-2">{activeExpenses.length} recurring expenses</div>
        </div>
        
        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">due this week</div>
          <div className="text-3xl font-light text-orange-400">
            {upcomingExpenses.filter(e => e.daysUntil <= 7).length}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {formatCurrency(upcomingExpenses.filter(e => e.daysUntil <= 7).reduce((sum, e) => sum + e.average_amount, 0))}
          </div>
        </div>

        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-2">largest expense</div>
          <div className="text-3xl font-light text-red-400">
            {activeExpenses.length > 0 
              ? formatCurrency(Math.max(...activeExpenses.map(e => e.average_amount)))
              : '$0.00'}
          </div>
          <div className="text-xs text-gray-500 mt-2 truncate">
            {activeExpenses.length > 0 
              ? activeExpenses.sort((a, b) => b.average_amount - a.average_amount)[0].description 
              : 'N/A'}
          </div>
        </div>
      </div>

      <div className="mb-8 bg-black border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-medium text-white mb-4">by category</h3>
        <div className="space-y-3">
          {Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([category, total]) => {
            const percentage = total > 0 && totalMonthly > 0 ? (total / totalMonthly) * 100 : 0;
            return (
              <div key={category}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getCategoryIcon(category)}</span>
                    <span className="text-sm text-white font-medium">{category}</span>
                  </div>
                  <span className="text-sm text-white">{formatCurrency(total)}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${getCategoryColor(category)}`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
              selectedCategory === 'all' ? 'bg-white text-black' : 'bg-gray-900 text-gray-400 hover:text-white'
            }`}
          >
            all categories
          </button>
          {Object.keys(categoryTotals).map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex items-center gap-2 ${
                selectedCategory === category ? 'bg-white text-black' : 'bg-gray-900 text-gray-400 hover:text-white'
              }`}
            >
              <span>{getCategoryIcon(category)}</span>
              <span>{category}</span>
            </button>
          ))}
        </div>
      </div>

      {upcomingExpenses.length > 0 && (
        <div className="mb-6 bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⏰</span>
            <div>
              <h3 className="text-white font-medium mb-1">upcoming bills</h3>
              <p className="text-sm text-orange-300">
                you have {upcomingExpenses.length} bill{upcomingExpenses.length !== 1 ? 's' : ''} due in the next 30 days
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {upcomingExpenses.slice(0, 3).map((exp, idx) => (
                  <div key={idx} className="bg-gray-900 rounded-lg px-3 py-2 text-xs">
                    <span className="text-white font-medium">{exp.description}</span>
                    <span className="text-gray-400 mx-2">•</span>
                    <span className="text-orange-400">
                      {exp.daysUntil === 0 ? 'Today' : exp.daysUntil === 1 ? 'Tomorrow' : `in ${exp.daysUntil} days`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {filteredExpenses.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p className="text-lg">no recurring expenses found for this category</p>
          </div>
        ) : (
          filteredExpenses.map((expense) => (
            <RecurringExpenseRow
              key={expense.id}
              expense={expense}
              categories={categories}
              availableTags={tags}
              onUpdate={handleExpenseUpdate}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default RecurringExpenses;