package storage

import (
	"context"
	"encoding/json"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisClient struct {
	client *redis.Client
}

func Init(addr string, password string, db int) *RedisClient {
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})

	return &RedisClient{client: rdb}
}

func (r *RedisClient) Close() error {
	return r.client.Close()
}

func (r *RedisClient) SaveRequest(ctx context.Context, key string, v interface{}, ttl time.Duration) error {
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return r.client.Set(ctx, key, b, ttl).Err()
}

func (r *RedisClient) GetRequest(ctx context.Context, key string, out interface{}) error {
	cmd := r.client.Get(ctx, key)
	if err := cmd.Err(); err != nil {
		return err
	}
	b, err := cmd.Bytes()
	if err != nil {
		return err
	}
	return json.Unmarshal(b, out)
}
