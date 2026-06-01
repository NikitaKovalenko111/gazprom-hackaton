export interface FormRequest {
  productionVolume: number
  employeesCount: number
  budgetMillionRub: number
  railwayRequired: boolean
  maxDistanceToHighwayKm: number
  architecturePriority: 'authentic' | 'tech' | 'eco'
  landscaping: string[]
  housingPercent: 0 | 30 | 50 | 70
  housingType: 'hostel' | 'apartments'
  kindergartenPlacesPer100: 0 | 15 | 30 | 50
  sports: string[]
}

export interface ScoreBreakdown {
  logistics: number
  energy: number
  labor: number
  social: number
  economy: number
}

export interface WhyInsights {
  top_factor: string
  pros: string[]
  cons: string[]
  risks: string[]
}

export interface SocialInfrastructure {
  urban_environment_index: number
  kindergarten_availability_per_100_children: number
  average_1room_apartment_rent_rub: number
  profile_colleges_budget_places: number
}

export interface RegionEconomy {
  benefits: string[]
  industrial_electricity_tariff_rub_kwh: number
  average_monthly_salary_rub: number
  ecological_class_iza: string
}

export interface NetworkInfrastructure {
  available_electrical_capacity_kva: number
  technological_connection_fee_rub_kw: number
}

export interface ColorProfile {
  primary: string
  secondary: string
  accent: string
  description: string
}

export interface CulturalCode {
  dominant_architectural_styles: string[]
  traditional_materials_ornaments: string[]
  color_profile: ColorProfile
}

export interface RegionInfo {
  region_name: string
  region_lat: number
  region_lon: number
  social_infrastructure: SocialInfrastructure
  economy: RegionEconomy
  network_infrastructure: NetworkInfrastructure
  cultural_code: CulturalCode
  places: PlaceRecord[]
}

export interface PlaceEstimate {
  total_mln_rub: number
  insulation_multiplier: number
  square_m2: number
  areas_m2: {
    shop: number
    warehouse: number
    office: number
    housing: number
    social_objects: number
    infrastructure_and_roads: number
    total_site_area: number
  }
  detailed_costs_rub: {
    'Производственный цех': number
    'Склад готовой продукции': number
    'АБК (офисный блок)': number
    'Жилье (общежитие/квартиры)': number
    'Детский сад': number
    'Столовая': number
    'Медпункт': number
    'Дороги и парковки': number
    'Благоустройство территории': number
    'Спортивные объекты': number
    'Технологическое присоединение к сетям': number
  }
  costs_mln_rub: {
    production: number
    office_and_housing: number
    social_and_sports: number
    infrastructure_and_landscaping: number
    power_connection: number
  }
}

export interface PlaceInsights {
  insulation?: {
    reason?: string
    type?: string
  }
  score: number
  confidence: number
  pros: string[]
  cons: string[]
  risks: string[]
  budget_overrun?: boolean
  budget_overrun_amount?: number
}

export interface PlaceRecord {
  id: number
  square_ha: number
  square_m2: number
  place_lon: number
  place_lat: number
  place_name: string
  deal_structure: string[]
  price_rub: number
  benefit: string[]
  distance_to_the_nearest_railway_station_km: number
  distance_to_the_nearest_federal_highway_km: number
  infrastructure: {
    has_gas: boolean
    available_power_kva: number
    distance_to_substation_km: number
    connection_cost_per_kw: number
    substation_coordinates: {
      lat: number
      lon: number
    }
    gas_coordinates: {
      lat: number
      lon: number
    }
  }
  min_dist_km_to_metallurgical_factory: number
  nearest_metallurgical_factory: {
    company: string
    lat: number
    lon: number
  }
  min_dist_km_to_insulation_factory: number
  nearest_insulation_factory: {
    company: string
    lat: number
    lon: number
  }
  estimate: PlaceEstimate
  insights: PlaceInsights
}

export interface ScoredPlace {
  region_name: string
  place_name: string
  score: number
  confidence: number
  breakdown: ScoreBreakdown
  why: WhyInsights
  region_info: RegionInfo
}

export interface LLMResponse {
  ok: boolean
  model?: string
  usage_tokens?: number
  result?: string
  error?: string
  details?: string
}

const rawGatewayBase = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:3001'
const gatewayBase = rawGatewayBase.endsWith('/') ? rawGatewayBase.slice(0, -1) : rawGatewayBase

const buildUrl = (path: string) => `${gatewayBase}${path}`

const parseErrorMessage = async (response: Response) => {
  try {
    const payload = (await response.json()) as { message?: string; error?: string }
    if (payload.error && payload.message) {
      return `${payload.message}: ${payload.error}`
    }

    return payload.message ?? payload.error ?? `HTTP ${response.status}`
  } catch {
    return `HTTP ${response.status}`
  }
}

export const submitFormRequest = async (payload: FormRequest): Promise<ScoredPlace[]> => {
  const response = await fetch(buildUrl('/api/v1/form'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const message = await parseErrorMessage(response)
    throw new Error(message)
  }

  return (await response.json()) as ScoredPlace[]
}

export const requestLLMRecommendation = async (payload: ScoredPlace): Promise<LLMResponse> => {
  const response = await fetch(buildUrl('/api/v1/llm'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const message = await parseErrorMessage(response)
    throw new Error(message)
  }

  return (await response.json()) as LLMResponse
}

export const requestLLMPresentation = async (payload: ScoredPlace): Promise<LLMResponse> => {
  const response = await fetch(buildUrl('/api/v1/genpres'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const message = await parseErrorMessage(response)
    throw new Error(message)
  }

  return (await response.json()) as LLMResponse
}
