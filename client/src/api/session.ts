import type { FormRequest, PlaceRecord, ScoredPlace } from './gateway'

const INPUT_STORAGE_KEY = 'project-input'
const TOP_REGIONS_STORAGE_KEY = 'top-regions'

export const saveProjectInput = (input: FormRequest) => {
  window.sessionStorage.setItem(INPUT_STORAGE_KEY, JSON.stringify(input))
}

export const loadProjectInput = (): FormRequest | null => {
  const value = window.sessionStorage.getItem(INPUT_STORAGE_KEY)

  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as FormRequest
  } catch {
    return null
  }
}

export const saveTopRegions = (regions: ScoredPlace[]) => {
  window.sessionStorage.setItem(TOP_REGIONS_STORAGE_KEY, JSON.stringify(regions))
}

export const loadTopRegions = (): ScoredPlace[] => {
  const value = window.sessionStorage.getItem(TOP_REGIONS_STORAGE_KEY)

  if (!value) {
    return []
  }

  try {
    return JSON.parse(value) as ScoredPlace[]
  } catch {
    return []
  }
}

export interface RegionGroup {
  regionName: string
  summary: ScoredPlace
  places: PlaceRecord[]
}

export const groupTopRegions = (regions: ScoredPlace[]): RegionGroup[] => {
  const grouped = new Map<string, ScoredPlace[]>()

  regions.forEach((region) => {
    const current = grouped.get(region.region_name) ?? []
    current.push(region)
    grouped.set(region.region_name, current)
  })

  return Array.from(grouped.entries())
    .map(([regionName, places]) => {
      const sortedPlaces = [...places].sort((left, right) => right.score - left.score)

      return {
        regionName,
        summary: sortedPlaces[0],
        places: sortedPlaces[0].region_info.places,
      }
    })
    .sort((left, right) => right.summary.score - left.summary.score)
    .slice(0, 3)
}

export const findRegionGroup = (regions: ScoredPlace[], regionName: string): RegionGroup | undefined =>
  groupTopRegions(regions).find((region) => region.regionName === regionName)
