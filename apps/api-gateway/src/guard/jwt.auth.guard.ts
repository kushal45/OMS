import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private httpService: HttpService,
  ) {}
   // Define a list of public (blacklisted) routes
   private readonly publicRoutes: Array<{ method: string; path: string }> = [
    { method: 'POST', path: '/auth/login' },
    { method: 'POST', path: '/auth/register' },
  ];

  async canActivate(context: ExecutionContext): Promise<boolean> {
    console.log("canActivate guard called");
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    const { method, path } = request;
    console.log("path is", path);
     const isPublic = this.publicRoutes.some(
      (route) => route.method === method && path.endsWith(route.path),
    );

    if (isPublic) {
      // Bypass JWT validation for public routes
      return true;
    }
    console.log('Token:', token);
    

    try {

      if (!token) {
        throw new UnauthorizedException('Token not found');
      }
      // Send token to Auth Service for validation
      const response = await firstValueFrom(
        this.httpService.post('http://auth/auth/validate-token', { token })
      );

      // Attach user data to the request object if the token is valid
      request.user = response.data;
      return true;
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