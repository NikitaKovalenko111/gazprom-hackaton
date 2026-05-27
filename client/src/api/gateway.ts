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
  has_tax_incentives_tor_oez: boolean
  tax_incentives_description: string
  has_reduced_insurance_contributions: boolean
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
  areas_m2: {
    housing: number
    infrastructure: number
    office: number
    shop: number
    social: number
    warehouse: number
  }
  costs_mln_rub: {
    infrastructure_and_landscaping: number
    office_and_housing: number
    power_connection: number
    production: number
    social_and_sports: number
  }
  total_mln_rub: number
}

export interface PlaceInsights {
  confidence: number
  cons: string[]
  insulation?: {
    reason?: string
    type?: string
  }
  budget_overrun?: boolean
  budget_overrun_amount?: number
  pros: string[]
  risks: string[]
  score: number
}

export interface PlaceRecord {
  benefits: string | null
  deal_structure: string
  distance_to_the_insulation_supplier_km: number
  distance_to_the_nearest_electric_substation_km: number
  distance_to_the_nearest_federal_highway_km: number
  distance_to_the_nearest_gas_substation_km: number
  distance_to_the_nearest_railway_station_km: number
  distance_to_the_supplier_of_rolled_steel_km: number
  estimate: PlaceEstimate
  insights: PlaceInsights
  place_address: string
  place_lat: number
  place_lon: number
  price_rub: number | null
  sales_radius: string
  square_m2: number
}

export interface ScoredPlace {
  region_name: string
  place_address: string
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
