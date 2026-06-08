import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Department } from '../../common/enums/department.enum';
import { LocationType } from '../../common/enums/location-type.enum';
import { OpenTimeDto } from './open-time.dto';

export class CreateLocationDto {
  @ApiProperty({ example: 'Meeting Room 1' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'A-01-01' })
  @IsString()
  locationNumber: string;

  @ApiProperty({ example: 'A' })
  @IsString()
  building: string;

  @ApiProperty({ enum: LocationType })
  @IsEnum(LocationType)
  type: LocationType;

  @ApiPropertyOptional({ description: 'Parent location id; omit for root nodes' })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional({ enum: Department })
  @IsOptional()
  @IsEnum(Department)
  department?: Department | null;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number | null;

  @ApiPropertyOptional({ type: OpenTimeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OpenTimeDto)
  openTime?: OpenTimeDto | null;
}
