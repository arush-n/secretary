import React from 'react'

function Header() {
  return (
    <header className="bg-black border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-white rounded flex items-center justify-center mr-3">
                <span className="text-black text-lg font-bold">₿</span>
              </div>
              <h1 className="text-2xl font-bold text-white">secretary</h1>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">U</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
