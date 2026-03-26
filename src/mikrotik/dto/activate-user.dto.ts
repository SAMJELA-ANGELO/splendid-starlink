import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class ActivateUserDto {
  @ApiProperty({
    description: 'Username of the user to activate',
    example: 'john_doe',
  })
  @IsString()
  username: string;

  @ApiProperty({
    description: 'Duration in hours for the activation',
    example: 24,
    minimum: 1,
    maximum: 720,
  })
  @IsNumber()
  @Min(1)
  @Max(720)
  durationHours: number;

  @ApiProperty({
    description: 'Optional password for the user (uses username if not provided)',
    example: 'password123',
    required: false,
  })
  @IsOptional()
  @IsString()
  password?: string;
}

export class DeactivateUserDto {
  @ApiProperty({
    description: 'Username of the user to deactivate',
    example: 'john_doe',
  })
  @IsString()
  username: string;
}
