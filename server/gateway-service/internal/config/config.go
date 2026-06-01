package config

import (
	"log"
	"os"
	"time"

	"github.com/ilyakaznacheev/cleanenv"
	"github.com/joho/godotenv"
)

type Config struct {
	Env string `yaml:"env" env-default:"local"`
	// Storage       `yaml:"storage"`
	HTTPServer    `yaml:"http_server"`
	Microservices `yaml:"microservices"`
	Redis         `yaml:"redis"`
	// SMTP       `yaml:"smtp"`
	// JWT        `yaml:"jwt"`
	// Redis      `yaml:"redis"`
}

type Redis struct {
	Address  string `yaml:"address" env:"REDIS_ADDR" env-default:"localhost:6379"`
	Password string `yaml:"password" env:"REDIS_PASS"`
	DB       int    `yaml:"db" env:"REDIS_DB" env-default:"0"`
}

// type Redis struct {
// 	Address     string        `yaml:"redis_address" env-required:"true"`
// 	Password    string        `yaml:"redis_password"`
// 	User        string        `yaml:"redis_user" env-required:"true"`
// 	Db          int           `yaml:"redis_db" env-default:"0"`
// 	MaxRetries  int           `yaml:"redis_maxRetries" env-required:"true"`
// 	DialTimeout time.Duration `yaml:"redis_dialTimeout" env-required:"true"`
// 	Timeout     time.Duration `yaml:"redis_timeout" env-required:"true"`
// }

// type Storage struct {
// 	DbHost string `yaml:"db_host" env-required:"true"`
// 	DbUser string `yaml:"db_user" env-required:"true"`
// 	DbPort int    `yaml:"db_port" env-required:"true"`
// 	DbPass string `yaml:"db_pass" env-required:"true"`
// 	DbName string `yaml:"db_name" env-required:"true"`
// }

// type SMTP struct {
// 	Host     string `yaml:"smtp_host" env-required:"true"`
// 	Port     int    `yaml:"smtp_port" env-required:"true"`
// 	Username string `yaml:"username" env-required:"true"`
// 	Password string `yaml:"password" env-required:"true"`
// 	AppHost  string `yaml:"app_host" env-required:"true"`
// }

type HTTPServer struct {
	Address     string        `yaml:"http_address" env-default:"localhost:8080"`
	Timeout     time.Duration `yaml:"http_timeout" env-default:"2m"`
	IdleTimeout time.Duration `yaml:"http_idle_timeout" env-default:"60s"`
}

type Microservices struct {
	Service2URL string `yaml:"service_2_url" env:"SERVICE_2_URL" env-required:"true"`
	Service3URL string `yaml:"service_3_url" env:"SERVICE_3_URL" env-required:"true"`
}

// type JWT struct {
// 	JWT_ACCESS_SECRET  string `yaml:"jwt_access_secret" env-required:"true"`
// 	JWT_REFRESH_SECRET string `yaml:"jwt_refresh_secret" env-required:"true"`
// }

func MustLoad() *Config {
	if _, err := os.Stat(".env"); err == nil {
		if err := godotenv.Load(); err != nil {
			log.Fatalf("cannot load .env file: %s", err)
		}
	}
	configPath := os.Getenv("CONFIG_PATH")
	if configPath == "" {
		log.Fatal("CONFIG_PATH is not set")
	}

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		log.Fatalf("config file does not exist: %s", configPath)
	}

	var cnf Config
	if err := cleanenv.ReadConfig(configPath, &cnf); err != nil {
		log.Fatalf("cannot read config: %s", err)
	}

	return &cnf
}
