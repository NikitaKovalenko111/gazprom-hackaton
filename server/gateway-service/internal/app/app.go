package app

import (
	"gateway-service/internal/config"
	"gateway-service/internal/logger/sl"
	"gateway-service/internal/middleware"
	"gateway-service/internal/services"
	"gateway-service/internal/transport/http"

	"github.com/gofiber/fiber/v2/middleware/cors"

	"github.com/gofiber/fiber/v2"

	_ "gateway-service/docs"

	swaggerUI "github.com/swaggo/fiber-swagger"
)

// @title			Gazprom Hackaton Gateway API
// @version		1.0
// @description	API шлюз для оркестрации запросов к аналитическому и LLM сервисам.
// @host			localhost:3002
// @BasePath		/
func Run(cfg *config.Config) {
	logger := sl.InitLogger(cfg.Env)

	logger.Info("Logger is enabled")
	logger.Debug("Debug is enabled")

	services := services.Init(cfg.Service2URL, cfg.Service3URL)

	logger.Info("Successfully inited services!")

	app := fiber.New(fiber.Config{
		StrictRouting: true,
		WriteTimeout:  cfg.HTTPServer.Timeout,
		IdleTimeout:   cfg.HTTPServer.IdleTimeout,
	})
	app.Use(middleware.NewLogger(logger))

	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:5137",
		AllowCredentials: true,
	}))

	app.Get("/swagger/*", swaggerUI.WrapHandler)

	app.Get("/swagger", func(c *fiber.Ctx) error {
		return c.Redirect("/swagger/index.html")
	})

	http := http.Init(services, app)

	http.Start()
	// app.Get("/docs/*", swagger.New(swaggerCfg))

	app.Listen(cfg.HTTPServer.Address)
}
