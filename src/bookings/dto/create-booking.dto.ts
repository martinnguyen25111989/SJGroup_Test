import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsMilitaryTime,
  IsUUID,
  Min,
} from 'class-validator';
import { Department } from '../../common/enums/department.enum';

export class CreateBookingDto {
  @ApiProperty({ description: 'UUID of the room being booked' })
  @IsUUID()
  locationId: string;

  @ApiProperty({ enum: Department })
  @IsEnum(Department)
  department: Department;

  @ApiProperty({ example: 6 })
  @IsInt()
  @Min(1)
  attendees: number;

  @ApiProperty({ example: '2026-06-10', description: 'ISO date (YYYY-MM-DD)' })
  @IsDateString()
  bookingDate: string;

  @ApiProperty({ example: '09:00' })
  @IsMilitaryTime()
  startTime: string;

  @ApiProperty({ example: '10:30' })
  @IsMilitaryTime()
  endTime: string;
}
