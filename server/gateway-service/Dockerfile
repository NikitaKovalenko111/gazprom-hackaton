# ===== Stage 1: Build =====
FROM golang:1.25-alpine AS builder 

# Устанавливаем необходимые пакеты для сборки
RUN apk add --no-cache git ca-certificates

WORKDIR /build

# Копируем модули для кэширования зависимостей
COPY go.mod go.sum ./
RUN go mod download

# Копируем исходный код
COPY . .

# Собираем бинарник со всеми нужными флагами
# -ldflags: уменьшаем размер, добавляем информацию о версии
# -trimpath: делает сборку воспроизводимой
# -tags netgo: статическая линковка сети (важно для alpine)
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-w -s -X main.Version=$(git describe --tags --always 2>/dev/null || echo 'dev')" \
    -trimpath \
    -tags netgo \
    -o /bin/gateway ./cmd/gateway/main.go

# ===== Stage 2: Runtime =====
FROM alpine:3.19

# Устанавливаем только самое необходимое: CA-сертификаты и tzdata
RUN apk --no-cache add ca-certificates tzdata && \
    addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -D -H appuser && \
    mkdir -p /app/config /app/.config && \
    chown -R appuser:appgroup /app

WORKDIR /app

# Копируем бинарник из builder
COPY --from=builder /bin/gateway /app/gateway
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Копируем дефолтный конфиг (опционально, как фоллбэк)
# COPY --chown=appuser:appgroup config/default.yaml /app/config/local.yaml

# Переключаемся на non-root пользователя
USER appuser

# Порт, который слушает сервис
EXPOSE 3001

# Health check (опционально, если есть эндпоинт /health)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Правильная передача сигналов для graceful shutdown
# exec заменяет shell-процесс, чтобы контейнер получал SIGTERM
ENTRYPOINT ["/app/gateway"]

# Аргументы по умолчанию (можно переопределить в docker-compose)
CMD ["--config", "/app/config/local.yaml"]