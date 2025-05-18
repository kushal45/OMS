import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private VALIDATE_SERVICE_URL = 'http://auth:3001/auth/validate-token';
  constructor(private httpService: HttpService) {}
  // Define a list of public (blacklisted) routes
  private readonly publicRoutes: Array<{ method: string; path: string }> = [
    { method: 'POST', path: '/auth/login' },
    { method: 'POST', path: '/auth/register' },
    { method: 'POST', path: '/auth/validate-token' },
  ];

  async canActivate(context: ExecutionContext): Promise<boolean> {
    let isActivated = true;
    try {
      const request = context.switchToHttp().getRequest();
      const token = this.extractTokenFromHeader(request);
      const { method, path } = request;

      const isPublic = this.publicRoutes.some(
        (route) => route.method === method && path.endsWith(route.path),
      );

      if (isPublic) {
        // Bypass JWT validation for public routes
        return true;
      }

      if (!token) {
        isActivated = false;
      }
      const response = await firstValueFrom(
        this.httpService.post(this.VALIDATE_SERVICE_URL, { token }),
      );
      request.user = response.data;
      return isActivated;
    } catch (error) {
      isActivated = false;
    }
    console.log('isActivated:: ->', isActivated);
    return isActivated;
  }

  private extractTokenFromHeader(request: any): string | null {
    const authHeader = request.headers['authorization'];
    if (!authHeader) return null;
    return authHeader.split(' ')[1]; // Extract token from 'Bearer <token>'
  }
}
