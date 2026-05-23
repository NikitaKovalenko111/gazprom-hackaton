package http

import (
	"gateway-service/internal/services"
	formController "gateway-service/internal/transport/http/controllers/form"

	"github.com/gofiber/fiber/v2"
)

type HTTP struct {
	app            *fiber.App
	formController *formController.FormController
}

func Init(services *services.Services, app *fiber.App) *HTTP {
	return &HTTP{
		app:            app,
		formController: formController.Init(services.FormService),
	}
}

func (http *HTTP) Start() {
	http.formController.Start("api/v1/form", http.app)
}
