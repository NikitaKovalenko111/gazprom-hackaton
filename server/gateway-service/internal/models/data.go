package models

type DataResponse []ScoredPlace

type ScoredPlace struct {
	RegionName string         `json:"region_name"`
	PlaceName  string         `json:"place_name"`
	Score      float64        `json:"score"`
	Confidence float64        `json:"confidence"`
	Breakdown  ScoreBreakdown `json:"breakdown"`
	Why        WhyInsights    `json:"why"`
	RegionInfo RegionInfo     `json:"region_info"`
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
	Places                []Place               `json:"places"`
}

type SocialInfrastructure struct {
	UrbanEnvironmentIndex                  float64 `json:"urban_environment_index"`
	KindergartenAvailabilityPer100Children float64 `json:"kindergarten_availability_per_100_children"`
	Average1RoomApartmentRentRub           float64 `json:"average_1room_apartment_rent_rub"`
	ProfileCollegesBudgetPlaces            float64 `json:"profile_colleges_budget_places"`
}

type RegionEconomy struct {
	Benefits                          []string `json:"benefits"`
	IndustrialElectricityTariffRubKwh float64  `json:"industrial_electricity_tariff_rub_kwh"`
	AverageMonthlySalaryRub           float64  `json:"average_monthly_salary_rub"`
	EcologicalClassIza                string   `json:"ecological_class_iza"`
}

type NetworkInfrastructure struct {
	AvailableElectricalCapacityKva  float64 `json:"available_electrical_capacity_kva"`
	TechnologicalConnectionFeeRubKw float64 `json:"technological_connection_fee_rub_kw"`
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

type Place struct {
	ID                                   int64          `json:"id"`
	SquareHa                             float64        `json:"square_ha"`
	PlaceLon                             float64        `json:"place_lon"`
	PlaceLat                             float64        `json:"place_lat"`
	PlaceName                            string         `json:"place_name"`
	DealStructure                        []string       `json:"deal_structure"`
	PriceRub                             float64        `json:"price_rub"`
	Benefit                              []string       `json:"benefit"`
	DistanceToTheNearestRailwayStationKm float64        `json:"distance_to_the_nearest_railway_station_km"`
	DistanceToTheNearestFederalHighwayKm float64        `json:"distance_to_the_nearest_federal_highway_km"`
	Infrastructure                       Infrastructure `json:"infrastructure"`
	MinDistKmToMetallurgicalFactory      float64        `json:"min_dist_km_to_metallurgical_factory"`
	NearestMetallurgicalFactory          Factory        `json:"nearest_metallurgical_factory"`
	MinDistKmToInsulationFactory         float64        `json:"min_dist_km_to_insulation_factory"`
	NearestInsulationFactory             Factory        `json:"nearest_insulation_factory"`
	SquareM2                             float64        `json:"square_m2"`
	Estimate                             Estimate       `json:"estimate"`
	Insights                             Insights       `json:"insights"`
}

type Infrastructure struct {
	HasGas                 bool        `json:"has_gas"`
	AvailablePowerKva      float64     `json:"available_power_kva"`
	DistanceToSubstationKm float64     `json:"distance_to_substation_km"`
	ConnectionCostPerKw    float64     `json:"connection_cost_per_kw"`
	SubstationCoordinates  Coordinates `json:"substation_coordinates"`
	GasCoordinates         Coordinates `json:"gas_coordinates"`
}

type Coordinates struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

type Factory struct {
	Company string  `json:"company"`
	Lat     float64 `json:"lat"`
	Lon     float64 `json:"lon"`
}

type Estimate struct {
	TotalMlnRub          float64          `json:"total_mln_rub"`
	InsulationMultiplier float64          `json:"insulation_multiplier"`
	SquareM2             float64          `json:"square_m2"`
	AreasM2              AreasM2          `json:"areas_m2"`
	DetailedCostsRub     DetailedCostsRub `json:"detailed_costs_rub"`
	CostsMlnRub          CostsMlnRub      `json:"costs_mln_rub"`
}

type AreasM2 struct {
	Shop                   float64 `json:"shop"`
	Warehouse              float64 `json:"warehouse"`
	Office                 float64 `json:"office"`
	Housing                float64 `json:"housing"`
	SocialObjects          float64 `json:"social_objects"`
	InfrastructureAndRoads float64 `json:"infrastructure_and_roads"`
	TotalSiteArea          float64 `json:"total_site_area"`
}

type DetailedCostsRub struct {
	ProductionShop         float64 `json:"Производственный цех"`
	FinishedGoodsWarehouse float64 `json:"Склад готовой продукции"`
	AbkOfficeBlock         float64 `json:"АБК (офисный блок)"`
	HousingDormitory       float64 `json:"Жилье (общежитие/квартиры)"`
	Kindergarten           float64 `json:"Детский сад"`
	Canteen                float64 `json:"Столовая"`
	MedicalCenter          float64 `json:"Медпункт"`
	RoadsAndParking        float64 `json:"Дороги и парковки"`
	Landscaping            float64 `json:"Благоустройство территории"`
	SportsFacilities       float64 `json:"Спортивные объекты"`
	GridConnection         float64 `json:"Технологическое присоединение к сетям"`
}

type CostsMlnRub struct {
	Production                   float64 `json:"production"`
	OfficeAndHousing             float64 `json:"office_and_housing"`
	SocialAndSports              float64 `json:"social_and_sports"`
	InfrastructureAndLandscaping float64 `json:"infrastructure_and_landscaping"`
	PowerConnection              float64 `json:"power_connection"`
}

type Insights struct {
	Score               float64    `json:"score"`
	Confidence          float64    `json:"confidence"`
	Pros                []string   `json:"pros"`
	Cons                []string   `json:"cons"`
	Risks               []string   `json:"risks"`
	Insulation          Insulation `json:"insulation"`
	BudgetOverrun       bool       `json:"budget_overrun"`
	BudgetOverrunAmount float64    `json:"budget_overrun_amount"`
}

type Insulation struct {
	Type   string `json:"type"`
	Reason string `json:"reason"`
}
