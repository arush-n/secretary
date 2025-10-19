import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const createBluePinIcon = () => L.divIcon({
  // HTML-based DivIcon with a soft glowing blue effect
  html: `
    <div style="width:22px;height:22px;border-radius:50%;background:#0ea5e9;box-shadow:0 0 18px 8px rgba(14,165,233,0.45);border:2px solid rgba(255,255,255,0.9);transform:translate(-50%,-50%);"></div>
  `,
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11]
})

export default function InteractiveMap({ destinations = [], selectedDestinations = [], onDestinationSelect = () => {}, mapView = 'world', className = '' }) {
  const [isClient, setIsClient] = useState(false)
  const [mapKey, setMapKey] = useState(0)

  useEffect(() => { setIsClient(true) }, [])
  useEffect(() => { setMapKey(k => k + 1) }, [mapView])

  // Expose a global helper so popup buttons (string HTML) can call back into React
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.selectRegion = (id, name, type) => {
        try {
          onDestinationSelect({ id, name, type })
        } catch (e) {
          // noop
        }
      }
    }
    return () => { if (typeof window !== 'undefined') delete window.selectRegion }
  }, [onDestinationSelect])

  if (!isClient) return (
    <div className={`bg-gray-900 border border-gray-700 rounded-xl flex items-center justify-center ${className}`}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-gray-400 lowercase">loading map...</p>
      </div>
    </div>
  )

  // GeoJSON data embedded so selections work out-of-the-box
  const continentsGeoJSON = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { name: "North America", id: "north-america" }, geometry: { type: "Polygon", coordinates: [[[-180,71],[-140,72],[-100,75],[-60,70],[-60,50],[-80,30],[-100,15],[-120,10],[-140,15],[-160,25],[-180,40],[-180,71]]] } },
      { type: "Feature", properties: { name: "South America", id: "south-america" }, geometry: { type: "Polygon", coordinates: [[[-82,12],[-60,12],[-40,15],[-20,10],[-20,-5],[-40,-15],[-60,-25],[-80,-35],[-82,-20],[-82,12]]] } },
      { type: "Feature", properties: { name: "Europe", id: "europe" }, geometry: { type: "Polygon", coordinates: [[[-25,71],[40,71],[40,35],[30,30],[20,35],[10,40],[-5,35],[-10,40],[-25,50],[-25,71]]] } },
      { type: "Feature", properties: { name: "Africa", id: "africa" }, geometry: { type: "Polygon", coordinates: [[[-20,37],[55,37],[55,-35],[20,-35],[10,-30],[-10,-25],[-20,-15],[-20,37]]] } },
      { type: "Feature", properties: { name: "Asia", id: "asia" }, geometry: { type: "Polygon", coordinates: [[[40,81],[180,81],[180,1],[100,1],[80,5],[60,10],[40,15],[40,81]]] } },
      { type: "Feature", properties: { name: "Oceania", id: "oceania" }, geometry: { type: "Polygon", coordinates: [[[110,0],[180,0],[180,-50],[150,-50],[130,-45],[110,-40],[110,0]]] } }
    ]
  }

  const countriesGeoJSON = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { name: "United States", id: "usa" }, geometry: { type: "Polygon", coordinates: [[[-125,49],[-66,49],[-66,25],[-80,25],[-95,30],[-125,30],[-125,49]]] } },
      { type: "Feature", properties: { name: "Canada", id: "canada" }, geometry: { type: "Polygon", coordinates: [[[-125,70],[-66,70],[-66,49],[-125,49],[-125,70]]] } },
      { type: "Feature", properties: { name: "Mexico", id: "mexico" }, geometry: { type: "Polygon", coordinates: [[[-118,32],[-97,32],[-97,15],[-118,15],[-118,32]]] } },
      { type: "Feature", properties: { name: "Cuba", id: "cuba" }, geometry: { type: "Polygon", coordinates: [[[-85,23],[-74,23],[-74,20],[-85,20],[-85,23]]] } },
      { type: "Feature", properties: { name: "Jamaica", id: "jamaica" }, geometry: { type: "Polygon", coordinates: [[[-78,18.5],[-76,18.5],[-76,17.5],[-78,17.5],[-78,18.5]]] } },
      { type: "Feature", properties: { name: "Haiti", id: "haiti" }, geometry: { type: "Polygon", coordinates: [[[-74.5,20],[-71.5,20],[-71.5,18],[-74.5,18],[-74.5,20]]] } },
      { type: "Feature", properties: { name: "Dominican Republic", id: "dominican-republic" }, geometry: { type: "Polygon", coordinates: [[[-71.5,20],[-68,20],[-68,17.5],[-71.5,17.5],[-71.5,20]]] } },
      { type: "Feature", properties: { name: "Guatemala", id: "guatemala" }, geometry: { type: "Polygon", coordinates: [[[-92,18],[-88,18],[-88,13.5],[-92,13.5],[-92,18]]] } },
      { type: "Feature", properties: { name: "Belize", id: "belize" }, geometry: { type: "Polygon", coordinates: [[[-89,18],[-88,18],[-88,15.5],[-89,15.5],[-89,18]]] } },
      { type: "Feature", properties: { name: "Honduras", id: "honduras" }, geometry: { type: "Polygon", coordinates: [[[-89,16],[-83,16],[-83,13],[-89,13],[-89,16]]] } },
      { type: "Feature", properties: { name: "Nicaragua", id: "nicaragua" }, geometry: { type: "Polygon", coordinates: [[[-87.5,15],[-82.5,15],[-82.5,11],[-87.5,11],[-87.5,15]]] } },
      { type: "Feature", properties: { name: "Costa Rica", id: "costa-rica" }, geometry: { type: "Polygon", coordinates: [[[-85.5,11],[-82.5,11],[-82.5,8.5],[-85.5,8.5],[-85.5,11]]] } },
      { type: "Feature", properties: { name: "Panama", id: "panama" }, geometry: { type: "Polygon", coordinates: [[[-83,9.5],[-77,9.5],[-77,7],[-83,7],[-83,9.5]]] } },
      { type: "Feature", properties: { name: "Brazil", id: "brazil" }, geometry: { type: "Polygon", coordinates: [[[-70,5],[-35,5],[-35,-30],[-70,-30],[-70,5]]] } },
      { type: "Feature", properties: { name: "Argentina", id: "argentina" }, geometry: { type: "Polygon", coordinates: [[[-73.5,-22],[-53.5,-22],[-53.5,-55],[-73.5,-55],[-73.5,-22]]] } },
      { type: "Feature", properties: { name: "Chile", id: "chile" }, geometry: { type: "Polygon", coordinates: [[[-75.5,-18],[-66.5,-18],[-66.5,-56],[-75.5,-56],[-75.5,-18]]] } },
      { type: "Feature", properties: { name: "Peru", id: "peru" }, geometry: { type: "Polygon", coordinates: [[[-81,0],[-68.5,0],[-68.5,-18],[-81,-18],[-81,0]]] } },
      { type: "Feature", properties: { name: "Colombia", id: "colombia" }, geometry: { type: "Polygon", coordinates: [[[-79,12],[-66.5,12],[-66.5,-4],[-79,-4],[-79,12]]] } },
      { type: "Feature", properties: { name: "Venezuela", id: "venezuela" }, geometry: { type: "Polygon", coordinates: [[[-73.5,12],[-59.5,12],[-59.5,0.5],[-73.5,0.5],[-73.5,12]]] } },
      { type: "Feature", properties: { name: "Ecuador", id: "ecuador" }, geometry: { type: "Polygon", coordinates: [[[-81,1.5],[-75,1.5],[-75,-5],[-81,-5],[-81,1.5]]] } },
      { type: "Feature", properties: { name: "Bolivia", id: "bolivia" }, geometry: { type: "Polygon", coordinates: [[[-69.5,-10],[-57.5,-10],[-57.5,-23],[-69.5,-23],[-69.5,-10]]] } },
      { type: "Feature", properties: { name: "Paraguay", id: "paraguay" }, geometry: { type: "Polygon", coordinates: [[[-62.5,-19],[-54,-19],[-54,-27.5],[-62.5,-27.5],[-62.5,-19]]] } },
      { type: "Feature", properties: { name: "Uruguay", id: "uruguay" }, geometry: { type: "Polygon", coordinates: [[[-58.5,-30],[-53,-30],[-53,-35],[-58.5,-35],[-58.5,-30]]] } },
      { type: "Feature", properties: { name: "Guyana", id: "guyana" }, geometry: { type: "Polygon", coordinates: [[[-61.5,8.5],[-56.5,8.5],[-56.5,1],[-61.5,1],[-61.5,8.5]]] } },
      { type: "Feature", properties: { name: "Suriname", id: "suriname" }, geometry: { type: "Polygon", coordinates: [[[-58,6],[-54,6],[-54,2],[-58,2],[-58,6]]] } },
      { type: "Feature", properties: { name: "French Guiana", id: "french-guiana" }, geometry: { type: "Polygon", coordinates: [[[-54,5.5],[-51.5,5.5],[-51.5,2],[-54,2],[-54,5.5]]] } },
      { type: "Feature", properties: { name: "France", id: "france" }, geometry: { type: "Polygon", coordinates: [[[-5,51],[8,51],[8,42],[-5,42],[-5,51]]] } },
      { type: "Feature", properties: { name: "Germany", id: "germany" }, geometry: { type: "Polygon", coordinates: [[[6,55],[15,55],[15,47],[6,47],[6,55]]] } },
      { type: "Feature", properties: { name: "Italy", id: "italy" }, geometry: { type: "Polygon", coordinates: [[[7,47],[19,47],[19,36],[7,36],[7,47]]] } },
      { type: "Feature", properties: { name: "Spain", id: "spain" }, geometry: { type: "Polygon", coordinates: [[[-9,44],[3,44],[3,36],[-9,36],[-9,44]]] } },
      { type: "Feature", properties: { name: "United Kingdom", id: "united-kingdom" }, geometry: { type: "Polygon", coordinates: [[[-8,61],[2,61],[2,50],[-8,50],[-8,61]]] } },
      { type: "Feature", properties: { name: "Ireland", id: "ireland" }, geometry: { type: "Polygon", coordinates: [[[-10.5,55.5],[-6,55.5],[-6,51.5],[-10.5,51.5],[-10.5,55.5]]] } },
      { type: "Feature", properties: { name: "Portugal", id: "portugal" }, geometry: { type: "Polygon", coordinates: [[[-9.5,42],[-6,42],[-6,36.5],[-9.5,36.5],[-9.5,42]]] } },
      { type: "Feature", properties: { name: "Netherlands", id: "netherlands" }, geometry: { type: "Polygon", coordinates: [[[3,53.5],[7.5,53.5],[7.5,51],[3,51],[3,53.5]]] } },
      { type: "Feature", properties: { name: "Belgium", id: "belgium" }, geometry: { type: "Polygon", coordinates: [[[2.5,51.5],[6.5,51.5],[6.5,49.5],[2.5,49.5],[2.5,51.5]]] } },
      { type: "Feature", properties: { name: "Switzerland", id: "switzerland" }, geometry: { type: "Polygon", coordinates: [[[6,48],[10.5,48],[10.5,45.5],[6,45.5],[6,48]]] } },
      { type: "Feature", properties: { name: "Austria", id: "austria" }, geometry: { type: "Polygon", coordinates: [[[9.5,49],[17,49],[17,46.5],[9.5,46.5],[9.5,49]]] } },
      { type: "Feature", properties: { name: "Poland", id: "poland" }, geometry: { type: "Polygon", coordinates: [[[14,55],[24,55],[24,49],[14,49],[14,55]]] } },
      { type: "Feature", properties: { name: "Czech Republic", id: "czech-republic" }, geometry: { type: "Polygon", coordinates: [[[12,51],[19,51],[19,48.5],[12,48.5],[12,51]]] } },
      { type: "Feature", properties: { name: "Slovakia", id: "slovakia" }, geometry: { type: "Polygon", coordinates: [[[16.5,49.5],[22.5,49.5],[22.5,47.5],[16.5,47.5],[16.5,49.5]]] } },
      { type: "Feature", properties: { name: "Hungary", id: "hungary" }, geometry: { type: "Polygon", coordinates: [[[16,48.5],[22.5,48.5],[22.5,45.5],[16,45.5],[16,48.5]]] } },
      { type: "Feature", properties: { name: "Romania", id: "romania" }, geometry: { type: "Polygon", coordinates: [[[20,48],[30,48],[30,43.5],[20,43.5],[20,48]]] } },
      { type: "Feature", properties: { name: "Bulgaria", id: "bulgaria" }, geometry: { type: "Polygon", coordinates: [[[22.5,44.5],[28.5,44.5],[28.5,41.5],[22.5,41.5],[22.5,44.5]]] } },
      { type: "Feature", properties: { name: "Greece", id: "greece" }, geometry: { type: "Polygon", coordinates: [[[20,42],[30,42],[30,35],[20,35],[20,42]]] } },
      { type: "Feature", properties: { name: "Turkey", id: "turkey" }, geometry: { type: "Polygon", coordinates: [[[26,42],[45,42],[45,36],[26,36],[26,42]]] } },
      { type: "Feature", properties: { name: "Russia", id: "russia" }, geometry: { type: "Polygon", coordinates: [[[20,82],[180,82],[180,41],[20,41],[20,82]]] } },
      { type: "Feature", properties: { name: "Ukraine", id: "ukraine" }, geometry: { type: "Polygon", coordinates: [[[22,53],[40,53],[40,45],[22,45],[22,53]]] } },
      { type: "Feature", properties: { name: "Belarus", id: "belarus" }, geometry: { type: "Polygon", coordinates: [[[23.5,56],[32.5,56],[32.5,51.5],[23.5,51.5],[23.5,56]]] } },
      { type: "Feature", properties: { name: "Lithuania", id: "lithuania" }, geometry: { type: "Polygon", coordinates: [[[20.5,56.5],[26.5,56.5],[26.5,53.5],[20.5,53.5],[20.5,56.5]]] } },
      { type: "Feature", properties: { name: "Latvia", id: "latvia" }, geometry: { type: "Polygon", coordinates: [[[20.5,58.5],[28,58.5],[28,55.5],[20.5,55.5],[20.5,58.5]]] } },
      { type: "Feature", properties: { name: "Estonia", id: "estonia" }, geometry: { type: "Polygon", coordinates: [[[21.5,59.5],[28.5,59.5],[28.5,57.5],[21.5,57.5],[21.5,59.5]]] } },
      { type: "Feature", properties: { name: "Finland", id: "finland" }, geometry: { type: "Polygon", coordinates: [[[20,70],[31.5,70],[31.5,60],[20,60],[20,70]]] } },
      { type: "Feature", properties: { name: "Sweden", id: "sweden" }, geometry: { type: "Polygon", coordinates: [[[11,69],[24,69],[24,55],[11,55],[11,69]]] } },
      { type: "Feature", properties: { name: "Norway", id: "norway" }, geometry: { type: "Polygon", coordinates: [[[4.5,71],[31,71],[31,58],[4.5,58],[4.5,71]]] } },
      { type: "Feature", properties: { name: "Denmark", id: "denmark" }, geometry: { type: "Polygon", coordinates: [[[8,58],[15,58],[15,54.5],[8,54.5],[8,58]]] } },
      { type: "Feature", properties: { name: "China", id: "china" }, geometry: { type: "Polygon", coordinates: [[[73,54],[135,54],[135,18],[73,18],[73,54]]] } },
      { type: "Feature", properties: { name: "Japan", id: "japan" }, geometry: { type: "Polygon", coordinates: [[[129,46],[146,46],[146,31],[129,31],[129,46]]] } },
      { type: "Feature", properties: { name: "India", id: "india" }, geometry: { type: "Polygon", coordinates: [[[68,37],[97,37],[97,6],[68,6],[68,37]]] } },
      { type: "Feature", properties: { name: "Pakistan", id: "pakistan" }, geometry: { type: "Polygon", coordinates: [[[60.5,37],[77,37],[77,23.5],[60.5,23.5],[60.5,37]]] } },
      { type: "Feature", properties: { name: "Bangladesh", id: "bangladesh" }, geometry: { type: "Polygon", coordinates: [[[88,26.5],[92.5,26.5],[92.5,20.5],[88,20.5],[88,26.5]]] } },
      { type: "Feature", properties: { name: "Sri Lanka", id: "sri-lanka" }, geometry: { type: "Polygon", coordinates: [[[79.5,10],[82,10],[82,5.5],[79.5,5.5],[79.5,10]]] } },
      { type: "Feature", properties: { name: "Nepal", id: "nepal" }, geometry: { type: "Polygon", coordinates: [[[80,30.5],[88.5,30.5],[88.5,26.5],[80,26.5],[80,30.5]]] } },
      { type: "Feature", properties: { name: "Bhutan", id: "bhutan" }, geometry: { type: "Polygon", coordinates: [[[88.5,28.5],[92,28.5],[92,26.5],[88.5,26.5],[88.5,28.5]]] } },
      { type: "Feature", properties: { name: "Myanmar", id: "myanmar" }, geometry: { type: "Polygon", coordinates: [[[92,28.5],[101,28.5],[101,9.5],[92,9.5],[92,28.5]]] } },
      { type: "Feature", properties: { name: "Thailand", id: "thailand" }, geometry: { type: "Polygon", coordinates: [[[97.5,20.5],[105.5,20.5],[105.5,5.5],[97.5,5.5],[97.5,20.5]]] } },
      { type: "Feature", properties: { name: "Vietnam", id: "vietnam" }, geometry: { type: "Polygon", coordinates: [[[102,23.5],[110,23.5],[110,8.5],[102,8.5],[102,23.5]]] } },
      { type: "Feature", properties: { name: "Laos", id: "laos" }, geometry: { type: "Polygon", coordinates: [[[100,22.5],[107.5,22.5],[107.5,13.5],[100,13.5],[100,22.5]]] } },
      { type: "Feature", properties: { name: "Cambodia", id: "cambodia" }, geometry: { type: "Polygon", coordinates: [[[102.5,15],[107.5,15],[107.5,10.5],[102.5,10.5],[102.5,15]]] } },
      { type: "Feature", properties: { name: "Malaysia", id: "malaysia" }, geometry: { type: "Polygon", coordinates: [[[99.5,7.5],[119.5,7.5],[119.5,0.5],[99.5,0.5],[99.5,7.5]]] } },
      { type: "Feature", properties: { name: "Singapore", id: "singapore" }, geometry: { type: "Polygon", coordinates: [[[103.5,1.5],[104,1.5],[104,1],[103.5,1],[103.5,1.5]]] } },
      { type: "Feature", properties: { name: "Indonesia", id: "indonesia" }, geometry: { type: "Polygon", coordinates: [[[95,6],[141,6],[141,-11],[95,-11],[95,6]]] } },
      { type: "Feature", properties: { name: "Philippines", id: "philippines" }, geometry: { type: "Polygon", coordinates: [[[116,21],[127,21],[127,4.5],[116,4.5],[116,21]]] } },
      { type: "Feature", properties: { name: "South Korea", id: "south-korea" }, geometry: { type: "Polygon", coordinates: [[[124.5,39],[131,39],[131,33],[124.5,33],[124.5,39]]] } },
      { type: "Feature", properties: { name: "North Korea", id: "north-korea" }, geometry: { type: "Polygon", coordinates: [[[124,43],[131,43],[131,37.5],[124,37.5],[124,43]]] } },
      { type: "Feature", properties: { name: "Mongolia", id: "mongolia" }, geometry: { type: "Polygon", coordinates: [[[87.5,52],[120,52],[120,41.5],[87.5,41.5],[87.5,52]]] } },
      { type: "Feature", properties: { name: "Kazakhstan", id: "kazakhstan" }, geometry: { type: "Polygon", coordinates: [[[46,55.5],[87.5,55.5],[87.5,40.5],[46,40.5],[46,55.5]]] } },
      { type: "Feature", properties: { name: "Uzbekistan", id: "uzbekistan" }, geometry: { type: "Polygon", coordinates: [[[56,45.5],[73.5,45.5],[73.5,37],[56,37],[56,45.5]]] } },
      { type: "Feature", properties: { name: "Turkmenistan", id: "turkmenistan" }, geometry: { type: "Polygon", coordinates: [[[52.5,42.5],[66.5,42.5],[66.5,35.5],[52.5,35.5],[52.5,42.5]]] } },
      { type: "Feature", properties: { name: "Afghanistan", id: "afghanistan" }, geometry: { type: "Polygon", coordinates: [[[60.5,38.5],[75,38.5],[75,29.5],[60.5,29.5],[60.5,38.5]]] } },
      { type: "Feature", properties: { name: "Iran", id: "iran" }, geometry: { type: "Polygon", coordinates: [[[44,40],[63.5,40],[63.5,25],[44,25],[44,40]]] } },
      { type: "Feature", properties: { name: "Iraq", id: "iraq" }, geometry: { type: "Polygon", coordinates: [[[38.5,37.5],[48.5,37.5],[48.5,29],[38.5,29],[38.5,37.5]]] } },
      { type: "Feature", properties: { name: "Saudi Arabia", id: "saudi-arabia" }, geometry: { type: "Polygon", coordinates: [[[34.5,32.5],[55.5,32.5],[55.5,16],[34.5,16],[34.5,32.5]]] } },
      { type: "Feature", properties: { name: "Israel", id: "israel" }, geometry: { type: "Polygon", coordinates: [[[34,33.5],[35.5,33.5],[35.5,29.5],[34,29.5],[34,33.5]]] } },
      { type: "Feature", properties: { name: "Jordan", id: "jordan" }, geometry: { type: "Polygon", coordinates: [[[34.5,33.5],[39,33.5],[39,29],[34.5,29],[34.5,33.5]]] } },
      { type: "Feature", properties: { name: "Lebanon", id: "lebanon" }, geometry: { type: "Polygon", coordinates: [[[35,34.5],[36.5,34.5],[36.5,33],[35,33],[35,34.5]]] } },
      { type: "Feature", properties: { name: "Syria", id: "syria" }, geometry: { type: "Polygon", coordinates: [[[35.5,37.5],[42.5,37.5],[42.5,32.5],[35.5,32.5],[35.5,37.5]]] } },
      { type: "Feature", properties: { name: "Egypt", id: "egypt" }, geometry: { type: "Polygon", coordinates: [[[25,32],[37,32],[37,22],[25,22],[25,32]]] } },
      { type: "Feature", properties: { name: "Libya", id: "libya" }, geometry: { type: "Polygon", coordinates: [[[9.5,33.5],[25,33.5],[25,19.5],[9.5,19.5],[9.5,33.5]]] } },
      { type: "Feature", properties: { name: "Tunisia", id: "tunisia" }, geometry: { type: "Polygon", coordinates: [[[7.5,37.5],[11.5,37.5],[11.5,30.5],[7.5,30.5],[7.5,37.5]]] } },
      { type: "Feature", properties: { name: "Algeria", id: "algeria" }, geometry: { type: "Polygon", coordinates: [[[-8.5,37.5],[12,37.5],[12,18.5],[-8.5,18.5],[-8.5,37.5]]] } },
      { type: "Feature", properties: { name: "Morocco", id: "morocco" }, geometry: { type: "Polygon", coordinates: [[[-17,36],[-1,36],[-1,27],[-17,27],[-17,36]]] } },
      { type: "Feature", properties: { name: "Sudan", id: "sudan" }, geometry: { type: "Polygon", coordinates: [[[21.5,22],[38.5,22],[38.5,8.5],[21.5,8.5],[21.5,22]]] } },
      { type: "Feature", properties: { name: "Ethiopia", id: "ethiopia" }, geometry: { type: "Polygon", coordinates: [[[33,18.5],[48,18.5],[48,3.5],[33,3.5],[33,18.5]]] } },
      { type: "Feature", properties: { name: "Kenya", id: "kenya" }, geometry: { type: "Polygon", coordinates: [[[33.5,5.5],[41.5,5.5],[41.5,-4.5],[33.5,-4.5],[33.5,5.5]]] } },
      { type: "Feature", properties: { name: "Tanzania", id: "tanzania" }, geometry: { type: "Polygon", coordinates: [[[29.5,-1],[40.5,-1],[40.5,-11.5],[29.5,-11.5],[29.5,-1]]] } },
      { type: "Feature", properties: { name: "South Africa", id: "south-africa" }, geometry: { type: "Polygon", coordinates: [[[16.5,-22],[33,-22],[33,-35],[16.5,-35],[16.5,-22]]] } },
      { type: "Feature", properties: { name: "Nigeria", id: "nigeria" }, geometry: { type: "Polygon", coordinates: [[[2.5,14],[14.5,14],[14.5,4],[2.5,4],[2.5,14]]] } },
      { type: "Feature", properties: { name: "Ghana", id: "ghana" }, geometry: { type: "Polygon", coordinates: [[[-3.5,11.5],[1.5,11.5],[1.5,4.5],[-3.5,4.5],[-3.5,11.5]]] } },
      { type: "Feature", properties: { name: "Senegal", id: "senegal" }, geometry: { type: "Polygon", coordinates: [[[-17.5,16.5],[-11.5,16.5],[-11.5,12.5],[-17.5,12.5],[-17.5,16.5]]] } },
      { type: "Feature", properties: { name: "Mali", id: "mali" }, geometry: { type: "Polygon", coordinates: [[[-12,25],[4.5,25],[4.5,10.5],[-12,10.5],[-12,25]]] } },
      { type: "Feature", properties: { name: "Burkina Faso", id: "burkina-faso" }, geometry: { type: "Polygon", coordinates: [[[-5.5,15],[2.5,15],[2.5,9.5],[-5.5,9.5],[-5.5,15]]] } },
      { type: "Feature", properties: { name: "Niger", id: "niger" }, geometry: { type: "Polygon", coordinates: [[[0,23.5],[16,23.5],[16,11.5],[0,11.5],[0,23.5]]] } },
      { type: "Feature", properties: { name: "Chad", id: "chad" }, geometry: { type: "Polygon", coordinates: [[[13.5,23.5],[24,23.5],[24,7.5],[13.5,7.5],[13.5,23.5]]] } },
      { type: "Feature", properties: { name: "Central African Republic", id: "central-african-republic" }, geometry: { type: "Polygon", coordinates: [[[14.5,11],[27,11],[27,2.5],[14.5,2.5],[14.5,11]]] } },
      { type: "Feature", properties: { name: "Democratic Republic of the Congo", id: "democratic-republic-congo" }, geometry: { type: "Polygon", coordinates: [[[12,5.5],[31.5,5.5],[31.5,-13.5],[12,-13.5],[12,5.5]]] } },
      { type: "Feature", properties: { name: "Republic of the Congo", id: "republic-congo" }, geometry: { type: "Polygon", coordinates: [[[11,3.5],[18.5,3.5],[18.5,-5],[11,-5],[11,3.5]]] } },
      { type: "Feature", properties: { name: "Cameroon", id: "cameroon" }, geometry: { type: "Polygon", coordinates: [[[8.5,13],[16.5,13],[16.5,1.5],[8.5,1.5],[8.5,13]]] } },
      { type: "Feature", properties: { name: "Gabon", id: "gabon" }, geometry: { type: "Polygon", coordinates: [[[8.5,2.5],[14.5,2.5],[14.5,-4],[8.5,-4],[8.5,2.5]]] } },
      { type: "Feature", properties: { name: "Equatorial Guinea", id: "equatorial-guinea" }, geometry: { type: "Polygon", coordinates: [[[5.5,3.5],[11.5,3.5],[11.5,-1],[5.5,-1],[5.5,3.5]]] } },
      { type: "Feature", properties: { name: "Angola", id: "angola" }, geometry: { type: "Polygon", coordinates: [[[11.5,-4],[24,-4],[24,-18],[11.5,-18],[11.5,-4]]] } },
      { type: "Feature", properties: { name: "Zambia", id: "zambia" }, geometry: { type: "Polygon", coordinates: [[[21.5,-8],[33,-8],[33,-18],[21.5,-18],[21.5,-8]]] } },
      { type: "Feature", properties: { name: "Zimbabwe", id: "zimbabwe" }, geometry: { type: "Polygon", coordinates: [[[25.5,-15.5],[33,-15.5],[33,-22.5],[25.5,-22.5],[25.5,-15.5]]] } },
      { type: "Feature", properties: { name: "Botswana", id: "botswana" }, geometry: { type: "Polygon", coordinates: [[[19.5,-17.5],[29.5,-17.5],[29.5,-27],[19.5,-27],[19.5,-17.5]]] } },
      { type: "Feature", properties: { name: "Namibia", id: "namibia" }, geometry: { type: "Polygon", coordinates: [[[11.5,-16.5],[25.5,-16.5],[25.5,-29],[11.5,-29],[11.5,-16.5]]] } },
      { type: "Feature", properties: { name: "Madagascar", id: "madagascar" }, geometry: { type: "Polygon", coordinates: [[[43,-11.5],[50.5,-11.5],[50.5,-25.5],[43,-25.5],[43,-11.5]]] } },
      { type: "Feature", properties: { name: "Australia", id: "australia" }, geometry: { type: "Polygon", coordinates: [[[113,-10],[154,-10],[154,-44],[113,-44],[113,-10]]] } },
      { type: "Feature", properties: { name: "New Zealand", id: "new-zealand" }, geometry: { type: "Polygon", coordinates: [[[166,-34],[179,-34],[179,-47],[166,-47],[166,-34]]] } },
      { type: "Feature", properties: { name: "Papua New Guinea", id: "papua-new-guinea" }, geometry: { type: "Polygon", coordinates: [[[140,0],[160,0],[160,-12],[140,-12],[140,0]]] } },
      { type: "Feature", properties: { name: "Fiji", id: "fiji" }, geometry: { type: "Polygon", coordinates: [[[-180,-16],[-178,-16],[-178,-20],[-180,-20],[-180,-16]]] } },
      { type: "Feature", properties: { name: "Samoa", id: "samoa" }, geometry: { type: "Polygon", coordinates: [[[-172.5,-13.5],[-171.5,-13.5],[-171.5,-14],[-172.5,-14],[-172.5,-13.5]]] } },
      { type: "Feature", properties: { name: "Tonga", id: "tonga" }, geometry: { type: "Polygon", coordinates: [[[-175,-15.5],[-173.5,-15.5],[-173.5,-21.5],[-175,-21.5],[-175,-15.5]]] } }
    ]
  }

  const statesGeoJSON = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { name: "California", id: "california" }, geometry: { type: "Polygon", coordinates: [[[-124.5,42],[-114,42],[-114,32.5],[-124.5,32.5],[-124.5,42]]] } },
      { type: "Feature", properties: { name: "Oregon", id: "oregon" }, geometry: { type: "Polygon", coordinates: [[[-124.5,46.5],[-116.5,46.5],[-116.5,42],[-124.5,42],[-124.5,46.5]]] } },
      { type: "Feature", properties: { name: "Washington", id: "washington" }, geometry: { type: "Polygon", coordinates: [[[-124.5,49],[-116.5,49],[-116.5,46.5],[-124.5,46.5],[-124.5,49]]] } },
      { type: "Feature", properties: { name: "Nevada", id: "nevada" }, geometry: { type: "Polygon", coordinates: [[[-120,42],[-114,42],[-114,35],[-120,35],[-120,42]]] } },
      { type: "Feature", properties: { name: "Arizona", id: "arizona" }, geometry: { type: "Polygon", coordinates: [[[-114.5,37],[-109,37],[-109,31.5],[-114.5,31.5],[-114.5,37]]] } },
      { type: "Feature", properties: { name: "Utah", id: "utah" }, geometry: { type: "Polygon", coordinates: [[[-114,42],[-109,42],[-109,37],[-114,37],[-114,42]]] } },
      { type: "Feature", properties: { name: "Colorado", id: "colorado" }, geometry: { type: "Polygon", coordinates: [[[-109,41],[-102,41],[-102,37],[-109,37],[-109,41]]] } },
      { type: "Feature", properties: { name: "New Mexico", id: "new-mexico" }, geometry: { type: "Polygon", coordinates: [[[-109,37],[-103,37],[-103,31.5],[-109,31.5],[-109,37]]] } },
      { type: "Feature", properties: { name: "Wyoming", id: "wyoming" }, geometry: { type: "Polygon", coordinates: [[[-111,45],[-104,45],[-104,41],[-111,41],[-111,45]]] } },
      { type: "Feature", properties: { name: "Montana", id: "montana" }, geometry: { type: "Polygon", coordinates: [[[-116,49],[-104,49],[-104,45],[-116,45],[-116,49]]] } },
      { type: "Feature", properties: { name: "Idaho", id: "idaho" }, geometry: { type: "Polygon", coordinates: [[[-117,49],[-111,49],[-111,42],[-117,42],[-117,49]]] } },
      { type: "Feature", properties: { name: "Texas", id: "texas" }, geometry: { type: "Polygon", coordinates: [[[-106.5,36.5],[-93.5,36.5],[-93.5,25.5],[-106.5,25.5],[-106.5,36.5]]] } },
      { type: "Feature", properties: { name: "Oklahoma", id: "oklahoma" }, geometry: { type: "Polygon", coordinates: [[[-103,37],[-94.5,37],[-94.5,33.5],[-103,33.5],[-103,37]]] } },
      { type: "Feature", properties: { name: "Kansas", id: "kansas" }, geometry: { type: "Polygon", coordinates: [[[-102,40],[-94.5,40],[-94.5,37],[-102,37],[-102,40]]] } },
      { type: "Feature", properties: { name: "Nebraska", id: "nebraska" }, geometry: { type: "Polygon", coordinates: [[[-104,43],[-95.5,43],[-95.5,40],[-104,40],[-104,43]]] } },
      { type: "Feature", properties: { name: "North Dakota", id: "north-dakota" }, geometry: { type: "Polygon", coordinates: [[[-104,49],[-96.5,49],[-96.5,45.5],[-104,45.5],[-104,49]]] } },
      { type: "Feature", properties: { name: "South Dakota", id: "south-dakota" }, geometry: { type: "Polygon", coordinates: [[[-104,45.5],[-96.5,45.5],[-96.5,42.5],[-104,42.5],[-104,45.5]]] } },
      { type: "Feature", properties: { name: "Minnesota", id: "minnesota" }, geometry: { type: "Polygon", coordinates: [[[-97.5,49],[-89.5,49],[-89.5,43.5],[-97.5,43.5],[-97.5,49]]] } },
      { type: "Feature", properties: { name: "Iowa", id: "iowa" }, geometry: { type: "Polygon", coordinates: [[[-96.5,43.5],[-90,43.5],[-90,40.5],[-96.5,40.5],[-96.5,43.5]]] } },
      { type: "Feature", properties: { name: "Missouri", id: "missouri" }, geometry: { type: "Polygon", coordinates: [[[-95.5,40.5],[-89,40.5],[-89,36],[-95.5,36],[-95.5,40.5]]] } },
      { type: "Feature", properties: { name: "Arkansas", id: "arkansas" }, geometry: { type: "Polygon", coordinates: [[[-94.5,36.5],[-90,36.5],[-90,33],[-94.5,33],[-94.5,36.5]]] } },
      { type: "Feature", properties: { name: "Louisiana", id: "louisiana" }, geometry: { type: "Polygon", coordinates: [[[-94,33],[-89,33],[-89,29],[-94,29],[-94,33]]] } },
      { type: "Feature", properties: { name: "Florida", id: "florida" }, geometry: { type: "Polygon", coordinates: [[[-87.5,31],[-80,31],[-80,24.5],[-87.5,24.5],[-87.5,31]]] } },
      { type: "Feature", properties: { name: "Georgia", id: "georgia" }, geometry: { type: "Polygon", coordinates: [[[-85.5,35],[-80.5,35],[-80.5,30.5],[-85.5,30.5],[-85.5,35]]] } },
      { type: "Feature", properties: { name: "Alabama", id: "alabama" }, geometry: { type: "Polygon", coordinates: [[[-88.5,35],[-84.5,35],[-84.5,30.5],[-88.5,30.5],[-88.5,35]]] } },
      { type: "Feature", properties: { name: "Mississippi", id: "mississippi" }, geometry: { type: "Polygon", coordinates: [[[-91.5,35],[-88.5,35],[-88.5,30.5],[-91.5,30.5],[-91.5,35]]] } },
      { type: "Feature", properties: { name: "Tennessee", id: "tennessee" }, geometry: { type: "Polygon", coordinates: [[[-90,36.5],[-81.5,36.5],[-81.5,35],[-90,35],[-90,36.5]]] } },
      { type: "Feature", properties: { name: "Kentucky", id: "kentucky" }, geometry: { type: "Polygon", coordinates: [[[-89.5,39],[-81.5,39],[-81.5,36.5],[-89.5,36.5],[-89.5,39]]] } },
      { type: "Feature", properties: { name: "West Virginia", id: "west-virginia" }, geometry: { type: "Polygon", coordinates: [[[-82.5,40.5],[-77.5,40.5],[-77.5,37.5],[-82.5,37.5],[-82.5,40.5]]] } },
      { type: "Feature", properties: { name: "Virginia", id: "virginia" }, geometry: { type: "Polygon", coordinates: [[[-83.5,39.5],[-75.5,39.5],[-75.5,36.5],[-83.5,36.5],[-83.5,39.5]]] } },
      { type: "Feature", properties: { name: "North Carolina", id: "north-carolina" }, geometry: { type: "Polygon", coordinates: [[[-84.5,36.5],[-75.5,36.5],[-75.5,33.5],[-84.5,33.5],[-84.5,36.5]]] } },
      { type: "Feature", properties: { name: "South Carolina", id: "south-carolina" }, geometry: { type: "Polygon", coordinates: [[[-83.5,35],[-78.5,35],[-78.5,32],[-83.5,32],[-83.5,35]]] } },
      { type: "Feature", properties: { name: "New York", id: "new-york" }, geometry: { type: "Polygon", coordinates: [[[-79.5,45],[-73.5,45],[-73.5,40.5],[-79.5,40.5],[-79.5,45]]] } },
      { type: "Feature", properties: { name: "Pennsylvania", id: "pennsylvania" }, geometry: { type: "Polygon", coordinates: [[[-80.5,42.5],[-74.5,42.5],[-74.5,39.5],[-80.5,39.5],[-80.5,42.5]]] } },
      { type: "Feature", properties: { name: "New Jersey", id: "new-jersey" }, geometry: { type: "Polygon", coordinates: [[[-75.5,41.5],[-73.5,41.5],[-73.5,38.5],[-75.5,38.5],[-75.5,41.5]]] } },
      { type: "Feature", properties: { name: "Connecticut", id: "connecticut" }, geometry: { type: "Polygon", coordinates: [[[-73.5,42],[-71.5,42],[-71.5,41],[-73.5,41],[-73.5,42]]] } },
      { type: "Feature", properties: { name: "Rhode Island", id: "rhode-island" }, geometry: { type: "Polygon", coordinates: [[[-71.5,42],[-71,42],[-71,41.5],[-71.5,41.5],[-71.5,42]]] } },
      { type: "Feature", properties: { name: "Massachusetts", id: "massachusetts" }, geometry: { type: "Polygon", coordinates: [[[-73.5,42.5],[-69.5,42.5],[-69.5,41.5],[-73.5,41.5],[-73.5,42.5]]] } },
      { type: "Feature", properties: { name: "Vermont", id: "vermont" }, geometry: { type: "Polygon", coordinates: [[[-73.5,45],[-71.5,45],[-71.5,42.5],[-73.5,42.5],[-73.5,45]]] } },
      { type: "Feature", properties: { name: "New Hampshire", id: "new-hampshire" }, geometry: { type: "Polygon", coordinates: [[[-72.5,45],[-70.5,45],[-70.5,42.5],[-72.5,42.5],[-72.5,45]]] } },
      { type: "Feature", properties: { name: "Maine", id: "maine" }, geometry: { type: "Polygon", coordinates: [[[-71,47.5],[-66.5,47.5],[-66.5,43.5],[-71,43.5],[-71,47.5]]] } },
      { type: "Feature", properties: { name: "Delaware", id: "delaware" }, geometry: { type: "Polygon", coordinates: [[[-75.5,39.5],[-75,39.5],[-75,38.5],[-75.5,38.5],[-75.5,39.5]]] } },
      { type: "Feature", properties: { name: "Maryland", id: "maryland" }, geometry: { type: "Polygon", coordinates: [[[-79.5,39.5],[-75,39.5],[-75,37.5],[-79.5,37.5],[-79.5,39.5]]] } },
      { type: "Feature", properties: { name: "Ohio", id: "ohio" }, geometry: { type: "Polygon", coordinates: [[[-84.5,42],[-80.5,42],[-80.5,38.5],[-84.5,38.5],[-84.5,42]]] } },
      { type: "Feature", properties: { name: "Indiana", id: "indiana" }, geometry: { type: "Polygon", coordinates: [[[-88,41.5],[-84.5,41.5],[-84.5,37.5],[-88,37.5],[-88,41.5]]] } },
      { type: "Feature", properties: { name: "Illinois", id: "illinois" }, geometry: { type: "Polygon", coordinates: [[[-91.5,42.5],[-87,42.5],[-87,37],[-91.5,37],[-91.5,42.5]]] } },
      { type: "Feature", properties: { name: "Michigan", id: "michigan" }, geometry: { type: "Polygon", coordinates: [[[-90.5,48],[-82,48],[-82,41.5],[-90.5,41.5],[-90.5,48]]] } },
      { type: "Feature", properties: { name: "Wisconsin", id: "wisconsin" }, geometry: { type: "Polygon", coordinates: [[[-92.5,47],[-86.5,47],[-86.5,42.5],[-92.5,42.5],[-92.5,47]]] } },
      { type: "Feature", properties: { name: "Alaska", id: "alaska" }, geometry: { type: "Polygon", coordinates: [[[-180,72],[-140,72],[-140,51],[-180,51],[-180,72]]] } },
      { type: "Feature", properties: { name: "Hawaii", id: "hawaii" }, geometry: { type: "Polygon", coordinates: [[[-162,22.5],[-154,22.5],[-154,18.5],[-162,18.5],[-162,22.5]]] } }
    ]
  }

  const getGeoJSONData = () => {
    if (mapView === 'country') return countriesGeoJSON || { type: 'FeatureCollection', features: [] }
    if (mapView === 'state') return statesGeoJSON || { type: 'FeatureCollection', features: [] }
    return continentsGeoJSON || { type: 'FeatureCollection', features: [] }
  }

  const geoJSONData = getGeoJSONData()

  const getMapConfig = () => {
    if (mapView === 'world') return { center: [20, 0], zoom: 2 }
    if (mapView === 'country') return { center: [40, 0], zoom: 3 }
    return { center: [39, -98], zoom: 4 }
  }

  const mapConfig = getMapConfig()

  return (
    <div className={`relative ${className}`}>
      <MapContainer key={mapKey} center={mapConfig.center} zoom={mapConfig.zoom} style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <GeoJSON
          data={geoJSONData}
          // give a tiny invisible fill and a light stroke so clicks reliably register
          style={() => ({ fillColor: '#000000', weight: 1, opacity: 0.12, color: '#ffffff', fillOpacity: 0.001 })}
          onEachFeature={(feature, layer) => {
          const regionName = feature.properties?.name || 'region'
          const regionId = feature.properties?.id || String(Math.random())
          const regionType = mapView === 'world' ? 'continent' : mapView === 'country' ? 'country' : 'state'
          const destination = { id: regionId, name: regionName, type: regionType }
          // keep click for selection; don't show a tooltip or popup
          layer.on('click', () => onDestinationSelect(destination))
        }} />

        {selectedDestinations.map(dest => {
          const regionFeature = (geoJSONData.features || []).find(f => f.properties?.id === dest.id)
          if (!regionFeature) return null
          const coords = regionFeature.geometry.coordinates[0]
          if (!coords || coords.length === 0) return null
          let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
          coords.forEach(c => { const [lng, lat] = c; minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat); minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng) })
          const centerLat = (minLat + maxLat) / 2
          const centerLng = (minLng + maxLng) / 2
          const pinIcon = createBluePinIcon()
          return (
            <Marker key={dest.id} position={[centerLat, centerLng]} icon={pinIcon} eventHandlers={{ click: () => onDestinationSelect(dest) }} />
          )
        })}
      </MapContainer>

      <div className="absolute top-4 left-4 bg-black/80 text-white px-3 py-2 rounded-lg text-sm lowercase z-10">click anywhere on the map to select regions</div>
      <div className="absolute bottom-4 right-4 bg-black/80 text-white px-3 py-2 rounded-lg text-sm lowercase z-10">{selectedDestinations.length} selected</div>
    </div>
  )
}
