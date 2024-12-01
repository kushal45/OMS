import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private VALIDATE_SERVICE_URL = 'http://auth:3001/auth/validate-token';
  constructor(
    private httpService: HttpService,
  ) {
    
  }
   // Define a list of public (blacklisted) routes
   private readonly publicRoutes: Array<{ method: string; path: string }> = [
    { method: 'POST', path: '/auth/login' },
    { method: 'POST', path: '/auth/register' },
    { method: 'POST', path: '/auth/validate-token' },
  ];

  async canActivate(context: ExecutionContext): Promise<boolean> {
    console.log("canActivate guard called");
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    const { method, path } = request;
    let isActivated = false;
    console.log("path is", path);
     const isPublic = this.publicRoutes.some(
      (route) => route.method === method && path.endsWith(route.path),
    );

    if (isPublic) {
      // Bypass JWT validation for public routes
      return true;
    }
    

    try {
      if (!token) {
        throw new UnauthorizedException('Token not found');
      }

      try {
          // Send token to Auth Service for validation
      const response = await firstValueFrom(
        this.httpService.post(this.VALIDATE_SERVICE_URL, { token })
      );

      console.log("Response from validate service is:: ->",response.data);
      request.user = response.data;
      } catch (error) {
        console.log("Error is:: ->",error);
        isActivated = false;
      }
    
      isActivated = true;
      return isActivated;
    } catch (error) {
      //throw new UnauthorizedException('Invalid token');
    }
  }

  private extractTokenFromHeader(request: any): string | null {
    const authHeader = request.headers['authorization'];
    if (!authHeader) return null;
    return authHeader.split(' ')[1]; // Extract token from 'Bearer <token>'
  }
}