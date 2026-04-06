import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, Min } from 'class-validator';

export class SilentLoginDto {
  @ApiProperty({
    description: 'Username for hotspot login',
    example: 'user123',
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
    description: 'MAC address of the device',
    example: '02:38:9A:45:67:89',
  })
  @IsNotEmpty()
  @IsString()
  macAddress: string;

  @ApiProperty({
    description: 'IP address of the device',
    example: '192.168.1.100',
  })
  @IsNotEmpty()
  @IsString()
  ipAddress: string;

  @ApiProperty({
    description: 'Duration in hours for the session',
    example: 24,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  durationHours: number;
}