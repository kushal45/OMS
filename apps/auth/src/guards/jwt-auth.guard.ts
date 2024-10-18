// src/auth/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private readonly authService: AuthService) {
        super();
      }
    canActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromRequest(request);
        if (this.authService.isTokenBlacklisted(token)) {
          throw new UnauthorizedException('Token has been blacklisted');
        }
        return super.canActivate(context);
      }
    
      private extractTokenFromRequest(request: any): string {
        const authHeader = request.headers.authorization;
        if (!authHeader) {
          return null;
        }
        return authHeader.split(' ')[1];
      }
}