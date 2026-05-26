import type { ReactElement } from 'react'
import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet.heat'
import { Link } from 'react-router-dom'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import type { RankingResult, RegionId } from '../../api/api'
import { RegionBoundariesLayer } from '../map/RegionBoundariesLayer'

const MapContainerAny = MapContainer as unknown as (props: any) => ReactElement
const TileLayerAny = TileLayer as unknown as (props: any) => ReactElement
const CircleMarkerAny = CircleMarker as unknown as (props: any) => ReactElement

function HeatmapLayer({ ranking }: { ranking: RankingResult[] }) {
  const map = useMap()

  useEffect(() => {
    const maxScore = Math.max(...ranking.map((item) => item.score), 1)
    const points = ranking.map((item) => [
      item.region.location.lat,
      item.region.location.lon,
      Math.max(item.score / maxScore, 0.2),
    ]) as [number, number, number][]

    const heatLayer = (L as any).heatLayer(points, {
      radius: 35,
      blur: 25,
      maxZoom: 8,
      minOpacity: 0.35,
      gradient: {
        0.2: '#2d6fe2',
        0.5: '#0ea5e9',
        0.8: '#f59e0b',
        1.0: '#dc2626',
      },
    })

    heatLayer.addTo(map)

    return () => {
      map.removeLayer(heatLayer)
    }
  }, [map, ranking])

  return null
}

interface MapBlockProps {
  ranking: RankingResult[]
  activeRegionId: RegionId
  onSelectRegion: (regionId: RegionId) => void
}

const getRankColor = (index: number) => {
  if (index === 0) {
    return '#20a561'
  }

  if (index === 1) {
    return '#2d6fe2'
  }

  return '#d97706'
}

export function MapBlock({ ranking, activeRegionId, onSelectRegion }: MapBlockProps) {
  return (
    <section className="top-map" aria-label="Карта регионов">
      <div className="top-map__canvas">
        <div className="top-map__header">
          <h2 className="top-map__title">Карта регионов с интерактивным выбором</h2>
        </div>
        <div className="top-map__points" role="list">
          {ranking.map((item, index) => {
            const isActive = item.region.id === activeRegionId
            return (
              <button
                className={`top-map__point ${isActive ? 'top-map__point--active' : ''}`}
                key={item.region.id}
                onClick={() => onSelectRegion(item.region.id)}
                type="button"
              >
                <span className="top-map__point-rank">#{index + 1}</span>
                <span className="top-map__point-name">{item.region.title}</span>
                <span className="top-map__point-score">{item.score} баллов</span>
              </button>
            )
          })}
        </div>
        <div className="top-map__map-frame">
          <MapContainerAny
            attributionControl={false}
            center={[58.0, 99.0]}
            className="top-map__leaflet"
            scrollWheelZoom={false}
            zoom={3}
          >
            <TileLayerAny
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <RegionBoundariesLayer
              regionNames={ranking.map((item) => item.region.title)}
              activeRegionName={ranking.find((item) => item.region.id === activeRegionId)?.region.title}
              color="#315b93"
              activeColor="#dc2626"
              weight={2}
              activeWeight={4}
            />
            <HeatmapLayer ranking={ranking} />
            {ranking.map((item, index) => {
              const isActive = item.region.id === activeRegionId
              const color = getRankColor(index)

              return (
                <CircleMarkerAny
                  center={[item.region.location.lat, item.region.location.lon]}
                  eventHandlers={{
                    click: () => onSelectRegion(item.region.id),
                  }}
                  fillColor={color}
                  fillOpacity={0.82}
                  key={item.region.id}
                  pathOptions={{ color }}
                  radius={isActive ? 14 : 10}
                  weight={isActive ? 4 : 2}
                >
                  <Popup>
                    <div className="top-map__popup">
                      <p className="top-map__popup-title">{item.region.title}</p>
                      <p className="top-map__popup-text">Score: {item.score}</p>
                      <Link className="top-map__popup-link" to={`/region?region=${item.region.id}`}>
                        Открыть пакет
                      </Link>
                    </div>
                  </Popup>
                </CircleMarkerAny>
              )
            })}
          </MapContainerAny>
        </div>
      </div>
    </section>
  )
}
