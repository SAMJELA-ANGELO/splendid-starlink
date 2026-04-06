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
  @Matches(/^6[\d]{8}$/, {
    message: 'Phone number must be a valid Cameroon mobile number starting with 6 (e.g., 691234567)',
  })
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

  @ApiProperty({
    example: 'AA:BB:CC:DD:EE:FF',
    description: 'Device MAC address (optional, from WiFi redirect)',
    required: false,
  })
  @IsOptional()
  @IsString()
  macAddress?: string;

  @ApiProperty({
    example: 'Douala-Main-Router',
    description: 'Router identity (optional, from WiFi redirect)',
    required: false,
  })
  @IsOptional()
  @IsString()
  routerIdentity?: string;

  @ApiProperty({
    example: false,
    description: 'Is this a gift purchase (buying for someone else)?',
    required: false,
  })
  @IsOptional()
  isGift?: boolean;

  @ApiProperty({
    example: 'john_doe',
    description: 'Recipient username (required if isGift=true)',
    required: false,
  })
  @IsOptional()
  @IsString()
  recipientUsername?: string;

  @ApiProperty({
    example: '192.168.88.20',
    description:
      'User local IP address on WiFi network (optional, for silent login)',
    required: false,
  })
  @IsOptional()
  @IsString()
  userIp?: string;

  @ApiProperty({
    example: 'myPassword123',
    description:
      'User plain password from localStorage (optional, for silent login)',
    required: false,
  })
  @IsOptional()
  @IsString()
  password?: string;
}
