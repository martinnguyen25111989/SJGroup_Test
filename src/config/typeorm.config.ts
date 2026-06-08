import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const typeOrmConfig = (config: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: config.get<string>('DB_HOST', 'localhost'),
  port: config.get<number>('DB_PORT', 5434),
  username: config.get<string>('DB_USERNAME', 'postgre_sj'),
  password: config.get<string>('DB_PASSWORD', 'postgre_sj_123'),
  database: config.get<string>('DB_NAME', 'sj_assignment'),
  autoLoadEntities: true,
  synchronize: config.get<string>('DB_SYNCHRONIZE') === 'true',
  logging: config.get<string>('DB_LOGGING') === 'true',
});
