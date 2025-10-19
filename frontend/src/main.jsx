import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Disable StrictMode in development to prevent duplicate API calls
// StrictMode intentionally double-invokes effects to help find bugs
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
