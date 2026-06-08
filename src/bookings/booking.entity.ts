import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { Department } from '../common/enums/department.enum';
import { Location } from '../locations/location.entity';

@Entity({ name: 'bookings' })
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  locationId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column({ type: 'enum', enum: Department })
  department: Department;

  @Column({ type: 'int' })
  attendees: number;

  @Column({ type: 'date' })
  bookingDate: string;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  @Column({ type: 'enum', enum: BookingStatus })
  status: BookingStatus;

  @CreateDateColumn()
  createdAt: Date;
}
