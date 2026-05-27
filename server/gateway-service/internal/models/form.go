package models

type FormResponse struct {
	ProductionVolume         uint64   `json:"productionVolume"`
	EmployeesCount           uint64   `json:"employeesCount"`
	BudgetMillionRub         uint64   `json:"budgetMillionRub"`
	RailwayRequired          bool     `json:"railwayRequired"`
	MaxDistanceToHighwayKm   float64  `json:"maxDistanceToHighwayKm"`
	ArchitecturePriority     string   `json:"architecturePriority"`
	Landscaping              []string `json:"landscaping"`
	HousingPercent           uint64   `json:"housingPercent"`
	HousingType              string   `json:"housingType"`
	KindergartenPlacesPer100 uint64   `json:"kindergartenPlacesPer100"`
	Sports                   []string `json:"sports"`
}

// type FormResponse struct {
// 	Project                    Project                    `json:"project,omitempty"`
// 	Requirements               Requirements               `json:"requirements,omitempty"`
// 	Priorities                 Priorities                 `json:"priorities,omitempty"`
// 	Constraints                Constraints                `json:"constraints,omitempty"`
// 	Preferences                Preferences                `json:"preferences,omitempty"`
// 	InfrastructureRequirements InfrastructureRequirements `json:"infrastructure_requirements,omitempty"`
// 	Architecture               Architecture               `json:"architecture,omitempty"`
// 	Landscaping                Landscaping                `json:"landscaping,omitempty"`
// 	Meta                       Meta                       `json:"meta,omitempty"`
// }

// type Project struct {
// 	ProductionType string `json:"production_type,omitempty"`
// 	InsulationType string `json:"insulation_type,omitempty"`
// }

// type Requirements struct {
// 	FactoryArea   float64 `json:"factory_area_m2"`
// 	WarehouseArea float64 `json:"warehouse_area_m2,omitempty"`
// }

// type Priorities struct {
// 	Logistics float32 `json:"logistics"`
// 	Energy    float32 `json:"energy"`
// 	Labor     float32 `json:"labor"`
// 	Social    float32 `json:"social"`
// 	Economy   float32 `json:"economy"`
// }

// type Constraints struct {
// 	MaxLandCost            float64 `json:"max_land_cost,omitempty"`
// 	MaxDistanceToHighwayKm float64 `json:"max_distance_to_highway_km,omitempty"`
// 	MinPowerCapacity       float32 `json:"min_power_capacity,omitempty"`
// }

// type Preferences struct {
// 	RegionTypes []string `json:"region_types,omitempty"`
// 	Climate     []string `json:"climate,omitempty"`
// }

// type InfrastructureRequirements struct {
// 	GasRequired    bool `json:"gas_required"`
// 	WaterRequired  bool `json:"water_required"`
// 	SewageRequired bool `json:"sewage_required"`
// }

// type Architecture struct {
// 	Priority string   `json:"priority,omitempty"`
// 	Colors   []string `json:"colors,omitempty"`
// }

// type Landscaping struct {
// 	Selected []string `json:"selected,omitempty"`
// }

// type Meta struct {
// 	RequestId uuid.UUID `json:"request_id,omitempty"`
// 	Timestamp time.Time `json:"timestamp,omitempty"`
// }
