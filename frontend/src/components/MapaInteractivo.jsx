import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { getMapa } from '../services/api'

const COLORS = {
  MUY_ALTO: '#E24B4A',
  ALTO:     '#EF9F27',
  MEDIO:    '#97C459',
  BAJO:     '#1D9E75',
  SIN_DATOS:'#B4B2A9',
}

function MapaInteractivo({ onRegionClick }) {
  const [geoData, setGeoData]   = useState(null)
  const [mapaData, setMapaData] = useState({})

  useEffect(() => {
  fetch('https://raw.githubusercontent.com/juaneladio/peru-geojson/master/peru_departamental_simple.geojson')
    .then(r => r.json())
    .then(setGeoData)

  getMapa().then(res => {
    const map = {}
    res.data.forEach(d => { map[d.ubigeo] = d })
    setMapaData(map)
  }).catch(() => {})
}, [])

  const styleFeature = (feature) => {
  const codDep = feature.properties.FIRST_IDDP?.toString().padStart(2, '0')
  const data = Object.values(mapaData).find(d => d.ubigeo?.startsWith(codDep))
  return {
    fillColor:   data ? COLORS[data.nivel_riesgo] : COLORS.SIN_DATOS,
    fillOpacity: 0.75,
    color:       '#fff',
    weight:      1.5,
  }
}

const onEachFeature = (feature, layer) => {
  const codDep = feature.properties.FIRST_IDDP?.toString().padStart(2, '0')
  const data   = Object.values(mapaData).find(d => d.ubigeo?.startsWith(codDep))
  const nombre = feature.properties.NOMBDEP

  layer.bindTooltip(`
    <div style="font-family:sans-serif;padding:4px">
      <b style="font-size:13px">${nombre}</b><br/>
      <span style="font-size:12px;color:#6b7280">
        ${data ? `${data.porcentaje_anemia}% anemia — ${data.nivel_riesgo.replace('_',' ')}` : 'Sin datos'}
      </span>
    </div>
  `, { sticky: true, opacity: 1 })

  layer.on('click', () => {
    onRegionClick && onRegionClick({ nombre, ...data })
  })
  layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.9, weight: 2 }))
  layer.on('mouseout',  () => layer.setStyle({ fillOpacity: 0.75, weight: 1.5 }))
}

  return (
    <MapContainer
  center={[-9.19, -75.0152]}
  zoom={5}
  minZoom={5}
  maxZoom={10}
  maxBounds={[[-18.5, -81.5], [0.0, -68.5]]}
  maxBoundsViscosity={1.0}
  style={{ height: '100%', width: '100%' }}
  scrollWheelZoom={true}
>
  <TileLayer
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    attribution='&copy; OpenStreetMap'
  />
      {geoData && (
        <GeoJSON
          data={geoData}
          style={styleFeature}
          onEachFeature={onEachFeature}
        />
      )}
    </MapContainer>
  )
}

export default MapaInteractivo