package services

import (
	formService "gateway-service/internal/services/handlers/form"
	"gateway-service/internal/storage"
)

type Services struct {
	FormService *formService.FormService
	Redis       *storage.RedisClient
}

func Init(dataURL string, LLMUrl string, r *storage.RedisClient) *Services {
	return &Services{
		FormService: formService.Init(dataURL, LLMUrl, r),
		Redis:       r,
	}
}
