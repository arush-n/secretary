import React, { useRef, useEffect } from 'react';

const QuickActionBar = ({ transaction, onAction, onClose, position }) => {
  const barRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (barRef.current && !barRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const actions = [
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      label: 'Split',
      action: 'split'
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      label: 'Edit Name',
      action: 'edit-name'
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      label: 'Edit Date',
      action: 'edit-date'
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      ),
      label: 'Add Note',
      action: 'add-note'
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: transaction.excluded ? 'Include' : 'Exclude',
      action: 'toggle-exclude'
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      label: 'Delete',
      action: 'delete',
      danger: true
    }
  ];

  return (
    <div
      ref={barRef}
      className="absolute z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl flex items-center gap-1 p-2"
      style={{
        top: position.top - 60,
        left: position.left,
        transform: 'translateX(-50%)'
      }}
    >
      {actions.map((item, index) => (
        <button
          key={index}
          onClick={() => {
            onAction(item.action);
            onClose();
          }}
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition group ${
            item.danger 
              ? 'hover:bg-red-900/50' 
              : 'hover:bg-gray-800'
          }`}
          title={item.label}
        >
          <div className={item.danger ? 'text-red-400' : 'text-gray-400 group-hover:text-white'}>
            {item.icon}
          </div>
          <span className={`text-xs whitespace-nowrap ${
            item.danger 
              ? 'text-red-400' 
              : 'text-gray-500 group-hover:text-white'
          }`}>
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
};

export default QuickActionBar;