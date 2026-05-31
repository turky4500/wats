---
sidebar_position: 5
title: "Demo Mode"
---

# Demo Mode

Deploy a **read-only showcase** of MultiWA without exposing your production data. Demo mode blocks all write operations while allowing users to explore the full dashboard experience.

## Quick Setup

```env
# API (.env)
DEMO_MODE=true

# Admin UI (.env.local)
NEXT_PUBLIC_DEMO_MODE=true
```

Restart both services after setting these variables.

---

## How It Works

### API Guard

When `DEMO_MODE=true`, a global [DemoGuard](https://github.com/ribato22/MultiWA/blob/main/apps/api/src/common/guards/demo.guard.ts) intercepts every incoming request:

| HTTP Method | Behavior |
|-------------|----------|
| `GET`, `HEAD`, `OPTIONS` | ✅ Allowed — users can browse freely |
| `POST`, `PUT`, `PATCH`, `DELETE` | ❌ Blocked — returns 403 |

**Blocked response example:**
```json
{
  "statusCode": 403,
  "error": "Demo Mode",
  "message": "🔒 This action is disabled in demo mode. Deploy your own instance to unlock full functionality!",
  "demoMode": true
}
```

### Frontend Banner

When `NEXT_PUBLIC_DEMO_MODE=true`, a dismissible amber banner appears at the top of every dashboard page:

> 🎮 **Demo Mode** — You're exploring a read-only instance. [Deploy your own →](https://github.com/ribato22/MultiWA)

The banner can be dismissed by clicking the ✕ button (per-session only).

---

## Whitelisted Endpoints

Some endpoints must remain functional even in demo mode. These are marked with the `@AllowInDemo()` decorator:

| Endpoint | Reason |
|----------|--------|
| `POST /auth/login` | Users need to log in to explore |
| `POST /auth/refresh` | Keep sessions alive |
| `POST /auth/2fa/verify` | Complete 2FA login flow |

### Adding More Whitelisted Endpoints

To allow additional endpoints in demo mode, add the `@AllowInDemo()` decorator:

```typescript
import { AllowInDemo } from '../../common/guards/demo.guard';

@Post('my-endpoint')
@AllowInDemo()
async myEndpoint() {
  // This endpoint will work even in demo mode
}
```

---

## Environment Variables

| Variable | App | Type | Default | Description |
|----------|-----|------|---------|-------------|
| `DEMO_MODE` | API | Boolean string | `false` | Enable read-only API guard |
| `NEXT_PUBLIC_DEMO_MODE` | Admin | Boolean string | `false` | Show demo banner in UI |

> **Note**: Both variables must be set independently. The API guard and the frontend banner operate separately — you can enable one without the other.

---

## Architecture

```
Request → DemoGuard → Route Handler
              │
              ├─ GET/HEAD/OPTIONS → ✅ Pass through
              ├─ @AllowInDemo()   → ✅ Pass through
              └─ POST/PUT/PATCH/DELETE → ❌ 403 Forbidden
```

The guard is registered globally in `AppModule` using NestJS `APP_GUARD` provider, so it applies to **all** routes automatically without needing `@UseGuards()` on each controller.

---

## Use Cases

- **Public demo instance** — Let potential users explore MultiWA before self-hosting
- **Conference booth** — Showcase features without risk of data modification
- **Documentation screenshots** — Capture consistent UI screenshots
- **Training environment** — Let team members explore safely
