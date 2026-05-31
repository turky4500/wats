---
sidebar_position: 3
title: "Configuration Reference"
---

# Configuration Reference

Complete documentation of environment variables for MultiWA Gateway.

## Quick Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | - | PostgreSQL connection string |
| `REDIS_URL` | ✅ | - | Redis connection string |
| `JWT_SECRET` | ✅ | - | Secret key for JWT |
| `SESSIONS_PATH` | ❌ | `/data/sessions` | WhatsApp session storage path |
| `API_PORT` | ❌ | `3000` | API server port |
| `NODE_ENV` | ❌ | `development` | Environment mode |

---

## Database

### `DATABASE_URL`
**Required** | String

PostgreSQL connection string in the following format:
```
postgresql://[user]:[password]@[host]:[port]/[database]?sslmode=[mode]
```

**Example:**
```env
# Development
DATABASE_URL=postgresql://multiwa:multiwa_password@localhost:5432/multiwa_gateway

# Production (with SSL)
DATABASE_URL=postgresql://user:password@db.host.com:5432/multiwa?sslmode=require
```

---

## Redis

### `REDIS_URL`
**Required** | String

Redis connection string for queue and caching.

```env
# Development
REDIS_URL=redis://localhost:6379

# Production (with password)
REDIS_URL=redis://:password@redis.host.com:6379
```

---

## Authentication

### `JWT_SECRET`
**Required** | String (min 32 characters)

Secret key for signing JWT tokens. **MUST be changed in production!**

```bash
# Generate secure secret
openssl rand -base64 32
```

### `JWT_EXPIRES_IN`
**Optional** | String | Default: `7d`

JWT token validity duration. Format: `Xd` (days), `Xh` (hours), `Xm` (minutes).

```env
JWT_EXPIRES_IN=7d   # 7 days
JWT_EXPIRES_IN=24h  # 24 hours
```

### `ENCRYPTION_KEY`
**Optional** | String (32 characters)

Key for encrypting sensitive data (API keys, credentials).

```bash
# Generate 32-character key
openssl rand -hex 16
```

---

## API Server

### `API_PORT`
**Optional** | Number | Default: `3000`

Port for the NestJS API server.

### `API_HOST`
**Optional** | String | Default: `0.0.0.0`

Host binding for the API server.

### `CORS_ORIGINS`
**Optional** | String (comma-separated)

Allowed origins for CORS. Separate multiple origins with commas.

```env
# Development
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Production
CORS_ORIGINS=https://admin.yourdomain.com,https://app.yourdomain.com
```

---

## WhatsApp Sessions

### `SESSIONS_PATH`
**Optional** | String | Default: `/data/sessions`

Directory for storing WhatsApp session data (Baileys auth files).

```env
# Development
SESSIONS_PATH=./sessions

# Production (Docker volume)
SESSIONS_PATH=/data/sessions
```

> ⚠️ **Important**: This path must be persistent (Docker volume) so sessions are not lost when the container restarts.

---

## Rate Limiting

### `RATE_LIMIT_TTL`
**Optional** | Number | Default: `60`

Time window in seconds for rate limiting.

### `RATE_LIMIT_MAX`
**Optional** | Number | Default: `100`

Maximum requests per time window.

### Advanced Rate Limiting (Production)

```env
RATE_LIMIT_SHORT=10/1s    # 10 requests per second
RATE_LIMIT_MEDIUM=100/1m  # 100 requests per minute
RATE_LIMIT_LONG=1000/1h   # 1000 requests per hour
```

---

## Worker

### `WORKER_CONCURRENCY`
**Optional** | Number | Default: `10`

Number of concurrent jobs processed by the worker.

```env
# Low-resource server
WORKER_CONCURRENCY=5

# High-performance server
WORKER_CONCURRENCY=20
```

---

## Webhook

### `WEBHOOK_TIMEOUT`
**Optional** | Number | Default: `30000`

Timeout in milliseconds for webhook delivery.

### `WEBHOOK_RETRY_ATTEMPTS`
**Optional** | Number | Default: `3`

Number of retry attempts if webhook delivery fails.

---

## Logging

### `LOG_LEVEL`
**Optional** | String | Default: `info`

Logging level: `debug`, `info`, `warn`, `error`.

```env
# Development (verbose)
LOG_LEVEL=debug

# Production (minimal)
LOG_LEVEL=warn
```

### `NODE_ENV`
**Optional** | String | Default: `development`

Environment mode: `development`, `production`, `test`.

---

## Admin UI (Next.js)

### `NEXT_PUBLIC_API_URL`
**Required for Admin** | String

API backend URL for the Admin UI.

```env
# Development
NEXT_PUBLIC_API_URL=http://localhost:3000

# Production
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

---

## Optional Services

### Sentry (Error Tracking)

```env
SENTRY_DSN=https://key@sentry.io/project
```

### MinIO (S3-compatible Storage)

```env
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=multiwa-media
MINIO_USE_SSL=false
```

---

## Example Configurations

### Development (.env)

```env
DATABASE_URL=postgresql://multiwa:multiwa_password@localhost:5432/multiwa_gateway
REDIS_URL=redis://localhost:6379
JWT_SECRET=development-secret-key-change-in-production
JWT_EXPIRES_IN=7d
API_PORT=3000
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
SESSIONS_PATH=./sessions
LOG_LEVEL=debug
NODE_ENV=development
```

### Production (.env.production)

```env
DATABASE_URL=postgresql://user:password@db.host.com:5432/multiwa?sslmode=require
REDIS_URL=redis://:password@redis.host.com:6379
JWT_SECRET=your-secure-generated-secret-key-here
JWT_EXPIRES_IN=7d
API_PORT=3000
CORS_ORIGINS=https://admin.yourdomain.com
SESSIONS_PATH=/data/sessions
LOG_LEVEL=warn
NODE_ENV=production
RATE_LIMIT_MAX=100
RATE_LIMIT_TTL=60
```

---

## Security Checklist

- [ ] `JWT_SECRET` uses a random string of 32+ characters
- [ ] `DATABASE_URL` uses SSL in production
- [ ] `CORS_ORIGINS` only whitelists required domains
- [ ] `LOG_LEVEL` set to `warn` or `error` in production
- [ ] `SESSIONS_PATH` uses a persistent volume
