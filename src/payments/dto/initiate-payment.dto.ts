import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, Matches } from 'class-validator';

export class InitiatePaymentDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'Plan ID' })
  @IsString()
  planId: string;

  @ApiProperty({
    example: '237691234567',
    description: 'User phone number (required for direct payment)',
  })
  @IsString()
  @Matches(/^6[\d]{8}$/, { message: 'Phone must be valid Cameroon format: 6XXXXXXXX' })
  phone: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'User email (optional)',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: 'EXT-12345',
    description: 'External ID reference (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Customer name (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;
}
