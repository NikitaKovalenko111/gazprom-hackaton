import type { ScoredPlace } from '../api/gateway'

const renderModules = import.meta.glob('./renders/*', {
  eager: true,
  import: 'default',
}) as Record<string, string>

export type RegionRenderType = 'industrial' | 'logistics' | 'urban' | 'comfort'

export interface RegionRenderAsset {
  src: string
  title: string
  viewIndex: number
  type: RegionRenderType
}

const normalizeText = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+\./g, '.')
    .trim()
    .toLowerCase()

const renderTypeLabels: Record<RegionRenderType, string> = {
  industrial: 'Промышленный',
  logistics: 'Логистический',
  urban: 'Городской',
  comfort: 'Комфортный',
}

const legacyRegionTypeByName: Record<string, RegionRenderType> = {
  [normalizeText('Республика Башкортостан')]: 'industrial',
  [normalizeText('Архангельская область')]: 'logistics',
  [normalizeText('Новосибирская область')]: 'urban',
  [normalizeText('Краснодарский край')]: 'comfort',
}

const supportedRenderTypes: RegionRenderType[] = ['industrial', 'logistics', 'urban', 'comfort']

const isRenderType = (value: string): value is RegionRenderType => supportedRenderTypes.includes(value as RegionRenderType)

const resolveRenderType = (label: string): RegionRenderType | null => {
  const normalized = normalizeText(label)

  if (isRenderType(normalized)) {
    return normalized
  }

  return legacyRegionTypeByName[normalized] ?? null
}

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)

const normalizeDirect = (value: number, min: number, max: number) => {
  const clamped = Math.min(Math.max(value, min), max)
  return (clamped - min) / (max - min)
}

const normalizeInverse = (value: number, min: number, max: number) => {
  const clamped = Math.min(Math.max(value, min), max)
  return 1 - (clamped - min) / (max - min)
}

const stripExtension = (fileName: string) => fileName.replace(/\.[^.]+$/, '').trim()

const parseRenderFileName = (fileName: string) => {
  const baseName = stripExtension(fileName)
  const typeMatch = baseName.match(/^(industrial|logistics|urban|comfort)(?:\s*[-_]\s*|\s+)?(?:вид\s*)?(\d+)\s*$/i)

  if (typeMatch) {
    const type = resolveRenderType(typeMatch[1])
    const viewIndex = Number(typeMatch[2])

    if (!type || Number.isNaN(viewIndex)) {
      return null
    }

    return { label: type, type, viewIndex }
  }

  const match = baseName.match(/^(.*?)(?:\s+вид\s*(\d+))\s*$/i)

  if (!match) {
    return null
  }

  const label = match[1].trim()
  const type = resolveRenderType(label)
  const viewIndex = Number(match[2])

  if (!label || Number.isNaN(viewIndex) || !type) {
    return null
  }

  return { label, type, viewIndex }
}

export const getRegionRenderTypeLabel = (renderType: RegionRenderType) => renderTypeLabels[renderType]

export const getRegionRenderType = (region: ScoredPlace): RegionRenderType => {
  const places = region.region_info.places
  const averageRailwayDistance = average(places.map((place) => place.distance_to_the_nearest_railway_station_km))
  const averageHighwayDistance = average(places.map((place) => place.distance_to_the_nearest_federal_highway_km))
  const averageSteelDistance = average(places.map((place) => place.min_dist_km_to_metallurgical_factory))
  const averageInsulationDistance = average(places.map((place) => place.min_dist_km_to_insulation_factory))
  const averagePower = average(places.map((place) => place.infrastructure.available_power_kva))
  const averageConnectionCost = average(places.map((place) => place.infrastructure.connection_cost_per_kw))

  const industrialScore =
    normalizeDirect(averagePower, 350, 1800) * 0.32 +
    normalizeInverse(averageConnectionCost, 1800, 5000) * 0.2 +
    normalizeInverse(region.region_info.economy.industrial_electricity_tariff_rub_kwh, 4.5, 8.5) * 0.22 +
    (region.region_info.economy.benefits.length > 0 ? 0.14 : 0.02) +
    normalizeInverse(averageSteelDistance, 40, 500) * 0.12

  const logisticsScore =
    normalizeInverse(averageRailwayDistance, 2, 120) * 0.35 +
    normalizeInverse(averageHighwayDistance, 1, 90) * 0.28 +
    normalizeInverse(averageSteelDistance, 30, 450) * 0.2 +
    normalizeInverse(averageInsulationDistance, 20, 350) * 0.17

  const urbanScore =
    normalizeDirect(region.region_info.social_infrastructure.urban_environment_index, 180, 260) * 0.34 +
    normalizeDirect(region.region_info.social_infrastructure.profile_colleges_budget_places, 2000, 18000) * 0.24 +
    normalizeDirect(region.region_info.social_infrastructure.kindergarten_availability_per_100_children, 70, 100) * 0.22 +
    normalizeDirect(region.region_info.social_infrastructure.average_1room_apartment_rent_rub, 22000, 50000) * 0.2

  const comfortScore =
    normalizeDirect(region.region_info.social_infrastructure.kindergarten_availability_per_100_children, 70, 100) * 0.35 +
    normalizeInverse(region.region_info.social_infrastructure.average_1room_apartment_rent_rub, 22000, 50000) * 0.24 +
    normalizeDirect(region.region_info.cultural_code.dominant_architectural_styles.length, 1, 4) * 0.2 +
    normalizeDirect(region.region_info.cultural_code.traditional_materials_ornaments.length, 1, 4) * 0.21

  const scoredTypes: Array<[RegionRenderType, number]> = [
    ['industrial', industrialScore],
    ['logistics', logisticsScore],
    ['urban', urbanScore],
    ['comfort', comfortScore],
  ]

  return scoredTypes.sort((left, right) => right[1] - left[1])[0][0]
}

export const getRegionRenderAssets = (renderType: RegionRenderType): RegionRenderAsset[] => {
  const normalizedRenderType = normalizeText(renderType)

  return Object.entries(renderModules)
    .map(([path, src]) => {
      const fileName = path.split('/').pop() ?? path
      const parsed = parseRenderFileName(fileName)

      if (!parsed) {
        return null
      }

      if (parsed.type !== normalizedRenderType) {
        return null
      }

      return {
        src,
        title: `${getRegionRenderTypeLabel(parsed.type)}. Вид ${parsed.viewIndex}`,
        viewIndex: parsed.viewIndex,
        type: parsed.type,
      }
    })
    .filter((item): item is RegionRenderAsset => item !== null)
    .sort((left, right) => left.viewIndex - right.viewIndex)
}