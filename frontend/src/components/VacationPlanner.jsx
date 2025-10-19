import React, { useState } from 'react'
import InteractiveMap from './InteractiveMap'

export default function VacationPlanner({ userName = 'traveler' }) {
  const [plannerStep, setPlannerStep] = useState('initial')
  const [specificCity, setSpecificCity] = useState('')
  const [selectedDestinations, setSelectedDestinations] = useState([])
  const [mapView, setMapView] = useState('world')
  const [priority, setPriority] = useState('')
  const [tripResults, setTripResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [exploreCity, setExploreCity] = useState('')
  const [exploreDeals, setExploreDeals] = useState({ flights: [], hotels: [] })
  const [flightDetails, setFlightDetails] = useState(null)
  const [selectedDeal, setSelectedDeal] = useState(null)
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  const resetSelections = () => {
    setPlannerStep('initial')
    setSpecificCity('')
    setSelectedDestinations([])
    setPriority('')
    setTripResults([])
    setDateFrom('')
    setDateTo('')
    setFlightDetails(null)
    setSelectedDeal(null)
  }

  const handleDestinationSelect = (destination) => {
    setSelectedDestinations(prev => {
      const exists = prev.find(d => d.id === destination.id)
      if (exists) return prev.filter(d => d.id !== destination.id)
      return [...prev, destination]
    })
  }

  const handleSpecificCitySubmit = () => {
    if (specificCity.trim()) {
      const newDestination = {
        id: `custom-${Date.now()}`,
        name: specificCity.trim(),
        type: 'city'
      }
      setSelectedDestinations([newDestination])
    }
  }

  const handleGenerateTrip = async () => {
    if (selectedDestinations.length === 0 || !priority) return
    setIsLoading(true)

    // Local, deterministic trip suggestion generator (no network calls)
    const mockResults = selectedDestinations.map((dest, i) => ({
      city: dest.name,
      country: dest.type === 'city' ? 'Local' : dest.type,
      description: `A ${priority} focused visit to ${dest.name}. Enjoy highlights and curated experiences.`,
      airports: [
        `${dest.name} International Airport`,
        `Nearby Regional Airport ${i + 1}`
      ]
    }))

    // small UX delay to show loading state briefly
    setTimeout(() => {
      setTripResults(mockResults)
      setPlannerStep('results')
      setIsLoading(false)
    }, 500)
  }

  // --- mock pricing helpers (deterministic, no API calls) ---
  const hashCode = (str) => {
    let h = 0
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i) | 0
    return Math.abs(h)
  }

  const seeded = (seed, min, max) => {
    const x = Math.sin(seed) * 10000
    const frac = x - Math.floor(x)
    return Math.floor(min + frac * (max - min))
  }

  const nextBestDate = (seed) => {
    const monthOffset = (seed % 3) + 1 // 1-3 months ahead
    const day = (seed % 25) + 1 // 1-26
    const now = new Date()
    const date = new Date(now.getFullYear(), now.getMonth() + monthOffset, day)
    return date.toLocaleDateString()
  }

  const generateFlightDeals = (city) => {
    const airlines = ['Delta', 'United', 'American', 'JetBlue', 'Southwest', 'Alaska']
    const baseSeed = hashCode(city)
    const items = []
    for (let i = 0; i < 3; i++) {
      const seed = baseSeed + i * 97
      const airline = airlines[(seed % airlines.length)]
      const base = seeded(seed, 220, 900)
      const best = Math.max(120, Math.floor(base * 0.78))
      const today = Math.max(best + 20, Math.floor(base * 0.95))
      items.push({
        airline,
        todayPrice: today,
        bestPrice: best,
        bestDate: nextBestDate(seed)
      })
    }
    // sort by bestPrice ascending
    return items.sort((a, b) => a.bestPrice - b.bestPrice)
  }

  const generateHotelDeals = (city) => {
    const brands = ['Grand', 'Central', 'Plaza', 'Garden', 'Harbor', 'Sky']
    const types = ['Hotel', 'Suites', 'Resort', 'Inn']
    const baseSeed = hashCode(city + 'hotel')
    const items = []
    for (let i = 0; i < 3; i++) {
      const seed = baseSeed + i * 131
      const name = `${brands[seed % brands.length]} ${city} ${types[seed % types.length]}`
      const base = seeded(seed, 90, 450)
      const best = Math.max(60, Math.floor(base * 0.75))
      const today = Math.max(best + 10, Math.floor(base * 0.95))
      items.push({
        hotel: name,
        todayRate: today,
        bestRate: best,
        bestDate: nextBestDate(seed)
      })
    }
    return items.sort((a, b) => a.bestRate - b.bestRate)
  }

  // Hardcoded suggestions by region and priority
  const suggestionsMap = {
    florida: {
      culture: [
        { city: 'St. Augustine', description: 'Historic colonial city with museums and architecture.', expense: '$' },
        { city: 'Tampa', description: 'Cuban and maritime cultural spots with museums.', expense: '$$' }
      ],
      nightlife: [
        { city: 'Miami', description: 'Vibrant nightlife, clubs, and beach parties.', expense: '$$$' },
        { city: 'Key West', description: 'Laid-back bars, live music, and sunset celebrations.', expense: '$$' }
      ],
      adventure: [
        { city: 'Everglades', description: 'Airboat tours, wildlife viewing, and rugged waterways.', expense: '$' },
        { city: 'Key Largo', description: 'Scuba diving and snorkeling the coral reefs.', expense: '$$' }
      ],
      relaxation: [
        { city: 'Naples', description: 'Quiet upscale beaches and serene sunsets.', expense: '$$$' },
        { city: 'Sanibel Island', description: 'Shelling beaches and slow-paced coastal life.', expense: '$$' }
      ],
      food: [
        { city: 'Miami', description: 'Diverse cuisine, Cuban and Latin flavors.', expense: '$$$' },
        { city: 'Tampa', description: 'Seafood and Cuban-influenced fare.', expense: '$$' }
      ]
    },
    europe: {
      culture: [
        { city: 'Paris', description: 'World-class museums, history, and architecture.', expense: '$$$' },
        { city: 'Rome', description: 'Ancient sites and rich cultural landmarks.', expense: '$$' }
      ],
      nightlife: [
        { city: 'Berlin', description: 'Legendary club scene and late-night culture.', expense: '$$' },
        { city: 'Barcelona', description: 'Beach parties, bars, and vibrant nights.', expense: '$$' }
      ],
      adventure: [
        { city: 'Interlaken', description: 'Alpine sports: hiking, paragliding, and skiing.', expense: '$$' },
        { city: 'Chamonix', description: 'Mountaineering and high-alpine activities.', expense: '$$' }
      ],
      relaxation: [
        { city: 'Santorini', description: 'Relaxing island views and slow-paced luxury.', expense: '$$$' },
        { city: 'Madeira', description: 'Mild climate, gardens, and peaceful walks.', expense: '$$' }
      ],
      food: [
        { city: 'Bologna', description: 'Renowned for rich cuisine and food markets.', expense: '$$' },
        { city: 'San Sebastián', description: 'Tapas and Michelin-starred dining.', expense: '$$$' }
      ]
    },
    asia: {
      culture: [
        { city: 'Kyoto', description: 'Temples, traditional tea houses, and classical arts.', expense: '$$' },
        { city: 'Siem Reap', description: 'Angkor temples and cultural heritage.', expense: '$' }
      ],
      nightlife: [
        { city: 'Bangkok', description: 'Rooftop bars, street nightlife, and clubs.', expense: '$$' },
        { city: 'Seoul', description: 'K-pop influenced nightlife and late-night districts.', expense: '$$' }
      ],
      adventure: [
        { city: 'Pokhara', description: 'Trekking gateway to the Himalayas and adventure sports.', expense: '$' },
        { city: 'Borneo', description: 'Jungle treks, wildlife, and river adventures.', expense: '$$' }
      ],
      relaxation: [
        { city: 'Bali', description: 'Beach resorts, yoga retreats, and calm beaches.', expense: '$$' },
        { city: 'Langkawi', description: 'Quiet beaches and easygoing island pace.', expense: '$' }
      ],
      food: [
        { city: 'Tokyo', description: 'Sushi, ramen, and high-end dining scenes.', expense: '$$$' },
        { city: 'Taipei', description: 'Night markets and street-food culture.', expense: '$' }
      ]
    }
  }

  const handleExploreCity = (city, regionKey) => {
    const id = `suggestion-${regionKey}-${priority}-${city}`
    setSelectedDestinations(prev => {
      if (prev.find(p => p.id === id)) return prev
      return [...prev, { id, name: city, type: 'city' }]
    })
    // go to dates selection; deals will be shown after dates
    setExploreCity(city)
    setPlannerStep('dates')
  }

  const determineDealsCity = () => {
    if (exploreCity) return exploreCity
    const citySel = (selectedDestinations || []).find(d => d.type === 'city')
    if (citySel) return citySel.name
    // fallback to first suggestion of current region/priority
    const regionKey = pickRegionKey()
    const list = (suggestionsMap[regionKey] && suggestionsMap[regionKey][priority]) || []
    return (list[0] && list[0].city) || 'Paris'
  }

  const handleShowDeals = () => {
    const city = determineDealsCity()
    // Fetch real cheapest flight JFK <-> city from backend; keep hotels as mock
    const hotels = generateHotelDeals(city)
    setExploreCity(city)
    fetch(`/api/get-cheapest-flight?arrival=${encodeURIComponent(city)}&outbound_date=${encodeURIComponent(dateFrom)}&return_date=${encodeURIComponent(dateTo)}`)
      .then(res => res.json())
      .then(data => {
        console.log('Flight API Response:', data) // Debug log
        
        // Handle multiple flights response
        if (data && data.flights && data.flights.length > 0) {
          setFlightDetails(data.flights) // Store all flights
          setPlannerStep('deals')
        } else {
          // Fallback to mock
          console.warn('No flights in API response, using mock data')
          setFlightDetails(null)
          setPlannerStep('deals')
        }
        
        setExploreDeals({ hotels })
      })
      .catch((err) => {
        console.error('Flight API Error:', err) // Debug log
        // fallback to mock on error
        setFlightDetails(null)
        setExploreDeals({ hotels })
        setPlannerStep('deals')
      })
  }

  const pickRegionKey = () => {
    // determine which hardcoded region to use from selectedDestinations
    if ((selectedDestinations || []).some(d => (d.id || '').toLowerCase() === 'florida' || (d.name || '').toLowerCase().includes('florida'))) return 'florida'
    if ((selectedDestinations || []).some(d => (d.id || '').toLowerCase() === 'europe' || (d.name || '').toLowerCase().includes('europe'))) return 'europe'
    if ((selectedDestinations || []).some(d => (d.id || '').toLowerCase() === 'asia' || (d.name || '').toLowerCase().includes('asia'))) return 'asia'
    // fallback: if any destination type is 'continent' and name matches
    const continent = (selectedDestinations || []).find(d => d.type === 'continent')
    if (continent && (continent.id === 'europe' || (continent.name || '').toLowerCase().includes('europe'))) return 'europe'
    if (continent && (continent.id === 'asia' || (continent.name || '').toLowerCase().includes('asia'))) return 'asia'
    // default to europe
    return 'europe'
  }

  const fetchAISuggestions = async () => {
    if (!priority || selectedDestinations.length === 0) return
    
    setLoadingSuggestions(true)
    
    try {
      // Get region names from selected destinations
      const selectedLocations = selectedDestinations.map(d => d.name || d.id)
      
      const response = await fetch('/api/get-vacation-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedLocations,
          vacationPriority: priority
        })
      })
      
      const data = await response.json()
      console.log('AI Suggestions Response:', data)
      
      if (data && data.suggestions && data.suggestions.length > 0) {
        setAiSuggestions(data.suggestions)
        setPlannerStep('suggestions')
      } else {
        console.warn('No AI suggestions returned, falling back to hardcoded')
        setAiSuggestions([])
        setPlannerStep('suggestions')
      }
    } catch (error) {
      console.error('Error fetching AI suggestions:', error)
      // Fallback to hardcoded suggestions
      setAiSuggestions([])
      setPlannerStep('suggestions')
    } finally {
      setLoadingSuggestions(false)
    }
  }

  if (plannerStep === 'initial') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-semibold lowercase mb-4">vacation planning</h2>
          <p className="text-gray-400 text-lg lowercase">let's plan your next adventure, {userName}!</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <button onClick={() => setPlannerStep('destination_specific')} className="p-8 bg-gray-900 border border-gray-700 rounded-xl hover:bg-gray-800 transition-colors group">
            <div className="text-center">
              <h3 className="text-xl font-semibold lowercase mb-2">i have a specific destination</h3>
              <p className="text-gray-400 text-sm lowercase">tell me where you want to go</p>
            </div>
          </button>
          <button onClick={() => setPlannerStep('destination_brainstorm')} className="p-8 bg-gray-900 border border-gray-700 rounded-xl hover:bg-gray-800 transition-colors group">
            <div className="text-center">
              <h3 className="text-xl font-semibold lowercase mb-2">let's brainstorm</h3>
              <p className="text-gray-400 text-sm lowercase">explore destinations on an interactive map</p>
            </div>
          </button>
        </div>
      </div>
    )
  }

  if (plannerStep === 'destination_specific') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <button onClick={resetSelections} className="text-gray-400 hover:text-white transition-colors text-sm lowercase mb-4">← back to options</button>
          <h2 className="text-2xl font-semibold lowercase mb-2">specific destination</h2>
          <p className="text-gray-400 text-sm lowercase">where would you like to go?</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 lowercase">destination name</label>
            <div className="flex gap-2">
              <input value={specificCity} onChange={e => setSpecificCity(e.target.value)} type="text" placeholder="e.g., paris, tokyo, santorini..." className="flex-1 bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-3" />
              <button onClick={handleSpecificCitySubmit} disabled={!specificCity.trim()} className="bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50">add</button>
            </div>
          </div>

          {selectedDestinations.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold lowercase mb-3">selected destinations</h3>
              <div className="space-y-2">
                {selectedDestinations.map(dest => (
                  <div key={dest.id} className="flex items-center justify-between p-3 bg-gray-900 border border-gray-700 rounded-lg">
                    <span className="text-white lowercase">{dest.name}</span>
                    <button onClick={() => setSelectedDestinations(prev => prev.filter(d => d.id !== dest.id))} className="text-gray-400 hover:text-red-400 transition-colors">remove</button>
                  </div>
                ))}
              </div>
              <div className="pt-4 mt-4 border-t border-gray-700">
                <button onClick={() => setPlannerStep('priority')} className="w-full bg-white text-black py-2 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors">next: set priority</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (plannerStep === 'destination_brainstorm') {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <button onClick={resetSelections} className="text-gray-400 hover:text-white transition-colors text-sm lowercase mb-4">← back to options</button>
          <h2 className="text-2xl font-semibold lowercase mb-2">let's brainstorm, {userName}!</h2>
          <p className="text-gray-400 text-sm lowercase">click on destinations to add them to your list</p>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold lowercase mb-3">select by region type</h3>
          <div className="flex gap-2">
            <button onClick={() => setMapView('world')} className={`px-4 py-2 rounded-lg text-sm font-medium ${mapView === 'world' ? 'bg-white text-black' : 'bg-gray-900 text-gray-300'}`}>continents</button>
            <button onClick={() => setMapView('country')} className={`px-4 py-2 rounded-lg text-sm font-medium ${mapView === 'country' ? 'bg-white text-black' : 'bg-gray-900 text-gray-300'}`}>countries</button>
            <button onClick={() => setMapView('state')} className={`px-4 py-2 rounded-lg text-sm font-medium ${mapView === 'state' ? 'bg-white text-black' : 'bg-gray-900 text-gray-300'}`}>states/provinces</button>
          </div>
          <p className="text-sm text-gray-400 mt-2 lowercase">click anywhere on the map to select regions</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="h-96 rounded-xl overflow-hidden">
              <InteractiveMap
                destinations={[]}
                selectedDestinations={selectedDestinations}
                onDestinationSelect={handleDestinationSelect}
                mapView={mapView}
                className="h-full"
              />
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold lowercase mb-4">your destinations</h3>
              {selectedDestinations.length === 0 ? (
                <p className="text-gray-500 text-sm lowercase">no destinations selected yet</p>
              ) : (
                <div className="space-y-3">
                  {selectedDestinations.map(dest => (
                    <div key={dest.id} className="flex items-center justify-between p-3 bg-gray-800 border border-gray-700 rounded-lg">
                      <div>
                        <span className="text-white lowercase font-medium">{dest.name}</span>
                        <span className="text-xs text-gray-400 lowercase block">{dest.type}</span>
                      </div>
                      <button onClick={() => handleDestinationSelect(dest)} className="text-gray-400 hover:text-red-400 transition-colors">remove</button>
                    </div>
                  ))}
                  <div className="pt-4 border-t border-gray-700">
                    <button onClick={() => setPlannerStep('priority')} className="w-full bg-white text-black py-2 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors">plan trip ({selectedDestinations.length})</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (plannerStep === 'priority') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <button onClick={() => selectedDestinations.some(d => d.type === 'city') ? setPlannerStep('destination_specific') : setPlannerStep('destination_brainstorm')} className="text-gray-400 hover:text-white transition-colors text-sm lowercase mb-4">← back to destinations</button>
          <h2 className="text-2xl font-semibold lowercase mb-2">trip priority</h2>
          <p className="text-gray-400 text-sm lowercase">what's most important for this trip?</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 lowercase">select a priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-3">
              <option value="" disabled>select...</option>
              <option value="culture">culture</option>
              <option value="nightlife">nightlife</option>
              <option value="adventure">adventure</option>
              <option value="relaxation">relaxation</option>
              <option value="food">food</option>
            </select>
          </div>

          <div className="pt-4">
            <button 
              onClick={() => { if (priority) fetchAISuggestions() }} 
              disabled={!priority || loadingSuggestions}
              className="w-full bg-white text-black py-3 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingSuggestions ? 'finding perfect destinations...' : 'continue'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (plannerStep === 'dates') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <button onClick={() => setPlannerStep('priority')} className="text-gray-400 hover:text-white transition-colors text-sm lowercase mb-4">← back to priority</button>
          <h2 className="text-2xl font-semibold lowercase mb-2">choose date range</h2>
          <p className="text-gray-400 text-sm lowercase">select your preferred date range for the trip</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 lowercase">from</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-3" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 lowercase">to</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-3" />
          </div>

          <div className="pt-4">
            <button onClick={() => { if (dateFrom && dateTo) handleShowDeals() }} disabled={!dateFrom || !dateTo} className="w-full bg-white text-black py-3 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50">see flight & hotel deals</button>
          </div>
        </div>
      </div>
    )
  }

  if (plannerStep === 'suggestions') {
    // Use AI suggestions if available, otherwise fall back to hardcoded
    const useAI = aiSuggestions.length > 0
    const regionKey = pickRegionKey()
    const hardcodedList = (suggestionsMap[regionKey] && suggestionsMap[regionKey][priority]) || []
    
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button onClick={() => setPlannerStep('priority')} className="text-gray-400 hover:text-white transition-colors text-sm lowercase mb-4">← back to priority</button>
          <h2 className="text-2xl font-semibold lowercase mb-2">
            {useAI ? 'personalized destinations' : 'suggested cities'}
          </h2>
          <p className="text-gray-400 text-sm lowercase">
            {useAI ? 'by Financial Insights and Vacation Preferences' : 'based on your selected region and priority'}
          </p>
        </div>

        <div className="space-y-4">
          {useAI ? (
            // Display AI suggestions
            aiSuggestions.map((suggestion, i) => (
              <div key={i} className="bg-gray-900 border border-gray-700 rounded-xl p-5 hover:border-blue-500 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-semibold lowercase">{suggestion.city}</h3>
                    <p className="text-sm text-blue-400 mt-1">
                      {suggestion.airport_code} - {suggestion.airport}
                    </p>
                  </div>
                </div>
                <p className="text-gray-300 mt-3 text-sm leading-relaxed">{suggestion.description}</p>
                <div className="mt-4 flex justify-end">
                  <button 
                    onClick={() => handleExploreCity(suggestion.city, regionKey)} 
                    className="bg-white text-black py-2 px-6 rounded-lg font-semibold hover:bg-gray-200 transition-colors lowercase"
                  >
                    explore {suggestion.city}
                  </button>
                </div>
              </div>
            ))
          ) : (
            // Fallback to hardcoded suggestions
            hardcodedList.length === 0 ? <p className="text-gray-500">no suggestions available</p> : (
              hardcodedList.map((c, i) => (
                <div key={i} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold lowercase">{c.city}</h3>
                    <span className="text-sm text-gray-400 lowercase">{c.expense}</span>
                  </div>
                  <p className="text-gray-400 mt-2 lowercase">{c.description}</p>
                  <div className="mt-4 flex justify-end">
                    <button onClick={() => handleExploreCity(c.city, regionKey)} className="bg-white text-black py-2 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors">explore</button>
                  </div>
                </div>
              ))
            )
          )}

          <div className="pt-4">
            <button onClick={() => setPlannerStep('dates')} className="w-full bg-white text-black py-3 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors">continue</button>
          </div>
        </div>
      </div>
    )
  }

  if (plannerStep === 'deals') {
    // Helper function to determine if a price is good (within 20% of cheapest)
    const isPriceGood = (price, cheapestPrice) => {
      return price <= cheapestPrice * 1.2
    }

    // Helper function to format date range
    const formatDateRange = (outbound, returnDate) => {
      // Parse date strings manually to avoid timezone issues
      const parseDate = (dateStr) => {
        if (!dateStr) return null;
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          return new Date(parts[0], parts[1] - 1, parts[2]);
        }
        return null;
      };
      
      const outboundDateObj = parseDate(outbound);
      const returnDateObj = parseDate(returnDate);
      
      const outboundFormatted = outboundDateObj 
        ? outboundDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'N/A';
      const returnFormatted = returnDateObj 
        ? returnDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'N/A';
      
      return `${outboundFormatted} - ${returnFormatted}`;
    }

    // Get cheapest price for comparison
    const cheapestPrice = flightDetails && flightDetails.length > 0 
      ? Math.min(...flightDetails.map(f => f.price))
      : 999999

    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <button onClick={() => setPlannerStep('dates')} className="text-gray-400 hover:text-white transition-colors text-sm lowercase mb-4">← back to dates</button>
          <h2 className="text-2xl font-semibold lowercase mb-2">deals for {exploreCity}</h2>
          <p className="text-gray-400 text-sm lowercase">top 3 flight options for your trip</p>
        </div>

        {/* Flights Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold lowercase mb-4">flights</h3>
          {flightDetails && flightDetails.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {flightDetails.map((flight, idx) => {
                const outboundSegment = flight.segments?.[0]
                const returnSegment = flight.segments?.[flight.segments.length - 1]
                const isGoodPrice = isPriceGood(flight.price, cheapestPrice)
                const isCheapest = flight.price === cheapestPrice

                return (
                  <div key={idx} className="bg-gray-900 border-2 border-gray-800 hover:border-blue-500 transition-all rounded-xl p-5 cursor-pointer relative">
                    {/* Price Badge */}
                    {isCheapest && (
                      <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full lowercase">
                        best price
                      </div>
                    )}
                    {!isCheapest && isGoodPrice && (
                      <div className="absolute top-3 right-3 bg-yellow-400 text-gray-900 text-xs font-bold px-2 py-1 rounded-full lowercase">
                        good deal
                      </div>
                    )}

                    {/* Airline Logo */}
                    {flight.airline_logo && (
                      <img src={flight.airline_logo} alt="airline" className="h-6 w-auto mb-3" />
                    )}

                    {/* Route Info */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-white">
                          {outboundSegment?.departure_airport?.id || 'JFK'}
                        </span>
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                        <span className="text-sm font-bold text-white">
                          {outboundSegment?.arrival_airport?.id || exploreCity}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 lowercase">
                        {outboundSegment?.departure_airport?.name || 'new york'} → {outboundSegment?.arrival_airport?.name || exploreCity}
                      </p>
                    </div>

                    {/* Date Range */}
                    <div className="mb-3 pb-3 border-b border-gray-800">
                      <p className="text-xs text-gray-400 lowercase">
                        {formatDateRange(
                          outboundSegment?.departure_airport?.time || dateFrom,
                          returnSegment?.departure_airport?.time || dateTo
                        )}
                      </p>
                    </div>

                    {/* Flight Type */}
                    <div className="mb-3">
                      <span className="inline-block bg-blue-900 text-blue-300 text-xs font-medium px-2 py-1 rounded lowercase">
                        {flight.type || 'round trip'}
                      </span>
                    </div>

                    {/* Price */}
                    <div className="mb-3">
                      <span className="text-2xl font-bold text-white">${flight.price}</span>
                      <span className="text-xs text-gray-400 ml-1 lowercase">total</span>
                    </div>

                    {/* View Details Button */}
                    <button 
                      onClick={() => {
                        setSelectedDeal({ type: 'flight', data: flight })
                        setPlannerStep('details')
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm lowercase"
                    >
                      see details
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-sm lowercase">no real-time flight data available</p>
          )}
        </div>

        {/* Hotels Section */}
        <div>
          <h3 className="text-lg font-semibold lowercase mb-4">hotels</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exploreDeals.hotels && exploreDeals.hotels.map((h, idx) => (
              <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium lowercase">{h.hotel}</span>
                  <span className="text-sm text-gray-400 lowercase">best: ${h.bestRate}/night</span>
                </div>
                <div className="text-sm text-gray-300 lowercase">today: ${h.todayRate}/night</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex gap-3 justify-end">
          <button onClick={() => setPlannerStep('dates')} className="px-4 py-2 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 lowercase">back</button>
          <button onClick={() => handleGenerateTrip()} className="px-4 py-2 rounded-lg bg-white text-black font-semibold hover:bg-gray-200 lowercase">finalize trip</button>
        </div>
      </div>
    )
  }

  if (plannerStep === 'details') {
    console.log('Details View - Flight Details:', flightDetails) // Debug log
    console.log('Details View - Selected Deal:', selectedDeal) // Debug log
    
    // Get the selected flight from selectedDeal
    const selectedFlight = selectedDeal?.data
    console.log('Selected Flight Segments:', selectedFlight?.segments) // Debug segments
    
    // Hardcoded hotel details
    const hotelDetails = {
      name: exploreDeals.hotels[0]?.hotel || `Grand ${exploreCity} Hotel`,
      rating: 4.5,
      reviews: 1234,
      address: `123 Main Street, ${exploreCity}`,
      amenities: [
        'Free WiFi',
        'Pool',
        'Fitness Center',
        'Restaurant',
        'Room Service',
        'Spa',
        'Parking',
        'Airport Shuttle'
      ],
      roomTypes: [
        { type: 'Standard Room', price: exploreDeals.hotels[0]?.todayRate || 120, capacity: '2 guests' },
        { type: 'Deluxe Room', price: Math.floor((exploreDeals.hotels[0]?.todayRate || 120) * 1.3), capacity: '2-3 guests' },
        { type: 'Suite', price: Math.floor((exploreDeals.hotels[0]?.todayRate || 120) * 1.8), capacity: '4 guests' }
      ],
      images: [
        'Hotel exterior view',
        'Luxury room interior',
        'Pool area',
        'Restaurant'
      ],
      checkIn: '3:00 PM',
      checkOut: '11:00 AM',
      cancellation: 'Free cancellation up to 24 hours before check-in'
    }

    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <button onClick={() => setPlannerStep('deals')} className="text-gray-400 hover:text-white transition-colors text-sm lowercase mb-4">← back to deals</button>
          <h2 className="text-2xl font-semibold lowercase mb-2">trip details for {exploreCity}</h2>
          <p className="text-gray-400 text-sm lowercase">{dateFrom} to {dateTo}</p>
        </div>

        {/* Flight Details */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold lowercase mb-4">✈️ flight details</h3>
          {selectedFlight && selectedFlight.segments && selectedFlight.segments.length > 0 ? (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-2xl font-bold text-green-400">${selectedFlight.price}</p>
                  <p className="text-sm text-gray-400 lowercase">{selectedFlight.type || 'round trip'}</p>
                </div>
                {selectedFlight.airline_logo && (
                  <img src={selectedFlight.airline_logo} alt="Airline" className="h-8" />
                )}
              </div>

              {selectedFlight.segments.map((segment, idx) => (
                <div key={idx} className="mb-4 pb-4 border-b border-gray-800 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-blue-400 lowercase">
                      {idx === 0 ? 'outbound flight' : 'return flight'}
                    </span>
                    <span className="text-sm text-gray-400">{segment.airline} {segment.flight_number}</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mt-3">
                    <div>
                      <p className="font-semibold">{segment.departure?.airport || 'N/A'}</p>
                      <p className="text-xs text-gray-400 lowercase">{segment.departure?.name || ''}</p>
                      <p className="text-xs text-gray-500 uppercase mt-2 mb-1">departure</p>
                      <p className="text-lg font-bold">
                        {(() => {
                          // For outbound flight, use API date; for return, use user's selected return date
                          if (idx === 0) {
                            // Outbound - use API date
                            const dateStr = segment.departure?.date || segment.departure?.time;
                            if (dateStr) {
                              // Parse date string directly to avoid timezone issues
                              const parts = dateStr.split('-');
                              if (parts.length === 3) {
                                const date = new Date(parts[0], parts[1] - 1, parts[2]);
                                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                              }
                            }
                            return 'N/A';
                          } else {
                            // Return flight - use user's selected return date
                            if (dateTo) {
                              const parts = dateTo.split('-');
                              if (parts.length === 3) {
                                const date = new Date(parts[0], parts[1] - 1, parts[2]);
                                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                              }
                            }
                            return 'N/A';
                          }
                        })()}
                      </p>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center">
                      <p className="text-xs text-gray-500 uppercase mb-1">duration</p>
                      <div className="w-full border-t-2 border-gray-600 relative my-2">
                        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                          </svg>
                        </div>
                      </div>
                      <p className="text-sm font-medium">{segment.duration ? `${segment.duration} min` : 'N/A'}</p>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-semibold">{segment.arrival?.airport || 'N/A'}</p>
                      <p className="text-xs text-gray-400 lowercase">{segment.arrival?.name || ''}</p>
                      <p className="text-xs text-gray-500 uppercase mt-2 mb-1">return</p>
                      <p className="text-lg font-bold">
                        {(() => {
                          // Always use user's selected return date
                          if (dateTo) {
                            const parts = dateTo.split('-');
                            if (parts.length === 3) {
                              const date = new Date(parts[0], parts[1] - 1, parts[2]);
                              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            }
                          }
                          return 'N/A';
                        })()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-3 text-sm text-gray-400">
                    <span className="bg-gray-800 px-2 py-1 rounded lowercase">{segment.travel_class || 'economy'}</span>
                  </div>
                </div>
              ))}
              
              {/* Google Flights Link */}
              <div className="mt-6 pt-4 border-t border-gray-800">
                <a
                  href={`https://www.google.com/travel/flights?q=flights%20from%20${selectedFlight.segments?.[0]?.departure_airport?.id || 'JFK'}%20to%20${selectedFlight.segments?.[0]?.arrival_airport?.id || exploreCity}%20on%20${dateFrom}%20return%20${dateTo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span className="lowercase">book on google flights</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
              <p className="text-gray-400">
                {selectedFlight ? 
                  `Flight details unavailable. Data received but missing segments.` : 
                  'Flight details are being loaded...'
                }
              </p>
              {selectedFlight && (
                <pre className="mt-4 text-xs text-gray-500 overflow-auto">
                  {JSON.stringify(selectedFlight, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Hotel Details */}
        <div>
          <h3 className="text-xl font-semibold lowercase mb-4">🏨 hotel details</h3>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
            {/* Hotel Header */}
            <div className="mb-6">
              <h4 className="text-2xl font-bold lowercase mb-2">{hotelDetails.name}</h4>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center">
                  <span className="text-yellow-400">★</span>
                  <span className="ml-1 font-semibold">{hotelDetails.rating}</span>
                  <span className="ml-1 text-gray-400">({hotelDetails.reviews} reviews)</span>
                </div>
                <span className="text-gray-400">{hotelDetails.address}</span>
              </div>
            </div>

            {/* Room Types */}
            <div className="mb-6">
              <h5 className="font-semibold text-lg lowercase mb-3">available rooms</h5>
              <div className="space-y-3">
                {hotelDetails.roomTypes.map((room, idx) => (
                  <div key={idx} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold lowercase">{room.type}</p>
                      <p className="text-sm text-gray-400 lowercase">{room.capacity}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-green-400">${room.price}</p>
                      <p className="text-xs text-gray-400 lowercase">per night</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Amenities */}
            <div className="mb-6">
              <h5 className="font-semibold text-lg lowercase mb-3">amenities</h5>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {hotelDetails.amenities.map((amenity, idx) => (
                  <div key={idx} className="bg-gray-800 px-3 py-2 rounded-lg text-sm text-center lowercase">
                    {amenity}
                  </div>
                ))}
              </div>
            </div>

            {/* Check-in/out Info */}
            <div className="grid md:grid-cols-3 gap-4 p-4 bg-gray-800 rounded-lg">
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">check-in</p>
                <p className="font-semibold">{hotelDetails.checkIn}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">check-out</p>
                <p className="font-semibold">{hotelDetails.checkOut}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">cancellation</p>
                <p className="text-sm text-gray-300 lowercase">{hotelDetails.cancellation}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3 justify-between">
          <button onClick={() => setPlannerStep('deals')} className="px-6 py-3 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 font-semibold">back to deals</button>
          <button onClick={() => handleGenerateTrip()} className="px-6 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700">book this trip</button>
        </div>
      </div>
    )
  }

  if (plannerStep === 'results') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button onClick={resetSelections} className="text-gray-400 hover:text-white transition-colors text-sm lowercase mb-4">← start over</button>
          <h2 className="text-2xl font-semibold lowercase mb-2">your personalized trip suggestions</h2>
          <p className="text-gray-400 text-sm lowercase">top suggestions based on your preference for <span className="font-semibold text-white">{priority}</span></p>
        </div>
        <div className="space-y-6">
          {tripResults.map((result, index) => (
            <div key={index} className="bg-gray-900 border border-gray-700 rounded-xl p-6">
              <h3 className="text-xl font-semibold lowercase mb-2">{result.city}, {result.country}</h3>
              <p className="text-gray-400 mb-4">{result.description}</p>
              <div>
                <h4 className="font-semibold text-sm text-gray-300 lowercase mb-2">nearby airports:</h4>
                <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                  {result.airports.map((airport, i) => (<li key={i} className="lowercase">{airport}</li>))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
}
