// MultiWA Gateway API - Demo Mode Guard
// apps/api/src/common/guards/demo.guard.ts
//
// When DEMO_MODE=true, this guard blocks all mutating HTTP methods
// (POST, PUT, PATCH, DELETE) and returns a friendly 403 message.
// GET/HEAD/OPTIONS requests pass through, so users can still
// browse the dashboard in read-only mode.

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

/** Decorator to allow specific mutating endpoints even in demo mode (e.g. login) */
export const ALLOW_IN_DEMO = 'allowInDemo';
export const AllowInDemo = () => SetMetadata(ALLOW_IN_DEMO, true);

@Injectable()
export class DemoGuard implements CanActivate {
  private readonly isDemoMode: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {
    this.isDemoMode =
      this.configService.get<string>('DEMO_MODE', 'false').toLowerCase() === 'true';
  }

  canActivate(context: ExecutionContext): boolean {
    // If demo mode is off, always allow
    if (!this.isDemoMode) {
      return true;
    }

    // Check if this route is explicitly allowed in demo mode
    const allowInDemo = this.reflector.getAllAndOverride<boolean>(ALLOW_IN_DEMO, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowInDemo) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const method = request.method?.toUpperCase();

    // Allow read-only methods
    const readOnlyMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (readOnlyMethods.includes(method)) {
      return true;
    }

    // Block mutating methods with a friendly message
    throw new ForbiddenException({
      statusCode: 403,
      error: 'Demo Mode',
      message:
        '🔒 This action is disabled in demo mode. Deploy your own instance to unlock full functionality!',
      demoMode: true,
    });
  }
}
