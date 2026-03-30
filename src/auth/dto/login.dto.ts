import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional, IsBoolean } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'john_doe', description: 'Username' })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({ example: 'password123', description: 'Password' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: false, description: 'Whether login is from WiFi captive portal', required: false })
  @IsOptional()
  @IsBoolean()
  fromWifi?: boolean;

  @ApiProperty({ example: 'AA:BB:CC:DD:EE:FF', description: 'Device MAC address if from WiFi', required: false })
  @IsOptional()
  @IsString()
  macAddress?: string;
}
