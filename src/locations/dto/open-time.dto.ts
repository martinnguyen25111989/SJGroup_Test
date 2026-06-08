import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsMilitaryTime,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class OpenTimeDto {
  @ApiPropertyOptional({ description: 'Day of week 0-6 (Sun=0, Mon=1, ...)', example: 1 })
  @ValidateIf((o: OpenTimeDto) => !o.isAlwaysOpen)
  @IsInt()
  @Min(0)
  @Max(6)
  startDay?: number;

  @ApiPropertyOptional({ example: 5 })
  @ValidateIf((o: OpenTimeDto) => !o.isAlwaysOpen)
  @IsInt()
  @Min(0)
  @Max(6)
  endDay?: number;

  @ApiPropertyOptional({ example: '09:00' })
  @ValidateIf((o: OpenTimeDto) => !o.isAlwaysOpen)
  @IsMilitaryTime()
  startTime?: string;

  @ApiPropertyOptional({ example: '18:00' })
  @ValidateIf((o: OpenTimeDto) => !o.isAlwaysOpen)
  @IsMilitaryTime()
  endTime?: string;

  @ApiProperty({ default: false })
  @IsOptional()
  @IsBoolean()
  isAlwaysOpen?: boolean = false;
}
