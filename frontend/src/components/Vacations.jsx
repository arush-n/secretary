import React from 'react'
import VacationPlanner from './VacationPlanner'

function Vacations({ setActiveTab }) {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-light text-white">Vacations</h1>
        <p className="text-gray-500 mt-1 text-sm">Plan and budget for your dream getaways</p>
      </div>
      <VacationPlanner userName="friend" setActiveTab={setActiveTab} />
    </div>
  )
}

export default Vacations