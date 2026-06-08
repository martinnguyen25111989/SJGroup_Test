import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationsService } from './locations.service';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly service: LocationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a location node' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiConflictResponse({ description: 'locationNumber already exists' })
  @ApiUnprocessableEntityResponse({ description: 'Invalid parent or root rule violated' })
  create(@Body() dto: CreateLocationDto) {
    return this.service.create(dto);
  }

  @Get('tree')
  @ApiOperation({ summary: 'Retrieve the full location tree' })
  findTree() {
    return this.service.findTree();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve one location by id' })
  @ApiNotFoundResponse({ description: 'Location not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update name, department, capacity, or open time' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'Location not found' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLocationDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a node (pass cascade=true to remove children)' })
  @ApiQuery({ name: 'cascade', required: false, type: Boolean })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiConflictResponse({ description: 'Location has children and cascade is false' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('cascade', new ParseBoolPipe({ optional: true })) cascade?: boolean,
  ) {
    await this.service.remove(id, cascade ?? false);
  }
}
