import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function iniciarAplicacion(): Promise<void> {
  const aplicacion = await NestFactory.create(AppModule);
  aplicacion.setGlobalPrefix('api');
  aplicacion.enableCors({ origin: process.env.CORS_ORIGEN?.split(',') ?? 'http://localhost:5173' });
  aplicacion.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const configuracionSwagger = new DocumentBuilder()
    .setTitle('AG API')
    .setDescription('API para venta y administración de animalitos')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const documento = SwaggerModule.createDocument(aplicacion, configuracionSwagger);
  SwaggerModule.setup('api/documentacion', aplicacion, documento);

  await aplicacion.listen(Number(process.env.PUERTO ?? 3000));
}

void iniciarAplicacion();
