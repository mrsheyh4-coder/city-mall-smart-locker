import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AuthService } from './auth.service';

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ points: 5, windowMs: 60_000 })
  login(@Body() dto: AdminLoginDto) {
    if (!this.auth.validateAdminPin(dto.pin)) {
      throw new UnauthorizedException('Invalid admin PIN');
    }

    return {
      token: this.auth.issueAdminToken(),
      user: {
        name: 'City Mall Admin',
        role: 'ADMIN',
      },
    };
  }
}
