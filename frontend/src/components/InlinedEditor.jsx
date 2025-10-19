import React, { useState, useRef, useEffect } from 'react';

export const InlineNameEditor = ({ value, onSave, onCancel }) => {
  const [text, setText] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = () => {
    if (text.trim()) {
      onSave(text);
    } else {
      onCancel();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') onCancel();
        }}
        className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
      />
      <button
        onClick={handleSubmit}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition"
      >
        Save
      </button>
      <button
        onClick={onCancel}
        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition"
      >
        Cancel
      </button>
    </div>
  );
};

export const InlineDateEditor = ({ value, onSave, onCancel }) => {
  const [date, setDate] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(date);
          if (e.key === 'Escape') onCancel();
        }}
        className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
      />
      <button
        onClick={() => onSave(date)}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition"
      >
        Save
      </button>
      <button
        onClick={onCancel}
        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition"
      >
        Cancel
      </button>
    </div>
  );
};

export const InlineNoteEditor = ({ value, onSave, onCancel }) => {
  const [note, setNote] = useState(value);
  const textareaRef = useRef(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-2 mt-2">
      <textarea
        ref={textareaRef}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note..."
        rows={3}
        className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSave(note)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition"
        >
          Save Note
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};