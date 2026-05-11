import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { AdminGuard } from '../../common/guards/admin.guard';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import {
  AccessCodeParamDto,
  BookingParamDto,
  BookingQueryDto,
  CreateBookingDto,
  DemoPaymentDto,
  ExtendBookingDto,
  LockerActionDto,
  LockerParamDto,
  LockerStatusQueryDto,
  MockPaymentDto,
  RequestSmsAuthDto,
  ReportQueryDto,
  TariffParamDto,
  UpsertTariffDto,
  VerifyAccessDto,
  VerifySmsAuthDto,
} from './dto/locker-action.dto';
import { LockersService } from './lockers.service';

@Controller()
@UseGuards(RateLimitGuard)
export class LockersController {
  constructor(private readonly lockersService: LockersService) {}

  @Get('lockers')
  findAll() {
    return this.lockersService.findAll();
  }

  @Get('locker/status')
  status(@Query() dto: LockerStatusQueryDto) {
    return this.lockersService.getStatus(dto.size);
  }

  @Get('tariffs')
  tariffs() {
    return this.lockersService.findPublicTariffs();
  }

  @Get('lockers/:id')
  findOne(@Param() dto: LockerParamDto) {
    return this.lockersService.findOne(dto.id);
  }

  @Post('locker/open')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  open(@Body() dto: LockerActionDto) {
    return this.lockersService.open(dto.lockerId);
  }

  @Post('locker/close')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  close(@Body() dto: LockerActionDto) {
    return this.lockersService.close(dto.lockerId);
  }

  @Post('locker/release')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  release(@Body() dto: LockerActionDto) {
    return this.lockersService.release(dto.lockerId);
  }

  @Post('locker/expire')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  expire(@Body() dto: LockerActionDto) {
    return this.lockersService.expire(dto.lockerId);
  }

  @Post('locker/maintenance')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  maintenance(@Body() dto: LockerActionDto) {
    return this.lockersService.setMaintenance(dto.lockerId);
  }

  @Post('locker/demo-payment')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ points: 10, windowMs: 60_000 })
  @UseGuards(AdminGuard)
  activateDemoPayment(@Body() dto: DemoPaymentDto) {
    return this.lockersService.activateDemoPayment(
      dto.lockerId,
      dto.durationMinutes ?? 120,
    );
  }

  @Post('booking/create')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ points: 10, windowMs: 60_000 })
  createBooking(@Body() dto: CreateBookingDto) {
    return this.lockersService.createBooking(dto);
  }

  @Post('sms/auth/request')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ points: 3, windowMs: 60_000 })
  requestSmsAuth(@Body() dto: RequestSmsAuthDto) {
    return this.lockersService.requestSmsAuth(dto.phone, dto.language);
  }

  @Post('sms/auth/verify')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ points: 6, windowMs: 60_000 })
  verifySmsAuth(@Body() dto: VerifySmsAuthDto) {
    return this.lockersService.verifySmsAuth(dto.phone, dto.code);
  }

  @Post('payment/mock')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ points: 10, windowMs: 60_000 })
  mockPayment(@Body() dto: MockPaymentDto) {
    return this.lockersService.mockPayment(dto.bookingId);
  }

  @Post('access/verify')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ points: 6, windowMs: 60_000 })
  verifyAccess(@Body() dto: VerifyAccessDto) {
    return this.lockersService.verifyAccess(
      dto.lockerId,
      dto.credential,
      dto.accessAction ?? 'OPEN',
    );
  }

  @Get('admin/statistics')
  @UseGuards(AdminGuard)
  adminStatistics() {
    return this.lockersService.adminStatistics();
  }

  @Get('admin/bookings')
  @UseGuards(AdminGuard)
  adminBookings(@Query() dto: BookingQueryDto) {
    return this.lockersService.findAdminBookings(dto);
  }

  @Post('admin/bookings/:id/complete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  completeBooking(@Param() dto: BookingParamDto) {
    return this.lockersService.completeBooking(dto.id);
  }

  @Post('admin/bookings/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  cancelBooking(@Param() dto: BookingParamDto) {
    return this.lockersService.cancelBooking(dto.id);
  }

  @Post('admin/bookings/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  reactivateBooking(@Param() dto: BookingParamDto) {
    return this.lockersService.reactivateBooking(dto.id);
  }

  @Post('admin/bookings/:id/extend')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  extendBooking(
    @Param() params: BookingParamDto,
    @Body() dto: ExtendBookingDto,
  ) {
    return this.lockersService.extendBooking(params.id, dto.durationMinutes);
  }

  @Post('admin/tariffs')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  createTariff(@Body() dto: UpsertTariffDto) {
    return this.lockersService.createTariff(dto);
  }

  @Put('admin/tariffs/:id')
  @UseGuards(AdminGuard)
  updateTariff(@Param() params: TariffParamDto, @Body() dto: UpsertTariffDto) {
    return this.lockersService.updateTariff(params.id, dto);
  }

  @Delete('admin/tariffs/:id')
  @UseGuards(AdminGuard)
  deleteTariff(@Param() params: TariffParamDto) {
    return this.lockersService.deleteTariff(params.id);
  }

  @Post('admin/access-codes/:id/revoke')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  revokeAccessCode(@Param() params: AccessCodeParamDto) {
    return this.lockersService.revokeAccessCode(params.id);
  }

  @Post('admin/access-codes/:id/regenerate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  regenerateAccessCode(@Param() params: AccessCodeParamDto) {
    return this.lockersService.regenerateAccessCode(params.id);
  }

  @Get('admin/reports')
  @UseGuards(AdminGuard)
  adminReport(@Query() dto: ReportQueryDto) {
    return this.lockersService.buildReport(dto);
  }

  @Post('demo/reset')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  resetDemo() {
    return this.lockersService.resetDemo();
  }
}
