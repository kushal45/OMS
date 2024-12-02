import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtAuthGuard } from '../guard/jwt.auth.guard';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly jwtAuthGuard: JwtAuthGuard) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const canActivate = await this.jwtAuthGuard.canActivate({
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as any);

    if (!canActivate) {
      res.status(401).json({ message: 'Unauthorized Token' });
      return;
    }
    console.log("request user from authMiddleWare:: ->",(req as any ).user);
    next();
  }
}