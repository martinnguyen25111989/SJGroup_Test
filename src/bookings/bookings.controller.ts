import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { QueryBookingsDto } from './dto/query-bookings.dto';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly service: BookingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a booking; runs the three validation rules' })
  @ApiResponse({
    status: 201,
    description: 'Booking created with status CONFIRMED (all rules passed).',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Booking violates one or more rules; nothing is persisted. Body contains `failures[]`.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'Room not found' })
  create(@Body() dto: CreateBookingDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List bookings (optionally filter by room, date, status)' })
  findAll(@Query() query: QueryBookingsDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve one booking by id' })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }
}
