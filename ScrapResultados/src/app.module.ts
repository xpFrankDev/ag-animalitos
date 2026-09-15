import 'dotenv/config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CapturaModule } from './captura/captura.module';
import { entidades } from './base-datos/entidades';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 3306),
      username: process.env.DB_USUARIO,
      password: process.env.DB_CONTRASENA,
      database: process.env.DB_NOMBRE,
      entities: entidades,
      synchronize: false,
    }),
    CapturaModule,
  ],
})
export class AppModule {}
