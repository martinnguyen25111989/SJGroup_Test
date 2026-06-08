import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Department } from '../common/enums/department.enum';
import { LocationType } from '../common/enums/location-type.enum';
import { OpenTime } from './open-time.entity';

@Entity({ name: 'locations' })
export class Location {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  locationNumber: string;

  @Column({ type: 'varchar' })
  building: string;

  @Column({ type: 'enum', enum: LocationType })
  type: LocationType;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @ManyToOne(() => Location, (location) => location.children, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parentId' })
  parent: Location | null;

  @OneToMany(() => Location, (location) => location.parent)
  children: Location[];

  @Column({ type: 'enum', enum: Department, nullable: true })
  department: Department | null;

  @Column({ type: 'int', nullable: true })
  capacity: number | null;

  @Column({ type: 'uuid', nullable: true })
  openTimeId: string | null;

  @OneToOne(() => OpenTime, { nullable: true, cascade: true, eager: true })
  @JoinColumn({ name: 'openTimeId' })
  openTime: OpenTime | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
