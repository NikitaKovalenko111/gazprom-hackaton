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
