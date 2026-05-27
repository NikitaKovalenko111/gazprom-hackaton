package form_service

import (
	"gateway-service/internal/models"

	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type FormService struct {
	httpClient *http.Client
	dataURL    string
	LLMUrl     string
}

func Init(dataURL string, LLMUrl string) *FormService {
	return &FormService{
		httpClient: &http.Client{
			Timeout: 2 * time.Minute,
		},
		dataURL: dataURL,
		LLMUrl:  LLMUrl,
	}
}

// func (s *FormService) DataRequests(ctx context.Context, data *models.FormResponse) (*models.LLMResponse, error) {
// 	dataResponse, err := s.SendClientData(ctx, data)
// 	if err != nil {
// 		return nil, err
// 	}

// 	LLMResponse, err := s.SendDataLLM(ctx, dataResponse)
// 	if err != nil {
// 		return nil, err
// 	}

// 	return LLMResponse, nil
// }

func (s *FormService) SendClientData(ctx context.Context, data *models.FormResponse) (*models.DataResponse, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.dataURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("service returned bad status: %s", resp.Status)
	}

	var result models.DataResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

func (s *FormService) SendDataLLM(ctx context.Context, data *models.ScoredPlace) (*models.LLMResponse, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.LLMUrl+"/generate", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		var errResult models.LLMResponse
		if err := json.NewDecoder(resp.Body).Decode(&errResult); err == nil && errResult.Error != "" {
			return nil, fmt.Errorf("llm service error [%s]: %s (details: %s)", resp.Status, errResult.Error, errResult.Details)
		}
		return nil, fmt.Errorf("llm service returned bad status: %s", resp.Status)
	}

	var result models.LLMResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if !result.Ok {
		return nil, fmt.Errorf("llm generation failed: %s (details: %s)", result.Error, result.Details)
	}

	return &result, nil
}

func (s *FormService) SendDataLLMPresentation(ctx context.Context, data *models.ScoredPlace) (*models.LLMResponse, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.LLMUrl+"/generate_pptx", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		var errResult models.LLMResponse
		if err := json.NewDecoder(resp.Body).Decode(&errResult); err == nil && errResult.Error != "" {
			return nil, fmt.Errorf("llm service error [%s]: %s (details: %s)", resp.Status, errResult.Error, errResult.Details)
		}
		return nil, fmt.Errorf("llm service returned bad status: %s", resp.Status)
	}

	var result models.LLMResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if !result.Ok {
		return nil, fmt.Errorf("llm generation failed: %s (details: %s)", result.Error, result.Details)
	}

	return &result, nil
}
