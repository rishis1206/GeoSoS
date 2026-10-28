import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-routing-machine'

const victimIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

const volunteerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

const botIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [20, 32],
  iconAnchor: [10, 32],
  popupAnchor: [1, -28],
})

export default function SOSMap({
  victimLocation,
  volunteerLocation,
  showRoute = false,
  radarBots = [],
  incidentMarkers = [],
  height = '320px'
}) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const victimMarkerRef = useRef(null)
  const volunteerMarkerRef = useRef(null)
  const botMarkersRef = useRef([])
  const incidentMarkersRef = useRef([])
  const routingRef = useRef(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const davanagereBounds = L.latLngBounds([14.32, 75.75], [14.60, 76.10])

    const map = L.map(mapRef.current, {
      center: [14.4534, 75.9239],
      zoom: 14,
      minZoom: 12,
      maxBounds: davanagereBounds,
      maxBoundsViscosity: 0.8
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map)

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
      victimMarkerRef.current = null
      volunteerMarkerRef.current = null
      routingRef.current = null
    }
  }, [])

  // Update victim marker
  useEffect(() => {
    if (!mapInstanceRef.current || !victimLocation) return

    if (victimMarkerRef.current) {
      victimMarkerRef.current.setLatLng([victimLocation.lat, victimLocation.lng])
    } else {
      victimMarkerRef.current = L.marker(
        [victimLocation.lat, victimLocation.lng],
        { icon: victimIcon }
      ).addTo(mapInstanceRef.current)
        .bindPopup('<b style="color:#cc0000">Victim Location</b>')
        .openPopup()
    }

    if (!volunteerLocation) {
      mapInstanceRef.current.setView([victimLocation.lat, victimLocation.lng], 15)
    }
  }, [victimLocation, volunteerLocation])

  // Update volunteer marker + route
  useEffect(() => {
    if (!mapInstanceRef.current || !volunteerLocation) return

    if (volunteerMarkerRef.current) {
      volunteerMarkerRef.current.setLatLng([volunteerLocation.lat, volunteerLocation.lng])
    } else {
      volunteerMarkerRef.current = L.marker(
        [volunteerLocation.lat, volunteerLocation.lng],
        { icon: volunteerIcon }
      ).addTo(mapInstanceRef.current)
        .bindPopup('<b style="color:#00cc44">You (Volunteer)</b>')
    }

    // Show route if both locations available and showRoute is true
    if (victimLocation && showRoute) {
      // Remove existing route
      if (routingRef.current) {
        mapInstanceRef.current.removeControl(routingRef.current)
        routingRef.current = null
      }

      // Add new route
      routingRef.current = L.Routing.control({
        waypoints: [
          L.latLng(volunteerLocation.lat, volunteerLocation.lng),
          L.latLng(victimLocation.lat, victimLocation.lng)
        ],
        routeWhileDragging: false,
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: true,
        showAlternatives: false,
        lineOptions: {
          styles: [{ color: '#cc0000', weight: 4, opacity: 0.8 }]
        },
        createMarker: () => null, // Don't create default markers
        collapsible: true,
      }).addTo(mapInstanceRef.current)
    } else if (victimLocation && volunteerLocation) {
      // Just fit bounds without route
      const bounds = L.latLngBounds(
        [victimLocation.lat, victimLocation.lng],
        [volunteerLocation.lat, volunteerLocation.lng]
      )
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] })
    }
  }, [volunteerLocation, victimLocation, showRoute])

  // Update radar bots markers (simulated roaming units)
  useEffect(() => {
    if (!mapInstanceRef.current) return

    // Clear previous bot markers
    botMarkersRef.current.forEach(m => m.remove())
    botMarkersRef.current = []

    if (radarBots && radarBots.length > 0) {
      const markers = radarBots.map(bot => {
        const coords = bot.location ? [bot.location.lat, bot.location.lng] : null
        if (!coords) return null

        const marker = L.marker(coords, { icon: botIcon }).addTo(mapInstanceRef.current)
          .bindPopup(`
            <div style="font-family: Oswald, sans-serif; padding: 4px;">
              <div style="color: #0088cc; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">🤖 Simulated Unit</div>
              <div style="color: #111; font-size: 13px; font-weight: 600; margin-top: 2px;">${bot.name}</div>
              <div style="color: #666; font-size: 11px; margin-top: 4px;">Rescues: ${bot.rescueCount}</div>
            </div>
          `)
        return marker
      }).filter(Boolean)

      botMarkersRef.current = markers
    }
  }, [radarBots])

  // Update multiple incidents markers (used on Home / overview maps)
  useEffect(() => {
    if (!mapInstanceRef.current) return

    incidentMarkersRef.current.forEach(m => m.remove())
    incidentMarkersRef.current = []

    // Davanagere boundary filter
    const isDavanagereCoord = (lat, lng) => lat >= 14.30 && lat <= 14.65 && lng >= 75.75 && lng <= 76.10

    if (incidentMarkers && incidentMarkers.length > 0) {
      const markers = incidentMarkers.map(inc => {
        const coords = inc.lat && inc.lng ? [inc.lat, inc.lng] : (
          inc.location?.coordinates ? [inc.location.coordinates[1], inc.location.coordinates[0]] : null
        )
        if (!coords || !isDavanagereCoord(coords[0], coords[1])) return null

        const isCompleted = inc.status === 'completed'
        const markerIcon = isCompleted ? volunteerIcon : victimIcon

        const statusColor = isCompleted ? '#00cc44' : '#cc0000'
        const marker = L.marker(coords, { icon: markerIcon }).addTo(mapInstanceRef.current)
          .bindPopup(`
            <div style="font-family: Oswald, sans-serif; padding: 4px; min-width: 140px;">
              <div style="color: ${statusColor}; font-size: 10px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
                ${isCompleted ? '✓ Resolved Rescue' : '🚨 Active Distress SOS'}
              </div>
              <div style="color: #111; font-size: 13px; font-weight: 600; margin-top: 2px; text-transform: uppercase;">
                ${inc.category ? inc.category.replace('_', ' ') : 'Emergency'}
              </div>
              <div style="color: #555; font-size: 11px; margin-top: 2px;">
                Victim: <strong>${inc.victimName || inc.victimId?.name || 'Citizen'}</strong>
              </div>
              ${inc.volunteerName || inc.assignedVolunteer?.name ? `
                <div style="color: #008800; font-size: 11px; margin-top: 2px;">
                  Volunteer: <strong>${inc.volunteerName || inc.assignedVolunteer?.name}</strong>
                </div>
              ` : ''}
            </div>
          `)
        return marker
      }).filter(Boolean)

      incidentMarkersRef.current = markers

      // Automatically fit bounds within Davanagere
      if (markers.length > 0) {
        const group = L.featureGroup(markers)
        mapInstanceRef.current.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 15 })
      } else {
        mapInstanceRef.current.setView([14.4534, 75.9239], 14)
      }
    }
  }, [incidentMarkers])

  return (
    <div>
      <div
        ref={mapRef}
        style={{ height, width: '100%', borderRadius: '4px', border: '1px solid #1c1c1c' }}
      />
      <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', background: '#cc0000', borderRadius: '50%' }} />
          <span style={{ fontSize: '11px', color: '#888', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Victim / Active Incident
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', background: '#00cc44', borderRadius: '50%' }} />
          <span style={{ fontSize: '11px', color: '#888', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Volunteer / Responded Rescue
          </span>
        </div>
        {radarBots && radarBots.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', background: '#0088cc', borderRadius: '50%' }} />
            <span style={{ fontSize: '11px', color: '#0088cc', letterSpacing: '2px', textTransform: 'uppercase' }}>
              Simulated Radar Units ({radarBots.length})
            </span>
          </div>
        )}
      </div>
    </div>
  )
}