import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Polyfill `process` in the browser for libraries that reference process.env
// Some npm packages still use `process.env` which is not defined in the browser
// Adding a minimal shim prevents runtime ReferenceError: process is not defined
if (typeof window !== 'undefined' && typeof window.process === 'undefined') {
  // keep it minimal and non-writable
  Object.defineProperty(window, 'process', {
    value: { env: {} },
    writable: false,
    configurable: false,
    enumerable: true,
  })
}

// Disable StrictMode in development to prevent duplicate API calls
// StrictMode intentionally double-invokes effects to help find bugs
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)