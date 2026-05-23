package models

type DataResponse struct {
	Id          uint64      `json:"id,omitempty"`
	Name        string      `json:"name,omitempty"`
	Coordinates Coordinates `json:"coordinates,omitempty"`
	Description string      `json:"description,omitempty"`
	Features    Features    `json:"features,omitempty"`
	Sites       []Sites     `json:"sites,omitempty"`
	Metadata    Metadata    `json:"metadata,omitempty"`
}

type Coordinates struct {
	Lat float64 `json:"lat,omitempty"`
	Lon float64 `json:"lon,omitempty"`
}

type Features struct {
	Energy    Energy    `json:"energy,omitempty"`
	Logistics Logistics `json:"logistics,omitempty"`
	Labor     Labor     `json:"labor,omitempty"`
	Social    Social    `json:"social,omitempty"`
	Economy   Economy   `json:"economy,omitempty"`
}

type Energy struct {
	ElectricityCost float32 `json:"electricity_cost,omitempty"`
	GasCost         float32 `json:"gas_cost,omitempty"`
	PowerCapacity   float32 `json:"power_capacity,omitempty"`
	GridStability   float32 `json:"grid_stability"`
}

type Logistics struct {
	DistanceToHighwayKm float32 `json:"distance_to_highway_km,omitempty"`
	DistanceToRailwayKm float32 `json:"distance_to_railway_km,omitempty"`
	DistanceToAirportKm float32 `json:"distance_to_airport_km,omitempty"`
	DeliveryTimeAvgDays float32 `json:"delivery_time_avg_days,omitempty"`
	LogisticsScore      float32 `json:"logistics_score"`
}

type Labor struct {
	AvgSalary              uint64  `json:"avg_salary,omitempty"`
	UnemploymentRate       float32 `json:"unemployment_rate"`
	UniversitiesCount      uint64  `json:"universities_count,omitempty"`
	CollegesCount          uint64  `json:"colleges_count,omitempty"`
	LaborAvailabilityScore float32 `json:"labor_availability_score"`
}

type Social struct {
	HousingCost           uint64  `json:"housing_cost,omitempty"`
	UrbanEnvironmentScore float32 `json:"urban_environment_score"`
	SchoolsCount          uint64  `json:"schools_count"`
	QualityOfLifeScore    float32 `json:"quality_of_life_score"`
}

type Economy struct {
	LandCost         uint64  `json:"land_cost,omitempty"`
	TaxBenefitsScore float32 `json:"tax_benefits_score"`
	SubsidiesScore   float32 `json:"subsidies_score"`
	InvestmentIndex  float32 `json:"investment_index"`
}

type Sites struct {
	Id             string         `json:"id,omitempty"`
	Name           string         `json:"name,omitempty"`
	Coordinates    Coordinates    `json:"coordinates,omitempty"`
	AreaTotal      float64        `json:"area_total_m2,omitempty"`
	AreaAvailable  float64        `json:"area_available_m2,omitempty"`
	Distance       Distance       `json:"distance,omitempty"`
	Infrastructure Infrastructure `json:"infrastructure"`
	Costs          Costs          `json:"costs,omitempty"`
}

type Distance struct {
	ToHighwayKm     float64 `json:"to_highway_km,omitempty"`
	ToRailwayKm     float64 `json:"to_railway_km,omitempty"`
	ToAirportKm     float64 `json:"to_airport_km,omitempty"`
	ToSupplierAvgKm float64 `json:"to_supplier_avg_km,omitempty"`
}

type Infrastructure struct {
	ElectricityAvailable bool `json:"electricity_available"`
	GasAvailable         bool `json:"gas_available"`
	WaterAvailable       bool `json:"water_available"`
	SewageAvailable      bool `json:"sewage_available"`
}

type Costs struct {
	PricePer       float64 `json:"price_per_m2,omitempty"`
	ConnectionCost float64 `json:"connection_cost,omitempty"`
}

type Metadata struct {
	RegionType string   `json:"region_type,omitempty"`
	Climate    string   `json:"climate,omitempty"`
	Risks      []string `json:"risks,omitempty"`
}
