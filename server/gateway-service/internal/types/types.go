package types

const (
	EnvLocal = "local"
	EnvDev   = "dev"
	EnvProd  = "prod"
)

type HTTPError struct {
	message string
	error   string
}
