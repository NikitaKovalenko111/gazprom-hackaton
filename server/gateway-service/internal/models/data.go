package models

type DataResponse []ScoredPlace

type ScoredPlace struct {
	RegionName   string         `json:"region_name"`
	PlaceAddress string         `json:"place_address"`
	Score        float64        `json:"score"`
	Confidence   float64        `json:"confidence"`
	Breakdown    ScoreBreakdown `json:"breakdown"`
	Why          WhyInsights    `json:"why"`
	RegionInfo   RegionInfo     `json:"region_info"`
}

type ScoreBreakdown struct {
	Logistics float64 `json:"logistics"`
	Energy    float64 `json:"energy"`
	Labor     float64 `json:"labor"`
	Social    float64 `json:"social"`
	Economy   float64 `json:"economy"`
}

type WhyInsights struct {
	TopFactor string   `json:"top_factor"`
	Pros      []string `json:"pros"`
	Cons      []string `json:"cons"`
	Risks     []string `json:"risks"`
}

type RegionInfo struct {
	RegionName            string                `json:"region_name"`
	RegionLat             float64               `json:"region_lat"`
	RegionLon             float64               `json:"region_lon"`
	SocialInfrastructure  SocialInfrastructure  `json:"social_infrastructure"`
	Economy               RegionEconomy         `json:"economy"`
	NetworkInfrastructure NetworkInfrastructure `json:"network_infrastructure"`
	CulturalCode          CulturalCode          `json:"cultural_code"`
	Places                []map[string]any      `json:"places"`
}

type SocialInfrastructure struct {
	UrbanEnvironmentIndex                  int `json:"urban_environment_index"`
	KindergartenAvailabilityPer100Children int `json:"kindergarten_availability_per_100_children"`
	Average1RoomApartmentRentRub           int `json:"average_1room_apartment_rent_rub"`
	ProfileCollegesBudgetPlaces            int `json:"profile_colleges_budget_places"`
}

type RegionEconomy struct {
	HasTaxIncentivesTorOez            bool    `json:"has_tax_incentives_tor_oez"`
	TaxIncentivesDescription          string  `json:"tax_incentives_description"`
	HasReducedInsuranceContributions  bool    `json:"has_reduced_insurance_contributions"`
	IndustrialElectricityTariffRubKwh float64 `json:"industrial_electricity_tariff_rub_kwh"`
	AverageMonthlySalaryRub           int     `json:"average_monthly_salary_rub"`
	EcologicalClassIza                string  `json:"ecological_class_iza"`
}

type NetworkInfrastructure struct {
	AvailableElectricalCapacityKva  int `json:"available_electrical_capacity_kva"`
	TechnologicalConnectionFeeRubKw int `json:"technological_connection_fee_rub_kw"`
}

type CulturalCode struct {
	DominantArchitecturalStyles   []string     `json:"dominant_architectural_styles"`
	TraditionalMaterialsOrnaments []string     `json:"traditional_materials_ornaments"`
	ColorProfile                  ColorProfile `json:"color_profile"`
}

type ColorProfile struct {
	Primary     string `json:"primary"`
	Secondary   string `json:"secondary"`
	Accent      string `json:"accent"`
	Description string `json:"description"`
}
