import 'dotenv/config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgenciaModule } from './agencia/agencia.module';
import { AutenticacionModule } from './autenticacion/autenticacion.module';
import { CalificacionModule } from './calificacion/calificacion.module';
import { OperacionModule } from './operacion/operacion.module';
import { SaludModule } from './salud/salud.module';
import { entidades } from './base-datos/entidades';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 3306),
      username: process.env.DB_APLICACION_USUARIO,
      password: process.env.DB_APLICACION_CONTRASENA,
      database: process.env.DB_NOMBRE,
      entities: entidades,
      synchronize: false,
    }),
    AutenticacionModule,
    AgenciaModule,
    OperacionModule,
    CalificacionModule,
    SaludModule,
  ],
})
export class AppModule {}
