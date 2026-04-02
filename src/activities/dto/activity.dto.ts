import { ApiProperty } from '@nestjs/swagger';

export class ActivityDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Activity ID',
  })
  id: string;

  @ApiProperty({
    example: 'payment_processed',
    description: 'Action that was performed',
  })
  action: string;

  @ApiProperty({
    example: 'payment',
    enum: ['payment', 'session', 'connection', 'account', 'system'],
    description: 'Category of the activity',
  })
  category: string;

  @ApiProperty({
    example: 'Payment of 2000 FCFA processed successfully for Starter plan',
    description: 'Human-readable description of the activity',
  })
  description: string;

  @ApiProperty({
    example: 'success',
    enum: ['success', 'failed', 'pending', 'warning'],
    description: 'Status of the activity',
  })
  status: string;

  @ApiProperty({
    example: {
      planName: 'Starter',
      amount: 2000,
      transactionId: 'FAP123456',
      duration: 24,
    },
    description: 'Additional details about the activity',
  })
  details: any;

  @ApiProperty({
    example: '2025-03-15T10:30:00Z',
    description: 'When the activity occurred',
  })
  timestamp: Date;

  @ApiProperty({
    example: 'Home',
    description: 'Router where activity occurred',
    nullable: true,
  })
  routerIdentity?: string;
}

export class RecentActivityResponseDto {
  @ApiProperty({
    type: [ActivityDto],
    description: 'List of recent activities',
  })
  activities: ActivityDto[];

  @ApiProperty({
    example: 25,
    description: 'Total number of activities (for pagination)',
  })
  total: number;

  @ApiProperty({
    example: 1,
    description: 'Current page number',
  })
  page: number;

  @ApiProperty({
    example: 10,
    description: 'Number of activities per page',
  })
  pageSize: number;

  @ApiProperty({
    example: 3,
    description: 'Total number of pages',
  })
  totalPages: number;
}

export class ActivityStatsDto {
  @ApiProperty({
    example: 5,
    description: 'Total number of successful actions this month',
  })
  successfulActionsThisMonth: number;

  @ApiProperty({
    example: 1,
    description: 'Total number of failed actions this month',
  })
  failedActionsThisMonth: number;

  @ApiProperty({
    example: 3,
    description: 'Number of payments processed this month',
  })
  paymentsThisMonth: number;

  @ApiProperty({
    example: 120,
    description: 'Total hours of service active this month',
  })
  hoursServiceActiveThisMonth: number;

  @ApiProperty({
    example: '2025-03-01T00:00:00Z',
    description: 'Start of month',
  })
  monthStart: Date;

  @ApiProperty({
    example: '2025-03-31T23:59:59Z',
    description: 'End of month',
  })
  monthEnd: Date;
}
