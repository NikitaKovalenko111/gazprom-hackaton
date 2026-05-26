package models

//TODO: LLMResponse scruct

type LLMResponse struct {
	Ok          bool    `json:"ok"`
	Model       string  `json:"model,omitempty"`
	UsageTokens *uint64 `json:"usage_tokens,omitempty"`
	Result      string  `json:"result,omitempty"`
	Error       string  `json:"error,omitempty"`
	Details     string  `json:"details,omitempty"`
}
