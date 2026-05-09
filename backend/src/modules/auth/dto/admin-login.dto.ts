import { IsString, Length } from 'class-validator';

export class AdminLoginDto {
  @IsString()
  @Length(4, 32)
  pin: string;
}
