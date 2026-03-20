import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  // Setup Swagger
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
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch(console.error);
