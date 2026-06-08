import { MapContainer, TileLayer, CircleMarker, GeoJSON, Tooltip } from "react-leaflet";
import { useEffect, useState } from "react";
import { colorFor } from "../utils/colors.js";
import Legend from "./Legend.jsx";

/**
 * Render del mapa.
 *
 *  - Si tienes el GeoJSON de distritos del Perú (recomendado para una
 *    demo seria), pásalo en `geojson` y pintamos polígonos.
 *  - Si no, hacemos fallback a CircleMarkers usando las coordenadas
 *    (lat,lng) que el pipeline ya calculó como mediana del conglomerado
 *    por distrito.
 *
 * GeoJSON sugerido (libre, INEI/GeoIDEP):
 *   https://github.com/juaneladio/peru-geojson/blob/master/peru_distrital_simple.geojson
 */
export default function MapView({ distritos, geojson, onSelect }) {
  const [hover, setHover] = useState(null);

  // Centra en Perú
  const center = [-9.19, -75.0];
  const peruBounds = [
  [-18.7, -82.2],
  [0.2, -68.4],
];

  const style = (feat) => {
    const ub = feat?.properties?.ubigeo || feat?.properties?.IDDIST;
    const d = distritos.find((x) => x.ubigeo === ub);
    return {
      weight: 0.5,
      color: "#555",
      fillColor: colorFor(d?.nivel_riesgo),
      fillOpacity: d ? 0.75 : 0.25,
    };
  };

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={6}
        minZoom={5}
        maxZoom={12}
        maxBounds={peruBounds}
        maxBoundsViscosity={1.0}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {geojson ? (
          <GeoJSON
            data={geojson}
            style={style}
            onEachFeature={(feat, layer) => {
              const ub = feat.properties.ubigeo || feat.properties.IDDIST;
              const d = distritos.find((x) => x.ubigeo === ub);
              if (d) layer.on({ click: () => onSelect(d) });
              layer.bindTooltip(d ? `${d.distrito} — ${d.porcentaje_anemia}%` : ub);
            }}
          />
        ) : (
          distritos.filter((d) => d.lat && d.lng).map((d) => (
            <CircleMarker
              key={d.ubigeo}
              center={[d.lat, d.lng]}
              radius={6}
              pathOptions={{
                color: "#333",
                weight: 0.5,
                fillColor: colorFor(d.nivel_riesgo),
                fillOpacity: 0.85,
              }}
              eventHandlers={{ click: () => onSelect(d) }}
            >
              <Tooltip>
                <div className="text-xs">
                  <div className="font-semibold">{d.departamento}</div>
                  <div>UBIGEO {d.ubigeo}</div>
                  <div>Anemia: {d.porcentaje_anemia ?? "-"}%</div>
                </div>
              </Tooltip>
            </CircleMarker>
          ))
        )}
      </MapContainer>
      <Legend />
    </div>
  );
}
