import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function iniciarAplicacion(): Promise<void> {
  const aplicacion = await NestFactory.create(AppModule);
  aplicacion.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const puerto = Number(process.env.PUERTO ?? 3010);
  await aplicacion.listen(puerto);
  Logger.log(`Servicio de resultados escuchando en ${puerto}.`, 'Inicio');
}

void iniciarAplicacion();
