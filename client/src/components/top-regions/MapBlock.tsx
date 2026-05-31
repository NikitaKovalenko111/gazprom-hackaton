import type { ReactElement } from 'react'
import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet.heat'
import { Link } from 'react-router-dom'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import type { RegionGroup } from '../../api/session'
import { RegionBoundariesLayer } from '../map/RegionBoundariesLayer'

const MapContainerAny = MapContainer as unknown as (props: any) => ReactElement
const TileLayerAny = TileLayer as unknown as (props: any) => ReactElement
const CircleMarkerAny = CircleMarker as unknown as (props: any) => ReactElement

function HeatmapLayer({ regions }: { regions: RegionGroup[] }) {
  const map = useMap()

  useEffect(() => {
    const maxScore = Math.max(...regions.map((item) => item.summary.score), 1)
    const points = regions.map((item) => [
      item.summary.region_info.region_lat,
      item.summary.region_info.region_lon,
      Math.max(item.summary.score / maxScore, 0.2),
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
  }, [map, regions])

  return null
}

interface MapBlockProps {
  regions: RegionGroup[]
  activeRegionIndex: number
  onSelectRegion: (regionIndex: number) => void
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

export function MapBlock({ regions, activeRegionIndex, onSelectRegion }: MapBlockProps) {
  return (
    <section className="top-map" aria-label="Карта регионов">
      <div className="top-map__canvas">
        <div className="top-map__header">
          <h2 className="top-map__title">Карта регионов с интерактивным выбором</h2>
        </div>
        <div className="top-map__points" role="list">
          {regions.map((item, index) => {
            const isActive = index === activeRegionIndex
            return (
              <button
                className={`top-map__point ${isActive ? 'top-map__point--active' : ''}`}
                key={item.regionName}
                onClick={() => onSelectRegion(index)}
                type="button"
              >
                <span className="top-map__point-rank">#{index + 1}</span>
                <span className="top-map__point-name">{item.regionName}</span>
                <span className="top-map__point-score">{item.summary.score.toFixed(3)} балла</span>
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
              regionNames={regions.map((item) => item.regionName)}
              activeRegionName={regions[activeRegionIndex]?.regionName}
              color="#315b93"
              activeColor="#dc2626"
              weight={2}
              activeWeight={4}
            />
            <HeatmapLayer regions={regions} />
            {regions.map((item, index) => {
              const isActive = index === activeRegionIndex
              const color = getRankColor(index)

              return (
                <CircleMarkerAny
                  center={[item.summary.region_info.region_lat, item.summary.region_info.region_lon]}
                  eventHandlers={{
                    click: () => onSelectRegion(index),
                  }}
                  fillColor={color}
                  fillOpacity={0.82}
                  key={item.regionName}
                  pathOptions={{ color }}
                  radius={isActive ? 14 : 10}
                  weight={isActive ? 4 : 2}
                >
                  <Popup className="top-map-popup">
                    <div className="top-map-popup__card">
                      <span className="top-map-popup__eyebrow">Регион</span>
                      <p className="top-map-popup__title">{item.regionName}</p>
                      <p className="top-map-popup__text">Лучшая площадка: {item.summary.place_name}</p>
                      <p className="top-map-popup__text">Score: {item.summary.score.toFixed(3)}</p>
                      <Link className="top-map-popup__link" to={`/region?region=${encodeURIComponent(item.regionName)}`}>
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
