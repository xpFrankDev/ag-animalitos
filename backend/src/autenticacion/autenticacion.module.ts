import 'dotenv/config';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agencia, Usuario } from '../base-datos/entidades';
import { AutenticacionController } from './autenticacion.controller';
import { AutenticacionService } from './autenticacion.service';
import { GuardiaJwt } from './guardia-jwt';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Agencia]), JwtModule.register({ global: true, secret: process.env.JWT_SECRETO, signOptions: { expiresIn: '10m' } })],
  controllers: [AutenticacionController],
  providers: [AutenticacionService, GuardiaJwt],
  exports: [AutenticacionService, GuardiaJwt],
})
export class AutenticacionModule {}
