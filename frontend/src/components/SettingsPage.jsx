import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Link,
  Tag,
  FolderOpen,
  Heart,
  CheckCircle,
  Plus,
  X,
  Edit2,
  Trash2,
  Check,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

const SettingsPage = ({
  categories: initialCategories = [],
  tags: initialTags = [],
  preferences: initialPreferences = [],
  onCategoriesUpdate,
  onTagsUpdate,
  onPreferencesUpdate
}) => {
  const [activeTab, setActiveTab] = useState('connections');
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [preferences, setPreferences] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [plaidLinked, setPlaidLinked] = useState(false);

  // Initialize state from props
  const _initialized = useRef(false);

  useEffect(() => {
    // Only initialize once to avoid re-running when parent passes new array
    // references on every render which can cause an update loop.
    if (_initialized.current) return;

    const categoriesWithIds = (initialCategories || []).map((name, idx) => ({
      id: idx,
      name: name,
      color: getRandomColor()
    }));

    const tagsWithIds = (initialTags || []).map((name, idx) => ({
      id: idx + 1000,
      name: name,
      color: getRandomColor()
    }));

    setCategories(categoriesWithIds);
    setTags(tagsWithIds);
    setPreferences(initialPreferences || []);

    _initialized.current = true;
    // Intentionally run only once on mount / first props read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Category Management
  const addCategory = () => {
    if (!newItemName.trim()) return;
    const updated = [...categories, {
      id: Date.now(),
      name: newItemName.trim(),
      color: getRandomColor()
    }];
    setCategories(updated);
    if (onCategoriesUpdate) {
      // pass metadata objects (name + color) so backend can persist color
      onCategoriesUpdate(updated.map(c => ({ name: c.name, color: c.color })));
    }
    setNewItemName('');
  };

  const updateCategory = (id) => {
    if (!editValue.trim()) return;
    const updated = categories.map(c =>
      c.id === id ? { ...c,
        name: editValue.trim()
      } : c
    );
    setCategories(updated);
    if (onCategoriesUpdate) {
      onCategoriesUpdate(updated.map(c => ({ name: c.name, color: c.color })));
    }
    setEditingId(null);
    setEditValue('');
  };

  const deleteCategory = (id) => {
    const updated = categories.filter(c => c.id !== id);
    setCategories(updated);
    if (onCategoriesUpdate) {
      onCategoriesUpdate(updated.map(c => ({ name: c.name, color: c.color })));
    }
  };

  // Tag Management
  const addTag = () => {
    if (!newItemName.trim()) return;
    const updated = [...tags, {
      id: Date.now(),
      name: newItemName.trim(),
      color: getRandomColor()
    }];
    setTags(updated);
    if (onTagsUpdate) {
      onTagsUpdate(updated.map(t => t.name));
    }
    setNewItemName('');
  };

  const updateTag = (id) => {
    if (!editValue.trim()) return;
    const updated = tags.map(t =>
      t.id === id ? { ...t,
        name: editValue.trim()
      } : t
    );
    setTags(updated);
    if (onTagsUpdate) {
      onTagsUpdate(updated.map(t => t.name));
    }
    setEditingId(null);
    setEditValue('');
  };

  const deleteTag = (id) => {
    const updated = tags.filter(t => t.id !== id);
    setTags(updated);
    if (onTagsUpdate) {
      onTagsUpdate(updated.map(t => t.name));
    }
  };

  // Preference Management
  const addPreference = () => {
    if (!newItemName.trim()) return;
    const updated = [...preferences, {
      id: Date.now(),
      name: newItemName.trim(),
      priority: preferences.length + 1
    }];
    setPreferences(updated);
    if (onPreferencesUpdate) {
      onPreferencesUpdate(updated);
    }
    setNewItemName('');
  };

  const updatePreference = (id) => {
    if (!editValue.trim()) return;
    const updated = preferences.map(p =>
      p.id === id ? { ...p,
        name: editValue.trim()
      } : p
    );
    setPreferences(updated);
    if (onPreferencesUpdate) {
      onPreferencesUpdate(updated);
    }
    setEditingId(null);
    setEditValue('');
  };

  const deletePreference = (id) => {
    const updated = preferences.filter(p => p.id !== id);
    setPreferences(updated);
    if (onPreferencesUpdate) {
      onPreferencesUpdate(updated);
    }
  };

  const movePreference = (id, direction) => {
    const index = preferences.findIndex(p => p.id === id);
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === preferences.length - 1)
    ) return;

    const updated = [...preferences];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];

    updated.forEach((p, idx) => p.priority = idx + 1);

    setPreferences(updated);
    if (onPreferencesUpdate) {
      onPreferencesUpdate(updated);
    }
  };

  const getRandomColor = () => {
    const colors = [
      'bg-blue-600', 'bg-green-600', 'bg-purple-600',
      'bg-pink-600', 'bg-yellow-600', 'bg-red-600',
      'bg-indigo-600', 'bg-teal-600', 'bg-orange-600'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const handlePlaidConnect = () => {
    setTimeout(() => {
      setPlaidLinked(true);
      alert('Successfully connected to your bank account!');
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black">
      {/* Header */}
      <div className="flex-shrink-0 p-8 pb-6 border-b border-white/10">
        <h1 className="text-3xl font-light text-white mb-2">settings</h1>
        <p className="text-gray-500 text-sm">manage your connections, categories, tags, and preferences</p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-8 pt-6">
        {/* Tab Navigation */}
        <div className="flex gap-1 mb-8 bg-white/[0.02] p-1 rounded-lg border border-white/10">
          {[
            { id: 'connections', label: 'Connections', icon: <Link className="w-4 h-4" /> },
            { id: 'categories', label: 'Categories', icon: <FolderOpen className="w-4 h-4" /> },
            { id: 'tags', label: 'Tags', icon: <Tag className="w-4 h-4" /> },
            { id: 'preferences', label: 'Preferences', icon: <Heart className="w-4 h-4" /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 rounded-md text-sm font-light transition-all flex items-center justify-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Connections Tab */}
        {activeTab === 'connections' && (
          <div className="bg-black border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-light text-white mb-4">bank connections</h2>
            <p className="text-gray-400 mb-6">
              connect your financial institutions to automatically sync transactions in real-time.
            </p>

            {!plaidLinked ? (
              <div className="bg-gray-900 rounded-lg p-8 text-center border border-gray-700">
                <Link className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">no connections yet</h3>
                <p className="text-gray-400 mb-6">
                  connect your bank account to automatically import and categorize your transactions.
                </p>
                <button
                  onClick={handlePlaidConnect}
                  className="px-6 py-3 bg-white hover:bg-gray-200 text-black rounded-lg font-medium transition"
                >
                  connect with Plaid
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gray-900 rounded-lg p-6 border border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">capital one bank</h3>
                      <p className="text-sm text-gray-400">connected • last synced 2 minutes ago</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setPlaidLinked(false)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
                  >
                    disconnect
                  </button>
                </div>

                <button
                  onClick={handlePlaidConnect}
                  className="w-full px-4 py-3 bg-gray-900 hover:bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" />
                  add another account
                </button>
              </div>
            )}
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className="bg-black border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-light text-white mb-4">manage categories</h2>
            <p className="text-gray-400 mb-6">
              categories are high-level groupings that organize your transactions (e.g., food, rent, healthcare).
            </p>

            <div className="mb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCategory()}
                  placeholder="Add new category..."
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={addCategory}
                  className="px-6 py-2 bg-white hover:bg-gray-200 text-black rounded-lg flex items-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" />
                  add
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {categories.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  no categories yet. add your first one above!
                </div>
              ) : (
                categories.map(category => (
                  <div
                    key={category.id}
                    className="flex items-center gap-3 p-4 bg-gray-900 rounded-lg border border-gray-700 hover:border-gray-600 transition"
                  >
                    <div className={`w-4 h-4 rounded-full ${category.color}`} />
                    
                    {editingId === category.id ? (
                      <>
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && updateCategory(category.id)}
                          className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-1 text-white focus:outline-none focus:border-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={() => updateCategory(category.id)}
                          className="p-2 hover:bg-gray-700 rounded text-green-400"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-2 hover:bg-gray-700 rounded text-gray-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-white font-medium">{category.name}</span>
                        <button
                          onClick={() => {
                            setEditingId(category.id);
                            setEditValue(category.name);
                          }}
                          className="p-2 hover:bg-gray-700 rounded text-blue-400"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete category "${category.name}"?`)) {
                              deleteCategory(category.id);
                            }
                          }}
                          className="p-2 hover:bg-gray-700 rounded text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tags Tab */}
        {activeTab === 'tags' && (
          <div className="bg-black border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-light text-white mb-4">manage tags</h2>
            <p className="text-gray-400 mb-6">
              tags are flexible labels for tracking spending across categories. use them for projects, trips, or themes.
            </p>

            <div className="mb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTag()}
                  placeholder="Add new tag..."
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={addTag}
                  className="px-6 py-2 bg-white hover:bg-gray-200 text-black rounded-lg flex items-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" />
                  add
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {tags.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  no tags yet. add your first one above!
                </div>
              ) : (
                tags.map(tag => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-3 p-4 bg-gray-900 rounded-lg border border-gray-700 hover:border-gray-600 transition"
                  >
                    <Tag className={`w-4 h-4 ${tag.color.replace('bg-', 'text-')}`} />
                    
                    {editingId === tag.id ? (
                      <>
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && updateTag(tag.id)}
                          className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-1 text-white focus:outline-none focus:border-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={() => updateTag(tag.id)}
                          className="p-2 hover:bg-gray-700 rounded text-green-400"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-2 hover:bg-gray-700 rounded text-gray-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-white font-medium">{tag.name}</span>
                        <button
                          onClick={() => {
                            setEditingId(tag.id);
                            setEditValue(tag.name);
                          }}
                          className="p-2 hover:bg-gray-700 rounded text-blue-400"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete tag "${tag.name}"?`)) {
                              deleteTag(tag.id);
                            }
                          }}
                          className="p-2 hover:bg-gray-700 rounded text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="bg-black border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-light text-white mb-4">financial preferences</h2>
            <p className="text-gray-400 mb-6">
              set your financial priorities in order of importance. this helps tailor insights and recommendations.
            </p>

            <div className="mb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addPreference()}
                  placeholder="Add financial priority (e.g., Save for emergency fund)..."
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={addPreference}
                  className="px-6 py-2 bg-white hover:bg-gray-200 text-black rounded-lg flex items-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" />
                  add
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {preferences.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Heart className="w-12 h-12 mx-auto mb-4 text-gray-700" />
                  <p>no preferences set. add what matters most to you!</p>
                </div>
              ) : (
                preferences.map((pref, index) => (
                  <div
                    key={pref.id}
                    className="flex items-center gap-3 p-4 bg-gray-900 rounded-lg border border-gray-700 hover:border-gray-600 transition"
                  >
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => movePreference(pref.id, 'up')}
                        disabled={index === 0}
                        className="p-1 hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed text-gray-400"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => movePreference(pref.id, 'down')}
                        disabled={index === preferences.length - 1}
                        className="p-1 hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed text-gray-400"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white">
                      {index + 1}
                    </div>
                    
                    {editingId === pref.id ? (
                      <>
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && updatePreference(pref.id)}
                          className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-1 text-white focus:outline-none focus:border-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={() => updatePreference(pref.id)}
                          className="p-2 hover:bg-gray-700 rounded text-green-400"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-2 hover:bg-gray-700 rounded text-gray-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-white font-medium">{pref.name}</span>
                        <button
                          onClick={() => {
                            setEditingId(pref.id);
                            setEditValue(pref.name);
                          }}
                          className="p-2 hover:bg-gray-700 rounded text-blue-400"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete preference "${pref.name}"?`)) {
                              deletePreference(pref.id);
                            }
                          }}
                          className="p-2 hover:bg-gray-700 rounded text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;