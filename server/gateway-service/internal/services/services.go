package services

import (
	formService "gateway-service/internal/services/handlers/form"
)

type Services struct {
	FormService *formService.FormService
}

func Init(dataURL string, LLMUrl string) *Services {
	return &Services{
		FormService: formService.Init(dataURL, LLMUrl),
	}
}
