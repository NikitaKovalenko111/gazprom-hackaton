package main

import (
	"gateway-service/internal/app"
	"gateway-service/internal/config"

	_ "gateway-service/docs"
)

//	@title			Tax Parser API
//	@version		0.4
//	@description	API Server for hackaton application that supplies service for operate debtors in db

// BasePath /

func main() {
	cfg := config.MustLoad()

	app.Run(cfg)
}
