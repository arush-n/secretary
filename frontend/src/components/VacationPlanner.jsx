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

  const resetSelections = () => {
    setPlannerStep('initial')
    setSpecificCity('')
    setSelectedDestinations([])
    setPriority('')
    setTripResults([])
  setDateFrom('')
  setDateTo('')
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
        const cheapest = data && data.price ? [{
          airline: (data.segments && data.segments[0] && data.segments[0].airline) || 'unknown',
          todayPrice: data.price,
          bestPrice: data.price,
          bestDate: `${dateFrom} - ${dateTo}`
        }] : generateFlightDeals(city)
        setExploreDeals({ flights: cheapest, hotels })
        setPlannerStep('deals')
      })
      .catch(() => {
        // fallback to mock on error
        setExploreDeals({ flights: generateFlightDeals(city), hotels })
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
              <h3 className="text-xl font-semibold lowercase mb-2">let's brainstorm together</h3>
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
            <button onClick={() => { if (priority) setPlannerStep('suggestions') }} className="w-full bg-white text-black py-3 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors">continue</button>
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
    const regionKey = pickRegionKey()
    const list = (suggestionsMap[regionKey] && suggestionsMap[regionKey][priority]) || []
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button onClick={() => setPlannerStep('priority')} className="text-gray-400 hover:text-white transition-colors text-sm lowercase mb-4">← back to priority</button>
          <h2 className="text-2xl font-semibold lowercase mb-2">suggested cities</h2>
          <p className="text-gray-400 text-sm lowercase">based on your selected region and priority</p>
        </div>

        <div className="space-y-4">
          {list.length === 0 ? <p className="text-gray-500">no suggestions available</p> : (
            list.map((c, i) => (
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
          )}

          <div className="pt-4">
            <button onClick={() => setPlannerStep('dates')} className="w-full bg-white text-black py-3 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors">continue</button>
          </div>
        </div>
      </div>
    )
  }

  if (plannerStep === 'deals') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button onClick={() => setPlannerStep('dates')} className="text-gray-400 hover:text-white transition-colors text-sm lowercase mb-4">← back to dates</button>
          <h2 className="text-2xl font-semibold lowercase mb-2">deals for {exploreCity}</h2>
          <p className="text-gray-400 text-sm lowercase">today's prices vs best prices on optimal dates</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold lowercase mb-3">top flight prices</h3>
            <div className="space-y-3">
              {exploreDeals.flights.map((f, idx) => (
                <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium lowercase">{f.airline}</span>
                    <span className="text-sm text-gray-400 lowercase">best: ${f.bestPrice} on {f.bestDate}</span>
                  </div>
                  <div className="text-sm text-gray-300 mt-2 lowercase">today: ${f.todayPrice}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold lowercase mb-3">top hotel prices</h3>
            <div className="space-y-3">
              {exploreDeals.hotels.map((h, idx) => (
                <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium lowercase">{h.hotel}</span>
                    <span className="text-sm text-gray-400 lowercase">best: ${h.bestRate}/night on {h.bestDate}</span>
                  </div>
                  <div className="text-sm text-gray-300 mt-2 lowercase">today: ${h.todayRate}/night</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3 justify-end">
          <button onClick={() => setPlannerStep('dates')} className="px-4 py-2 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700">back</button>
          <button onClick={() => handleGenerateTrip()} className="px-4 py-2 rounded-lg bg-white text-black font-semibold hover:bg-gray-200">finalize trip</button>
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
