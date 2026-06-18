import { Injectable, Logger } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';

/**
 * Records rejected booking attempts to an audit channel that is fully
 * decoupled from the transactional `bookings` table. It currently emits a
 * structured log line; swap the body of `recordRejection` to forward to a
 * dedicated table, Kafka topic or analytics store without touching the
 * request hot path.
 */
@Injectable()
export class BookingAuditLogger {
  private readonly logger = new Logger('BookingAudit');

  recordRejection(
    dto: CreateBookingDto,
    failures: { rule: string; reason: string }[],
  ): void {
    this.logger.warn(
      JSON.stringify({
        event: 'booking_rejected',
        locationId: dto.locationId,
        department: dto.department,
        attendees: dto.attendees,
        bookingDate: dto.bookingDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        failures,
        at: new Date().toISOString(),
      }),
    );
  }
}
