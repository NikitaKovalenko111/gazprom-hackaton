package storage

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
)

func CacheKeyFor(v interface{}, prefix string) string {
	b, _ := json.Marshal(v)
	h := sha256.Sum256(b)
	return prefix + ":" + hex.EncodeToString(h[:])
}

func GetFromCache(ctx context.Context, r *RedisClient, key string, out interface{}) (bool, error) {
	cmd := r.client.Get(ctx, key)
	if err := cmd.Err(); err != nil {
		if errors.Is(err, redis.Nil) {
			return false, nil
		}
		return false, err
	}
	b, err := cmd.Bytes()
	if err != nil {
		return false, err
	}
	if err := json.Unmarshal(b, out); err != nil {
		return false, err
	}
	return true, nil
}

func GetOrComputeWithLock(ctx context.Context, r *RedisClient, key string, ttl time.Duration, compute func() (interface{}, error)) (interface{}, error) {
	var out interface{}
	if ok, err := GetFromCache(ctx, r, key, &out); err != nil {
		return nil, err
	} else if ok {
		return out, nil
	}

	lockKey := key + ":lock"
	locked, err := r.client.SetNX(ctx, lockKey, "1", 10*time.Second).Result()
	if err == nil && locked {
		v, err := compute()
		if err != nil {
			r.client.Del(ctx, lockKey)
			return nil, err
		}
		_ = r.SaveRequest(ctx, key, v, ttl)
		r.client.Del(ctx, lockKey)
		return v, nil
	}

	for i := 0; i < 50; i++ {
		time.Sleep(100 * time.Millisecond)
		if ok, _ := GetFromCache(ctx, r, key, &out); ok {
			return out, nil
		}
	}

	v, err := compute()
	if err != nil {
		return nil, err
	}
	_ = r.SaveRequest(ctx, key, v, ttl)
	return v, nil
}
