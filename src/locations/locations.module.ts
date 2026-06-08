import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location } from './location.entity';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { OpenTime } from './open-time.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Location, OpenTime])],
  controllers: [LocationsController],
  providers: [LocationsService],
  exports: [LocationsService, TypeOrmModule],
})
export class LocationsModule {}
