import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  logger.log('✅ Application initialized');

  // Enable CORS for frontend integration
  app.enableCors({
    origin: [
      'http://localhost:3000', // Next.js default dev port
      'http://localhost:3001', // Alternative dev port
      'http://localhost:3002', // Another common dev port
      'https://splendid-starlink-frontend.onrender.com', // If you deploy frontend to Render
      'https://splendid-starlink.vercel.app', // If you deploy to Vercel
      'https://splendid-starlink.netlify.app', // If you deploy to Netlify
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });
  logger.log('✅ CORS enabled for frontend origins');

  // Setup Swagger
  const config = new DocumentBuilder()
    .setTitle('Starlink Wi-Fi Hotspot Management API')
    .setDescription(
      'Complete API for managing paid Wi-Fi hotspot access with MikroTik integration and Fapshi payment processing. Users can sign up, purchase data bundles, and get activated on the MikroTik hotspot automatically.',
    )
    .setVersion('1.0.0')
    .setContact(
      'Splendid Starlink',
      'https://github.com/SAMJELA-ANGELO/splendid-starlink',
      'support@splendidstarlink.com',
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT access token',
      },
      'JWT',
    )
    .addTag('Auth', 'User authentication with JWT (signup & login)')
    .addTag('Users', 'User management and profile operations')
    .addTag('Plans', 'Internet bundle plans (CRUD operations)')
    .addTag('Payments', 'Payment processing via Fapshi gateway')
    .addTag('MikroTik', 'MikroTik hotspot user management (admin only)')
    .addTag('Sessions', 'User session tracking and management')
    .addTag('Health', 'API health and dependency status checks')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  logger.log('✅ Swagger documentation available at /docs');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`🚀 Server running on http://localhost:${port}`);
  logger.log(`📚 API Documentation: http://localhost:${port}/docs`);
}

bootstrap().catch(console.error);
