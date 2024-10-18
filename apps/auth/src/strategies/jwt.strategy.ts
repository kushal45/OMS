import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),  // Extract token from the Authorization header
      ignoreExpiration: false,  // Token expiration will be handled
      secretOrKey: process.env.JWT_SECRET,  // Use an environment variable in production
    });
  }

  async validate(payload: any) {
    // Here, you can add any custom validation logic or fetch user info from the database if necessary
    return { userId: payload.sub, email: payload.email };  // Payload typically contains email and userId
  }
}