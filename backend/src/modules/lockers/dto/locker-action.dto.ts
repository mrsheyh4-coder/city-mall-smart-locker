import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsPhoneNumber,
  IsPositive,
  IsString,
  IsBoolean,
  Length,
  Max,
  Min,
} from 'class-validator';
import { BookingStatus, LockerSize } from '@prisma/client';

export class LockerActionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lockerId: number;
}

export class LockerParamDto {
  @IsString()
  id: string;
}

export class DemoPaymentDto extends LockerActionDto {
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(1440)
  @IsOptional()
  durationMinutes?: number = 120;
}

export class LockerStatusQueryDto {
  @IsEnum(LockerSize)
  @IsOptional()
  size?: LockerSize;
}

export class CreateBookingDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lockerId: number;

  @IsEnum(LockerSize)
  lockerSize: LockerSize;

  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(1440)
  durationMinutes: number;

  @IsPhoneNumber()
  phone: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsBoolean()
  termsAccepted: boolean;

  @IsString()
  @IsOptional()
  smsVerificationToken?: string;
}

export class RequestSmsAuthDto {
  @IsPhoneNumber()
  phone: string;
}

export class VerifySmsAuthDto {
  @IsPhoneNumber()
  phone: string;

  @IsString()
  @Length(4, 64)
  code: string;
}

export class MockPaymentDto {
  @IsString()
  bookingId: string;
}

export class VerifyAccessDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lockerId: number;

  @IsString()
  @Length(4, 512)
  credential: string;
}

export class UpsertTariffDto {
  @IsString()
  name: string;

  @IsEnum(LockerSize)
  lockerSize: LockerSize;

  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(1440)
  durationMinutes: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  price: number;

  @IsString()
  @IsOptional()
  currency?: string = 'UZS';

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

export class TariffParamDto {
  @IsString()
  id: string;
}

export class BookingParamDto {
  @IsString()
  id: string;
}

export class ExtendBookingDto {
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(1440)
  durationMinutes: number;
}

export class BookingQueryDto {
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  @IsString()
  @IsOptional()
  search?: string;

  @IsISO8601()
  @IsOptional()
  from?: string;

  @IsISO8601()
  @IsOptional()
  to?: string;
}

export class AccessCodeParamDto {
  @IsString()
  id: string;
}

export class ReportQueryDto {
  @IsISO8601()
  @IsOptional()
  from?: string;

  @IsISO8601()
  @IsOptional()
  to?: string;
}
