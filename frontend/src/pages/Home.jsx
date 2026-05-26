import { useState } from 'react'
import Navbar from '../components/Navbar'
import MapaInteractivo from '../components/MapaInteractivo'

const COLORS = {
  MUY_ALTO: '#E24B4A',
  ALTO:     '#EF9F27',
  MEDIO:    '#97C459',
  BAJO:     '#1D9E75',
  SIN_DATOS:'#B4B2A9',
}

function Home() {
  const [region, setRegion] = useState(null)

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Mapa */}
        <div style={{ flex: 1 }}>
          <MapaInteractivo onRegionClick={setRegion} />
        </div>

        {/* Sidebar */}
        <div style={{
          width: '280px',
          borderLeft: '1px solid #e5e7eb',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
              {region ? region.nombre : 'Selecciona un departamento'}
            </h2>
            {region && (
              <span style={{
                display: 'inline-block',
                marginTop: '6px',
                padding: '2px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                background: COLORS[region.nivel_riesgo] + '22',
                color: COLORS[region.nivel_riesgo],
                fontWeight: 500,
              }}>
                {region.nivel_riesgo?.replace('_', ' ') || 'Sin datos'}
              </span>
            )}
          </div>

          {/* Stats */}
          {region ? (
            <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>% Anemia</div>
                <div style={{ fontSize: '22px', fontWeight: 600, color: COLORS[region.nivel_riesgo] }}>
                  {region.porcentaje_anemia ?? '—'}%
                </div>
              </div>
              <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>Total niños</div>
                <div style={{ fontSize: '22px', fontWeight: 600 }}>
                  {region.total_ninos?.toLocaleString() ?? '—'}
                </div>
              </div>
              <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>Casos anemia</div>
                <div style={{ fontSize: '22px', fontWeight: 600 }}>
                  {region.casos_anemia?.toLocaleString() ?? '—'}
                </div>
              </div>
              <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>Cobertura comedor</div>
                <div style={{ fontSize: '22px', fontWeight: 600 }}>
                  {region.cobertura_comedor_pct ?? '—'}%
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '24px', color: '#9ca3af', fontSize: '13px', textAlign: 'center' }}>
              Haz clic en cualquier departamento del mapa para ver sus estadísticas de anemia infantil
            </div>
          )}

          {/* Leyenda */}
          <div style={{ marginTop: 'auto', padding: '16px', borderTop: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>Nivel de riesgo</div>
            {Object.entries(COLORS).map(([nivel, color]) => (
              <div key={nivel} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: '#374151' }}>
                  {nivel.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home