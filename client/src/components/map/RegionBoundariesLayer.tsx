import { useEffect } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'
import regionsBoundaries from '../../data/Regions.json'

type BoundaryRing = Array<[number, number]>

type BoundarySource = Record<string, Record<string, BoundaryRing>>

type RegionBoundariesLayerProps = {
  regionNames?: string[]
  activeRegionName?: string
  color?: string
  activeColor?: string
  weight?: number
  activeWeight?: number
  fitActiveBounds?: boolean
}

const boundaryData = regionsBoundaries as unknown as BoundarySource

const toLatLngs = (ring: BoundaryRing) => ring.map(([lat, lon]) => [lat, lon] as [number, number])

export function RegionBoundariesLayer({
  regionNames,
  activeRegionName,
  color = '#1f4f8f',
  activeColor = '#dc2626',
  weight = 2,
  activeWeight = 4,
  fitActiveBounds = false,
}: RegionBoundariesLayerProps) {
  const map = useMap()

  useEffect(() => {
    const layerGroup = L.layerGroup()
    const names = regionNames && regionNames.length > 0 ? regionNames : Object.keys(boundaryData)

    const activeLayers: L.Layer[] = []

    names.forEach((regionName) => {
      const regionBoundaries = boundaryData[regionName]
      if (!regionBoundaries) {
        return
      }

      Object.values(regionBoundaries).forEach((ring) => {
        if (!ring || ring.length < 3) {
          return
        }

        const isActive = regionName === activeRegionName
        const polygon = L.polygon(toLatLngs(ring), {
          color: isActive ? activeColor : color,
          weight: isActive ? activeWeight : weight,
          fill: false,
          opacity: isActive ? 1 : 0.75,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        })

        polygon.addTo(layerGroup)
        if (isActive) {
          activeLayers.push(polygon)
        }
      })
    })

    layerGroup.addTo(map)

    if (fitActiveBounds && activeLayers.length > 0) {
      const bounds = L.featureGroup(activeLayers).getBounds()
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.08), { animate: true })
      }
    }

    return () => {
      layerGroup.remove()
    }
  }, [activeColor, activeRegionName, activeWeight, color, fitActiveBounds, map, regionNames, weight])

  return null
}
