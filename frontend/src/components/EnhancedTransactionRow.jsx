import React, { useState } from 'react';
import { 
  MoreVertical, Edit2, Calendar, FileText, EyeOff, Eye, 
  Trash2, Split, Tag, X, Plus, Sparkles 
} from 'lucide-react';
import TransactionSplitModal from './TransactionSplitModal';
import { InlineNameEditor, InlineDateEditor, InlineNoteEditor } from './InlinedEditor';

const API_BASE = 'http://localhost:5001';

const EnhancedTransactionRow = ({ 
  transaction, 
  categories = [], 
  availableTags = [],
  onUpdate 
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [localTransaction, setLocalTransaction] = useState(transaction);
  const [aiInsight, setAiInsight] = useState(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);

  const getAiInsight = async () => {
    if (aiInsight) {
      setAiInsight(null); // Allow hiding the insight
      return;
    }
    
    setIsLoadingInsight(true);
    try {
      const response = await fetch(`${API_BASE}/api/transaction-insight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction: localTransaction })
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

  const handleFieldSave = async (field, value) => {
    const updates = { [field]: value };
    
    try {
      const response = await fetch(`${API_BASE}/update-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: localTransaction._id,
          updates
        })
      });

      if (response.ok) {
        const updated = { ...localTransaction, [field]: value };
        setLocalTransaction(updated);
        if (onUpdate) onUpdate(updated);
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert('Failed to update transaction');
    }
    
    setEditingField(null);
  };

  const toggleExcluded = async () => {
    const updates = { excluded: !localTransaction.excluded };
    
    try {
      const response = await fetch(`${API_BASE}/update-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: localTransaction._id,
          updates
        })
      });

      if (response.ok) {
        const updated = { ...localTransaction, excluded: !localTransaction.excluded };
        setLocalTransaction(updated);
        if (onUpdate) onUpdate(updated);
      }
    } catch (error) {
      console.error('Error toggling exclusion:', error);
    }
  };

  const handleCategoryChange = async (newCategory) => {
    const updates = { category: newCategory };
    
    try {
      const response = await fetch(`${API_BASE}/update-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: localTransaction._id,
          updates
        })
      });

      if (response.ok) {
        const updated = { ...localTransaction, category: newCategory };
        setLocalTransaction(updated);
        if (onUpdate) onUpdate(updated);
      }
    } catch (error) {
      console.error('Error updating category:', error);
    }
  };

  const handleTagToggle = async (tag) => {
    const tags = localTransaction.tags || [];
    const updatedTags = tags.includes(tag) 
      ? tags.filter(t => t !== tag)
      : [...tags, tag];
    
    const updates = { tags: updatedTags };
    
    try {
      const response = await fetch(`${API_BASE}/update-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: localTransaction._id,
          updates
        })
      });

      if (response.ok) {
        const updated = { ...localTransaction, tags: updatedTags };
        setLocalTransaction(updated);
        if (onUpdate) onUpdate(updated);
      }
    } catch (error) {
      console.error('Error updating tags:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this transaction?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/delete-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: localTransaction._id
        })
      });

      if (response.ok) {
        if (onUpdate) onUpdate({ ...localTransaction, deleted: true });
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Failed to delete transaction');
    }
  };

  const handleSplitSave = async (splits) => {
    const updates = { splits, isSplit: true };
    
    try {
      const response = await fetch(`${API_BASE}/update-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: localTransaction._id,
          updates
        })
      });

      if (response.ok) {
        const updated = { ...localTransaction, splits, isSplit: true };
        setLocalTransaction(updated);
        if (onUpdate) onUpdate(updated);
      }
    } catch (error) {
      console.error('Error saving split:', error);
      alert('Failed to save split');
    }
    
    setShowSplitModal(false);
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'Food & Drink': '🍔',
      'Shopping': '🛍️',
      'Transport': '🚗',
      'Bills & Utilities': '💡',
      'Entertainment': '🎬',
      'Groceries': '🛒',
      'Healthcare': '⚕️',
      'Travel': '✈️',
      'Other': '📦'
    }
    return icons[category] || '📦'
  }

  const getCategoryColor = (category) => {
    const colors = {
      'Food & Drink': 'bg-red-500',
      'Shopping': 'bg-purple-500',
      'Transport': 'bg-blue-500',
      'Bills & Utilities': 'bg-yellow-500',
      'Entertainment': 'bg-pink-500',
      'Groceries': 'bg-green-500',
      'Healthcare': 'bg-teal-500',
      'Travel': 'bg-indigo-500',
      'Other': 'bg-gray-500'
    }
    return colors[category] || 'bg-gray-500'
  }

  const quickActions = [
    {
      icon: Sparkles,
      label: 'AI Insight',
      action: getAiInsight,
      color: 'text-cyan-400'
    },
    {
      icon: Split,
      label: 'Split',
      action: () => setShowSplitModal(true),
      color: 'text-purple-400'
    },
    {
      icon: Edit2,
      label: 'Edit Name',
      action: () => setEditingField('description'),
      color: 'text-blue-400'
    },
    {
      icon: Calendar,
      label: 'Edit Date',
      action: () => setEditingField('purchase_date'),
      color: 'text-green-400'
    },
    {
      icon: FileText,
      label: 'Add Note',
      action: () => setEditingField('note'),
      color: 'text-yellow-400'
    },
    {
      icon: localTransaction.excluded ? Eye : EyeOff,
      label: localTransaction.excluded ? 'Include' : 'Exclude',
      action: toggleExcluded,
      color: localTransaction.excluded ? 'text-green-400' : 'text-gray-400'
    },
    {
      icon: Trash2,
      label: 'Delete',
      action: handleDelete,
      color: 'text-red-400'
    }
  ];

  // Get available tags that aren't already on this transaction
  const availableTagsToAdd = (Array.isArray(availableTags) ? availableTags : []).filter(t => !localTransaction.tags?.includes(t));

  if (localTransaction.deleted) return null;

  return (
    <>
      <div className={`p-4 bg-gray-800 rounded-lg border ${
        localTransaction.excluded ? 'border-yellow-600' : 'border-gray-700'
      } hover:border-gray-600 transition relative`}>
        
        {localTransaction.excluded && (
          <div className="absolute top-2 right-2 bg-yellow-600 text-xs px-2 py-1 rounded text-black font-medium">
            EXCLUDED
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            <div className={`w-12 h-12 ${getCategoryColor(localTransaction.category)} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <span className="text-2xl">{getCategoryIcon(localTransaction.category)}</span>
            </div>
            <div className={`flex-1 min-w-0 ${localTransaction.excluded ? 'opacity-60' : ''}`}>
              {editingField === 'description' ? (
                <InlineNameEditor
                  value={localTransaction.description}
                  onSave={(val) => handleFieldSave('description', val)}
                  onCancel={() => setEditingField(null)}
                />
              ) : (
                <h3 className="text-white font-medium truncate">
                  {localTransaction.description}
                  {localTransaction.isSplit && (
                    <span className="ml-2 text-xs bg-purple-600 px-2 py-0.5 rounded">SPLIT</span>
                  )}
                </h3>
              )}

              {editingField === 'purchase_date' ? (
                <InlineDateEditor
                  value={localTransaction.purchase_date}
                  onSave={(val) => handleFieldSave('purchase_date', val)}
                  onCancel={() => setEditingField(null)}
                />
              ) : (
                <p className="text-sm text-gray-400 mt-1">{localTransaction.purchase_date}</p>
              )}

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <select
                  value={localTransaction.category || ''}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="text-xs bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white"
                >
                  <option value="">Select category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                <div className="flex flex-wrap gap-1 items-center">
                  {(localTransaction.tags || []).map(tag => (
                    <span
                      key={tag}
                      className="text-xs bg-blue-600 px-2 py-1 rounded flex items-center gap-1"
                    >
                      {tag}
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-red-300"
                        onClick={() => handleTagToggle(tag)}
                      />
                    </span>
                  ))}
                  
                  {/* Clean + button for adding tags */}
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
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setShowTagDropdown(false)}
                          />
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

              {editingField === 'note' ? (
                <InlineNoteEditor
                  value={localTransaction.note || ''}
                  onSave={(val) => handleFieldSave('note', val)}
                  onCancel={() => setEditingField(null)}
                />
              ) : localTransaction.note && (
                <p className="text-sm text-gray-500 mt-2 italic">{localTransaction.note}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-red-400">
              -${Math.abs(localTransaction.amount).toFixed(2)}
            </span>

            <div className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-2 hover:bg-gray-700 rounded-lg transition"
              >
                <MoreVertical className="w-5 h-5 text-gray-400" />
              </button>

              {showActions && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowActions(false)}
                  />
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
                Generating insight...
              </div>
            ) : (
              <div>
                <p className="text-sm text-cyan-300">{aiInsight.insight}</p>
                <p className="text-sm text-gray-300 mt-2">{aiInsight.advice}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showSplitModal && (
        <TransactionSplitModal
          transaction={localTransaction}
          categories={categories}
          onClose={() => setShowSplitModal(false)}
          onSave={handleSplitSave}
        />
      )}
    </>
  );
};

export default EnhancedTransactionRow;