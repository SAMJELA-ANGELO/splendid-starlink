import { IsNotEmpty, IsString, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SilentLoginDto {
  @ApiProperty({
    description: 'Username for hotspot login',
    example: 'john_doe',
  })
  @IsNotEmpty()
  @IsString()
  username: string;

  @ApiProperty({
    description: 'Password for hotspot login',
    example: 'password123',
  })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty({
    description: 'MAC address of the client device',
    example: 'AA:BB:CC:DD:EE:FF',
  })
  @IsNotEmpty()
  @IsString()
  macAddress: string;

  @ApiProperty({
    description: 'IP address of the client device',
    example: '192.168.1.100',
  })
  @IsNotEmpty()
  @IsString()
  ipAddress: string;

  @ApiProperty({
    description: 'Duration of the session in hours',
    example: 24,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  durationHours: number;
}
