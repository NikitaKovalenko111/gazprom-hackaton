package formcontroller

import (
	"gateway-service/internal/models"
	formService "gateway-service/internal/services/handlers/form"

	"github.com/gofiber/fiber/v2"
)

type FormController struct {
	formService *formService.FormService
}

func Init(formService *formService.FormService) *FormController {
	return &FormController{
		formService: formService,
	}
}

func (controller *FormController) Start(route string, app *fiber.App) {
	router := app.Group("/" + route)

	router.Get("/form", controller.DataEntry)
}

// DataEntry godoc
//
//	@Summary		Обработка формы и генерация аналитики через LLM
//	@Description	Принимает конфигурацию проекта от клиента, запрашивает инфраструктурные метрики и возвращает сгенерированный LLM ответ.
//	@Tags			form
//	@Accept			json
//	@Produce		json
//	@Param			body	body		models.FormResponse	true	"Данные клиентской формы"
//	@Success		211		{object}	models.LLMResponse
//	@Failure		400		{object}	object{message=string,error=string}	"Неверный формат JSON входных данных"
//	@Failure		500		{object}	object{message=string,error=string}	"Ошибка работы внутренних микросервисов или LLM"
//	@Router			/api/v1/form [post]
func (controller *FormController) DataEntry(c *fiber.Ctx) error {
	var body models.FormResponse

	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.ErrBadRequest.Code).JSON(fiber.Map{
			"message": "Couldn't parse body!",
			"error":   err.Error(),
		})
	}

	ctx := c.UserContext()

	llmResponse, err := controller.formService.DataRequests(ctx, &body)

	if err != nil {
		return c.Status(fiber.ErrInternalServerError.Code).JSON(fiber.Map{
			"message": "Couldn't create user!",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(llmResponse)
}
