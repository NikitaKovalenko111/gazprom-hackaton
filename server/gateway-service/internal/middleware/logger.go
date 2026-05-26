package middleware

import (
	"log/slog"

	"github.com/gofiber/fiber/v2"
)

func NewLogger(logger *slog.Logger) func(c *fiber.Ctx) error {
	return func(c *fiber.Ctx) error {
		path := string(c.Path())
		method := c.Method()

		err := c.Next()

		status := c.Response().StatusCode()
		if err != nil {
			logger.Error("REQUEST FAILED",
				slog.String("method", method),
				slog.String("path", path),
				slog.Int("status", status),
				slog.String("error", err.Error()),
			)
			return err
		}

		logger.Info("REQUEST COMPLETED",
			slog.String("method", method),
			slog.String("path", path),
			slog.Int("status", status),
		)

		return nil
	}
}
