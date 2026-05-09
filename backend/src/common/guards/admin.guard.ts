import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../../modules/auth/auth.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token || !this.auth.verifyAdminToken(token)) {
      throw new UnauthorizedException('Admin authentication is required');
    }

    return true;
  }

  private extractToken(request: Request) {
    const authorization = request.headers.authorization;
    if (authorization?.startsWith('Bearer ')) {
      return authorization.slice('Bearer '.length).trim();
    }

    const headerToken = request.headers['x-admin-token'];
    return typeof headerToken === 'string' ? headerToken : undefined;
  }
}
