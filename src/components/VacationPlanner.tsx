'use client';

import { useState, useEffect } from 'react';
import InteractiveMap from './InteractiveMap';

interface VacationDestination {
  id: string;
  name: string;
  type: 'city' | 'state' | 'country' | 'continent';
  coordinates?: { lat: number; lng: number };
}

interface VacationPlannerProps {
  userName?: string;
}

export default function VacationPlanner({ userName = 'traveler' }: VacationPlannerProps) {
  const [hasSpecificDestination, setHasSpecificDestination] = useState<boolean | null>(null);
  const [specificCity, setSpecificCity] = useState('');
  const [selectedDestinations, setSelectedDestinations] = useState<VacationDestination[]>([]);
  const [mapView, setMapView] = useState<'world' | 'country' | 'state'>('world');


  // Region hierarchy mapping
  const regionHierarchy = {
    // Continents to countries
    'north-america': ['usa', 'canada', 'mexico', 'cuba', 'jamaica', 'haiti', 'dominican-republic', 'guatemala', 'belize', 'honduras', 'nicaragua', 'costa-rica', 'panama'],
    'south-america': ['brazil', 'argentina', 'chile', 'peru', 'colombia', 'venezuela', 'ecuador', 'bolivia', 'paraguay', 'uruguay', 'guyana', 'suriname', 'french-guiana'],
    'europe': ['france', 'germany', 'italy', 'spain', 'uk', 'ireland', 'portugal', 'netherlands', 'belgium', 'switzerland', 'austria', 'poland', 'czech-republic', 'slovakia', 'hungary', 'romania', 'bulgaria', 'greece', 'turkey', 'russia', 'ukraine', 'belarus', 'lithuania', 'latvia', 'estonia', 'finland', 'sweden', 'norway', 'denmark'],
    'asia': ['china', 'japan', 'india', 'pakistan', 'bangladesh', 'sri-lanka', 'nepal', 'bhutan', 'myanmar', 'thailand', 'vietnam', 'laos', 'cambodia', 'malaysia', 'singapore', 'indonesia', 'philippines', 'south-korea', 'north-korea', 'mongolia', 'kazakhstan', 'uzbekistan', 'turkmenistan', 'afghanistan', 'iran', 'iraq', 'saudi-arabia', 'israel', 'jordan', 'lebanon', 'syria'],
    'africa': ['egypt', 'libya', 'tunisia', 'algeria', 'morocco', 'sudan', 'ethiopia', 'kenya', 'tanzania', 'south-africa', 'nigeria', 'ghana', 'senegal', 'mali', 'burkina-faso', 'niger', 'chad', 'central-african-republic', 'democratic-republic-of-congo', 'republic-of-congo', 'cameroon', 'gabon', 'equatorial-guinea', 'angola', 'zambia', 'zimbabwe', 'botswana', 'namibia', 'madagascar'],
    'oceania': ['australia', 'new-zealand', 'papua-new-guinea', 'fiji', 'samoa', 'tonga'],
    
    // Countries to states (USA only for now)
    'usa': ['california', 'texas', 'florida', 'new-york', 'pennsylvania', 'illinois', 'ohio', 'georgia', 'north-carolina', 'michigan', 'new-jersey', 'virginia', 'washington', 'arizona', 'massachusetts', 'tennessee', 'indiana', 'missouri', 'maryland', 'wisconsin', 'colorado', 'minnesota', 'south-carolina', 'alabama', 'louisiana', 'kentucky', 'oregon', 'oklahoma', 'connecticut', 'utah', 'iowa', 'nevada', 'arkansas', 'mississippi', 'kansas', 'new-mexico', 'nebraska', 'west-virginia', 'idaho', 'hawaii', 'new-hampshire', 'maine', 'montana', 'rhode-island', 'delaware', 'south-dakota', 'north-dakota', 'alaska', 'vermont', 'wyoming']
  };

  // Find parent regions for a given region
  const findParentRegions = (regionId: string): string[] => {
    const parents: string[] = [];
    
    // Check if it's a state, find parent country
    for (const [countryId, states] of Object.entries(regionHierarchy)) {
      if (states.includes(regionId)) {
        parents.push(countryId);
        
        // Check if country has a parent continent
        for (const [continentId, countries] of Object.entries(regionHierarchy)) {
          if (countries.includes(countryId)) {
            parents.push(continentId);
            break;
          }
        }
        break;
      }
    }
    
    return parents;
  };

  // Find child regions for a given region
  const findChildRegions = (regionId: string): string[] => {
    return regionHierarchy[regionId as keyof typeof regionHierarchy] || [];
  };

  const handleDestinationSelect = (destination: VacationDestination) => {
    setSelectedDestinations(prev => {
      const exists = prev.find(d => d.id === destination.id);
      
      if (exists) {
        // If selected, remove it
        return prev.filter(d => d.id !== destination.id);
      } else {
        // If not selected, add it and handle hierarchical logic
        let newSelections = [...prev];
        
        // Find parent regions that are currently selected
        const parentRegions = findParentRegions(destination.id);
        const selectedParents = parentRegions.filter(parentId => 
          prev.some(d => d.id === parentId)
        );
        
        // Remove parent regions if selecting a child
        if (selectedParents.length > 0) {
          selectedParents.forEach(parentId => {
            newSelections = newSelections.filter(d => d.id !== parentId);
          });
        }
        
        // Find child regions that are currently selected
        const childRegions = findChildRegions(destination.id);
        const selectedChildren = childRegions.filter(childId => 
          prev.some(d => d.id === childId)
        );
        
        // Remove child regions if selecting a parent
        if (selectedChildren.length > 0) {
          selectedChildren.forEach(childId => {
            newSelections = newSelections.filter(d => d.id !== childId);
          });
        }
        
        // Add the new destination
        return [...newSelections, destination];
      }
    });
  };

  const handleSpecificCitySubmit = () => {
    if (specificCity.trim()) {
      // Add the specific city to selected destinations
      const newDestination: VacationDestination = {
        id: `custom-${Date.now()}`,
        name: specificCity.trim(),
        type: 'city'
      };
      setSelectedDestinations([newDestination]);
    }
  };

  const resetSelections = () => {
    setHasSpecificDestination(null);
    setSpecificCity('');
    setSelectedDestinations([]);
  };

  if (hasSpecificDestination === null) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-semibold lowercase mb-4">vacation planning</h2>
          <p className="text-gray-400 text-lg lowercase">let's plan your next adventure, {userName}!</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <button
            onClick={() => setHasSpecificDestination(true)}
            className="p-8 bg-gray-900 border border-gray-700 rounded-xl hover:bg-gray-800 transition-colors group"
          >
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-blue-400 group-hover:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h3 className="text-xl font-semibold lowercase mb-2">i have a specific destination</h3>
              <p className="text-gray-400 text-sm lowercase">tell me where you want to go</p>
            </div>
          </button>

          <button
            onClick={() => setHasSpecificDestination(false)}
            className="p-8 bg-gray-900 border border-gray-700 rounded-xl hover:bg-gray-800 transition-colors group"
          >
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-green-400 group-hover:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-xl font-semibold lowercase mb-2">let's brainstorm together</h3>
              <p className="text-gray-400 text-sm lowercase">explore destinations on an interactive map</p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (hasSpecificDestination) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <button
            onClick={resetSelections}
            className="text-gray-400 hover:text-white transition-colors text-sm lowercase mb-4"
          >
            ← back to options
          </button>
          <h2 className="text-2xl font-semibold lowercase mb-2">specific destination</h2>
          <p className="text-gray-400 text-sm lowercase">where would you like to go?</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 lowercase">
              destination name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={specificCity}
                onChange={(e) => setSpecificCity(e.target.value)}
                placeholder="e.g., paris, tokyo, santorini..."
                className="flex-1 bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-gray-500 lowercase placeholder:lowercase"
                onKeyPress={(e) => e.key === 'Enter' && handleSpecificCitySubmit()}
              />
              <button
                onClick={handleSpecificCitySubmit}
                disabled={!specificCity.trim()}
                className="bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed lowercase"
              >
                add
              </button>
            </div>
          </div>

          {selectedDestinations.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold lowercase mb-3">selected destinations</h3>
              <div className="space-y-2">
                {selectedDestinations.map((dest) => (
                  <div
                    key={dest.id}
                    className="flex items-center justify-between p-3 bg-gray-900 border border-gray-700 rounded-lg"
                  >
                    <span className="text-white lowercase">{dest.name}</span>
                    <button
                      onClick={() => setSelectedDestinations(prev => prev.filter(d => d.id !== dest.id))}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <button
          onClick={resetSelections}
          className="text-gray-400 hover:text-white transition-colors text-sm lowercase mb-4"
        >
          ← back to options
        </button>
        <h2 className="text-2xl font-semibold lowercase mb-2">let's brainstorm, {userName}!</h2>
        <p className="text-gray-400 text-sm lowercase">click on destinations to add them to your list</p>
      </div>

      {/* Map Selection Mode Controls */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold lowercase mb-3">select by region type</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setMapView('world')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors lowercase ${
              mapView === 'world' 
                ? 'bg-white text-black' 
                : 'bg-gray-900 text-gray-300 hover:bg-gray-800'
            }`}
          >
            continents
          </button>
          <button
            onClick={() => setMapView('country')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors lowercase ${
              mapView === 'country' 
                ? 'bg-white text-black' 
                : 'bg-gray-900 text-gray-300 hover:bg-gray-800'
            }`}
          >
            countries
          </button>
          <button
            onClick={() => setMapView('state')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors lowercase ${
              mapView === 'state' 
                ? 'bg-white text-black' 
                : 'bg-gray-900 text-gray-300 hover:bg-gray-800'
            }`}
          >
            states/provinces
          </button>
        </div>
        <p className="text-sm text-gray-400 mt-2 lowercase">
          click anywhere on the map to select regions
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Interactive Map Area */}
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

        {/* Selected Destinations Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold lowercase mb-4">your destinations</h3>
            
            {selectedDestinations.length === 0 ? (
              <p className="text-gray-500 text-sm lowercase">no destinations selected yet</p>
            ) : (
              <div className="space-y-3">
                {selectedDestinations.map((dest) => (
                  <div
                    key={dest.id}
                    className="flex items-center justify-between p-3 bg-gray-800 border border-gray-700 rounded-lg"
                  >
                    <div>
                      <span className="text-white lowercase font-medium">{dest.name}</span>
                      <span className="text-xs text-gray-400 lowercase block">{dest.type}</span>
                    </div>
                    <button
                      onClick={() => handleDestinationSelect(dest)}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                
                <div className="pt-4 border-t border-gray-700">
                  <button className="w-full bg-white text-black py-2 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors lowercase">
                    plan trip ({selectedDestinations.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
