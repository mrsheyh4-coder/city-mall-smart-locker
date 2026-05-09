import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
  VERSION_NEUTRAL,
  Version,
} from '@nestjs/common';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import {
  CctvEventDto,
  OneCTariffImportDto,
  PaymentWebhookDto,
  SmsTestDto,
} from './dto/integration.dto';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
@UseGuards(RateLimitGuard)
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get('status')
  @Version(VERSION_NEUTRAL)
  status() {
    return this.integrations.getStatus();
  }

  @Post('payment/webhook')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ points: 60, windowMs: 60_000 })
  paymentWebhook(@Body() dto: PaymentWebhookDto) {
    return this.integrations.handlePaymentWebhook(
      dto.provider,
      dto.payload,
      dto.signature,
    );
  }

  @Post('sms/test')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ points: 10, windowMs: 60_000 })
  testSms(@Body() dto: SmsTestDto) {
    return this.integrations.sendSms(dto.phone, dto.message);
  }

  @Get('1c/export')
  oneCExport(@Query('from') from?: string, @Query('to') to?: string) {
    return this.integrations.exportOneCReport(from, to);
  }

  @Post('1c/tariffs/import')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ points: 20, windowMs: 60_000 })
  oneCTariffImport(@Body() dto: OneCTariffImportDto) {
    return this.integrations.importOneCTariffs(dto.tariffs);
  }

  @Post('cctv/event')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ points: 60, windowMs: 60_000 })
  cctvEvent(@Body() dto: CctvEventDto) {
    return this.integrations.registerCctvEvent(
      dto.lockerId,
      dto.event,
      dto.cameraId,
    );
  }
}
