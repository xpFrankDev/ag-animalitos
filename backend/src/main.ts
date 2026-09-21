import { ValidationPipe } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

/**
 * La documentación de la API solo se publica cuando se habilita explícitamente.
 * En producción queda cerrada por defecto, porque describe toda la superficie interna.
 */
function swaggerHabilitado(): boolean {
  const configurado = process.env.SWAGGER_HABILITADO;
  if (configurado !== undefined) return configurado === 'true';
  return process.env.NODE_ENV !== 'production';
}

async function iniciarAplicacion(): Promise<void> {
  const aplicacion = await NestFactory.create(AppModule);
  aplicacion.setGlobalPrefix('api');
  // Detrás de Nginx la IP real del cliente llega en x-forwarded-for.
  const servidorHttp = aplicacion.getHttpAdapter().getInstance() as { set: (clave: string, valor: unknown) => void };
  servidorHttp.set('trust proxy', 1);
  aplicacion.enableCors({ origin: process.env.CORS_ORIGEN?.split(',') ?? 'http://localhost:5173' });
  aplicacion.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  if (swaggerHabilitado()) {
    const configuracionSwagger = new DocumentBuilder()
      .setTitle('AG API')
      .setDescription('API para venta y administración de animalitos')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const documento = SwaggerModule.createDocument(aplicacion, configuracionSwagger);
    SwaggerModule.setup('api/documentacion', aplicacion, documento);
    Logger.log('Documentación Swagger disponible en /api/documentacion.', 'Inicio');
  }

  await aplicacion.listen(Number(process.env.PUERTO ?? 3000));
}

void iniciarAplicacion();
