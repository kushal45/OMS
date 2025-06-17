import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt'; // Import JwtService
import { ConfigService } from '@nestjs/config'; // Import ConfigService

@Injectable()
export class JwtAuthGuard implements CanActivate {
  // Define a list of public routes
  private readonly publicRoutes: Array<{ method: string; pathRegex: RegExp }> = [
    { method: 'POST', pathRegex: /\/auth\/login$/ },
    { method: 'POST', pathRegex: /\/auth\/register$/ },
    // Keep validate-token public if it's used by other internal services directly,
    // otherwise, it might not need to be public if gateway handles all auth.
    // For now, keeping it as per original logic.
    { method: 'POST', pathRegex: /\/auth\/validate-token$/ },
  ];

  constructor(
    private jwtService: JwtService,
    @Inject(ConfigService) private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { method, path } = request;

    const isPublic = this.publicRoutes.some(
      (route) => route.method === method && route.pathRegex.test(path),
    );

    if (isPublic) {
      return true; // Bypass JWT validation for public routes
    }

    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      console.log("Payload from JWT verification:", payload);
      request.user = payload; // Attach payload to request object
      return true;
    } catch (error) {
      // Log the error for debugging if needed
      // this.logger.error('Token validation error:', error.message);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractTokenFromHeader(request: any): string | null {
    const authHeader = request.headers['authorization'];
    if (!authHeader) return null;
    return authHeader.split(' ')[1]; // Extract token from 'Bearer <token>'
  }
}
