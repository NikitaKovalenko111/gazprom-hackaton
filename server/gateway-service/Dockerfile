FROM golang:latest

WORKDIR /gateway

COPY go.mod go.sum ./
RUN go mod download

COPY . .

EXPOSE 3001

CMD ["go", "run", "./cmd/gateway/main.go"]