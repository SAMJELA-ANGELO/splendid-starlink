import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional } from 'class-validator';

export class SignupDto {
  @ApiProperty({ example: 'john_doe', description: 'Username' })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({ example: 'password123', description: 'Password' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'AA:BB:CC:DD:EE:FF', description: 'Device MAC address (from WiFi redirect)', required: false })
  @IsOptional()
  @IsString()
  macAddress?: string;

  @ApiProperty({ example: 'Home', description: 'Router identity (from WiFi redirect)', required: false })
  @IsOptional()
  @IsString()
  routerIdentity?: string;
}
