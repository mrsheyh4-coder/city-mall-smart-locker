import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LockerSize } from '@prisma/client';

export class PaymentWebhookDto {
  @IsIn(['PAYME', 'CLICK'])
  provider: 'PAYME' | 'CLICK';

  @IsObject()
  payload: Record<string, unknown>;

  @IsString()
  @IsOptional()
  signature?: string;
}

export class SmsTestDto {
  @IsString()
  phone: string;

  @IsString()
  message: string;
}

export class CctvEventDto {
  @IsString()
  lockerId: string;

  @IsString()
  event: string;

  @IsString()
  @IsOptional()
  cameraId?: string;
}

export class OneCTariffDto {
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

export class OneCTariffImportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OneCTariffDto)
  tariffs: OneCTariffDto[];
}
