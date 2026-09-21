import 'dotenv/config';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agencia, ControlAcceso, Usuario } from '../base-datos/entidades';
import { AutenticacionController } from './autenticacion.controller';
import { AutenticacionService } from './autenticacion.service';
import { ControlAccesoService } from './control-acceso.service';
import { GuardiaJwt } from './guardias/guardia-jwt';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Agencia, ControlAcceso]), JwtModule.register({ global: true, secret: process.env.JWT_SECRETO, signOptions: { expiresIn: '10m' } })],
  controllers: [AutenticacionController],
  providers: [AutenticacionService, ControlAccesoService, GuardiaJwt],
  exports: [AutenticacionService, ControlAccesoService, GuardiaJwt],
})
export class AutenticacionModule {}
