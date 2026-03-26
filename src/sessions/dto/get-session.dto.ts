import { ApiProperty } from '@nestjs/swagger';

export class GetSessionResponseDto {
  @ApiProperty({
    description: 'Unique session identifier (same as user ID)',
    example: '507f1f77bcf86cd799439011',
  })
  id: string;

  @ApiProperty({
    description: 'User ID associated with this session',
    example: '507f1f77bcf86cd799439011',
  })
  userId: string;

  @ApiProperty({
    description: 'Session start timestamp',
    example: '2026-03-27T10:30:00Z',
    type: 'string',
    format: 'date-time',
  })
  startTime: Date;

  @ApiProperty({
    description: 'Session end timestamp (if session is closed)',
    example: null,
    nullable: true,
    type: 'string',
    format: 'date-time',
  })
  endTime?: Date;

  @ApiProperty({
    description: 'Data consumed during the session in bytes',
    example: 1024000000,
    type: 'number',
  })
  dataUsed: number;

  @ApiProperty({
    description: 'Whether the session is currently active',
    example: true,
    type: 'boolean',
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Remaining time in the session (in milliseconds)',
    example: 3600000,
    type: 'number',
  })
  remainingTime: number;
}
