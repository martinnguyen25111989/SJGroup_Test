import { PartialType, PickType } from '@nestjs/swagger';
import { CreateLocationDto } from './create-location.dto';

export class UpdateLocationDto extends PartialType(
  PickType(CreateLocationDto, ['name', 'department', 'capacity', 'openTime'] as const),
) {}
