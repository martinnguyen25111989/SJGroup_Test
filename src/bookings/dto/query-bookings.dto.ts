import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryBookingsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by room id' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ example: '2026-06-10' })
  @IsOptional()
  @IsDateString()
  bookingDate?: string;

  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}
