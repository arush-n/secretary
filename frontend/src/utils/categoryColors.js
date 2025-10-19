// Deterministic category color and icon selection
const COLORS = [
  'bg-red-500', 'bg-purple-500', 'bg-blue-500', 'bg-yellow-500',
  'bg-pink-500', 'bg-green-500', 'bg-teal-500', 'bg-indigo-500', 'bg-gray-500'
];

const ICONS = {
  'Food & Drink': '🍔',
  'Shopping': '🛍️',
  'Transport': '🚗',
  'Bills & Utilities': '💡',
  'Entertainment': '🎬',
  'Groceries': '🛒',
  'Healthcare': '⚕️',
  'Travel': '✈️',
  'Other': '📦'
};

function hashString(str) {
  if (!str) return 0;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export function getCategoryColor(category) {
  const name = category || 'Other';
  // If category matches one of the well-known ones, return matching color by name
  const nameMap = {
    'Food & Drink': 'bg-red-500',
    'Shopping': 'bg-purple-500',
    'Transport': 'bg-blue-500',
    'Bills & Utilities': 'bg-yellow-500',
    'Entertainment': 'bg-pink-500',
    'Groceries': 'bg-green-500',
    'Healthcare': 'bg-teal-500',
    'Travel': 'bg-indigo-500',
    'Other': 'bg-gray-500'
  };
  if (nameMap[name]) return nameMap[name];
  // If backend provided metadata, prefer that
  try {
    if (typeof window !== 'undefined' && window.__CATEGORIES_META) {
      const found = window.__CATEGORIES_META.find(c => c.name === name)
      if (found && found.color) return found.color
    }
  } catch (e) {
    // ignore
    void e
  }

  // Deterministically pick from palette for custom categories
  const idx = Math.abs(hashString(name)) % COLORS.length;
  return COLORS[idx];
}

export function getCategoryIcon(category) {
  return ICONS[category] || '📦';
}

export default { getCategoryColor, getCategoryIcon };
