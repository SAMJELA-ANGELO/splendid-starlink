import { ApiProperty } from '@nestjs/swagger';

export class GetSessionStatusResponseDto {
  @ApiProperty({
    description: 'Whether the session is currently active',
    example: true,
    type: 'boolean',
  })
  isActive: boolean;

  @ApiProperty({
    description:
      'Remaining time in the session (in milliseconds). Only present if session is active.',
    example: 3600000,
    type: 'number',
    nullable: true,
  })
  remainingTime?: number;
}
