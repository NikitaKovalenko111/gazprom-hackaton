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

	app.Get("/health", controller.Health)

	router.Post("/form", controller.DataEntry)
	router.Post("/llm", controller.LLMRequest)
	router.Post("/genpres", controller.LLMRequestPresentation)
}

// Health godoc
//
//	@Summary		Проверка работоспособности
//	@Description	Возвращает 200 OK, если шлюз запущен и работает.
//	@Tags			system
//	@Produce		plain
//	@Success		200	{string}	string	"OK"
//	@Router			/health [get]
func (controller *FormController) Health(c *fiber.Ctx) error {
	return c.SendStatus(fiber.StatusOK)
}

// DataEntry godoc
//
//	@Summary		Обработка формы
//	@Description	Принимает конфигурацию проекта от клиента, запрашивает инфраструктурные метрики и возвращает обработанные данные.
//	@Tags			form
//	@Accept			json
//	@Produce		json
//	@Param			body	body		models.FormResponse	true	"Данные клиентской формы"
//	@Success		201		{object}	models.DataResponse
//	@Failure		400		{object}	object{message=string,error=string}	"Неверный формат JSON входных данных"
//	@Failure		500		{object}	object{message=string,error=string}	"Ошибка работы внутреннего микросервиса"
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

	dataResponse, err := controller.formService.GetOrFetchDataResponse(ctx, &body)

	if err != nil {
		return c.Status(fiber.ErrInternalServerError.Code).JSON(fiber.Map{
			"message": "Couldn't process form data!",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(dataResponse)
}

// LLMRequest godoc
//
//	@Summary		Генерация рекомендации
//	@Description	Принимает обработанную конфигурацию проекта от клиента и генерирует рекомендацию от LLM.
//	@Tags			form
//	@Accept			json
//	@Produce		json
//	@Param			body	body		models.DataResponse	true "Данные для генерации рекомендации"
//	@Success		201		{object}	models.LLMResponse
//	@Failure		400		{object}	object{message=string,error=string}	"Неверный формат JSON входных данных"
//	@Failure		500		{object}	object{message=string,error=string}	"Ошибка работы внутреннего микросервиса или LLM"
//	@Router			/api/v1/llm [post]
func (controller *FormController) LLMRequest(c *fiber.Ctx) error {
	var body models.ScoredPlace

	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.ErrBadRequest.Code).JSON(fiber.Map{
			"message": "Couldn't parse body!",
			"error":   err.Error(),
		})
	}

	ctx := c.UserContext()

	llmResponse, err := controller.formService.GetOrFetchLLMResponse(ctx, &body)

	if err != nil {
		return c.Status(fiber.ErrInternalServerError.Code).JSON(fiber.Map{
			"message": "Couldn't generate LLM recommendation!!",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(llmResponse)
}

// LLMRequestPresentation godoc
//
//	@Summary		Генерация презентации
//	@Description	Принимает обработанную конфигурацию проекта от клиента и LLM генерирует презентацию.
//	@Tags			form
//	@Accept			json
//	@Produce		json
//	@Param			body	body		models.DataResponse	true "Данные для генерации презентации"
//	@Success		201		{object}	models.LLMResponse
//	@Failure		400		{object}	object{message=string,error=string}	"Неверный формат JSON входных данных"
//	@Failure		500		{object}	object{message=string,error=string}	"Ошибка работы внутреннего микросервиса или LLM"
//	@Router			/api/v1/genpres [post]
func (controller *FormController) LLMRequestPresentation(c *fiber.Ctx) error {
	var body models.ScoredPlace

	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.ErrBadRequest.Code).JSON(fiber.Map{
			"message": "Couldn't parse body!",
			"error":   err.Error(),
		})
	}

	ctx := c.UserContext()

	llmResponse, err := controller.formService.GetOrFetchLLMPresentationResponse(ctx, &body)

	if err != nil {
		return c.Status(fiber.ErrInternalServerError.Code).JSON(fiber.Map{
			"message": "Couldn't generate LLM presintation!!",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(llmResponse)
}
