import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from './auth/user.entity';
import { Booking } from './bookings/booking.entity';
import { Location } from './locations/location.entity';
import { OpenTime } from './locations/open-time.entity';

loadEnv();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5434),
  username: process.env.DB_USERNAME ?? 'postgre_sj',
  password: process.env.DB_PASSWORD ?? 'postgre_sj_123',
  database: process.env.DB_NAME ?? 'sj_assignment',
  entities: [Location, OpenTime, Booking, User],
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  logging: process.env.DB_LOGGING === 'true',
});
