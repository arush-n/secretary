import React, { useState } from 'react';
import { X, Plus, Trash2, DollarSign } from 'lucide-react';

const TransactionSplitModal = ({ transaction, onClose, onSave, categories }) => {
  const [splits, setSplits] = useState([
    { id: 1, category: transaction.category || '', amount: transaction.amount / 2, note: '' },
    { id: 2, category: '', amount: transaction.amount / 2, note: '' }
  ]);

  const totalSplit = splits.reduce((sum, split) => sum + parseFloat(split.amount || 0), 0);
  const remaining = transaction.amount - totalSplit;

  const addSplit = () => {
    setSplits([...splits, { 
      id: Date.now(), 
      category: '', 
      amount: remaining > 0 ? remaining : 0, 
      note: '' 
    }]);
  };

  const removeSplit = (id) => {
    if (splits.length > 2) {
      setSplits(splits.filter(s => s.id !== id));
    }
  };

  const updateSplit = (id, field, value) => {
    setSplits(splits.map(s => 
      s.id === id ? { ...s, [field]: field === 'amount' ? parseFloat(value) || 0 : value } : s
    ));
  };

  const handleSave = () => {
    if (Math.abs(remaining) > 0.01) {
      alert('Split amounts must equal the transaction total');
      return;
    }
    onSave(splits);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Split Transaction</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-4 bg-gray-800 rounded-lg">
          <div className="text-sm text-gray-400">Original Transaction</div>
          <div className="text-lg text-white font-semibold">{transaction.description}</div>
          <div className="text-2xl text-blue-400 font-bold mt-2">
            ${Math.abs(transaction.amount).toFixed(2)}
          </div>
        </div>

        <div className="space-y-3 mb-4">
          {splits.map((split, index) => (
            <div key={split.id} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-400">Split {index + 1}</span>
                {splits.length > 2 && (
                  <button
                    onClick={() => removeSplit(split.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category</label>
                  <select
                    value={split.category}
                    onChange={(e) => updateSplit(split.id, 'category', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Amount</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      step="0.01"
                      value={split.amount}
                      onChange={(e) => updateSplit(split.id, 'amount', e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded pl-9 pr-3 py-2 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-sm text-gray-400 mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={split.note}
                  onChange={(e) => updateSplit(split.id, 'note', e.target.value)}
                  placeholder="Add a note..."
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addSplit}
          className="w-full mb-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded border border-gray-600 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Another Split
        </button>

        <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg mb-4">
          <span className="text-gray-400">Remaining to allocate:</span>
          <span className={`text-lg font-bold ${Math.abs(remaining) < 0.01 ? 'text-green-400' : 'text-red-400'}`}>
            ${remaining.toFixed(2)}
          </span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={Math.abs(remaining) > 0.01}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded"
          >
            Save Split
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionSplitModal;