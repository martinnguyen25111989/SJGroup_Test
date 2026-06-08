import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'open_times' })
export class OpenTime {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', nullable: true })
  startDay: number | null;

  @Column({ type: 'int', nullable: true })
  endDay: number | null;

  @Column({ type: 'time', nullable: true })
  startTime: string | null;

  @Column({ type: 'time', nullable: true })
  endTime: string | null;

  @Column({ type: 'boolean', default: false })
  isAlwaysOpen: boolean;
}
