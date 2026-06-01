package main

import (
	"gateway-service/internal/app"
	"gateway-service/internal/config"

	_ "gateway-service/docs"
)

// @title			Gazprom Hackaton Gateway API
// @version		1.0
// @description	API шлюз для оркестрации запросов к аналитическому и LLM сервисам.
// @host			localhost:3001
// @BasePath		/
func main() {
	cfg := config.MustLoad()

	app.Run(cfg)
}
