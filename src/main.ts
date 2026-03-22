import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as cors from 'cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend integration
  app.enableCors({
    origin: [
      'http://localhost:3000', // Next.js default dev port
      'http://localhost:3001', // Alternative dev port
      'http://localhost:3002', // Another common dev port
      'https://splendid-starlink.onrender.com', // Deployed frontend on Render
      'https://splendidstarlink.netlify.app', // Deployed frontend on Netlify
      'https://splendidstarlink.org', // Custom domain
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });

  // Security middleware
  app.use(helmet());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Rate limiting is handled by decorators on specific endpoints
  // No global guard needed - using @Throttle decorators on controllers

  // Set global prefix for all routes first
  app.setGlobalPrefix('api');

  // Setup Swagger with global prefix consideration
  const config = new DocumentBuilder()
    .setTitle('Starlink Wi-Fi Hotspot API')
    .setDescription(
      'API for managing paid Wi-Fi hotspot with MikroTik and Fapshi payments',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'JWT',
    )
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Users', 'User management endpoints')
    .addTag('Plans', 'Internet bundle plans')
    .addTag('Payments', 'Payment processing endpoints')
    .addTag('Sessions', 'Session management endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch(console.error);
