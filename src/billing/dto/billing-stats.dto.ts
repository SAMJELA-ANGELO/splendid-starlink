import { ApiProperty } from '@nestjs/swagger';

export class BillingStatsDto {
  @ApiProperty({ example: 5, description: 'Total number of purchases made' })
  totalPurchases: number;

  @ApiProperty({ example: 15000, description: 'Total amount spent in CFA' })
  totalSpent: number;

  @ApiProperty({ example: 120, description: 'Total hours of internet purchased' })
  totalHoursPurchased: number;

  @ApiProperty({ example: 4, description: 'Number of successful payments' })
  successfulPayments: number;

  @ApiProperty({ example: 1, description: 'Number of failed payments' })
  failedPayments: number;

  @ApiProperty({ example: 0, description: 'Number of gifts received' })
  giftsReceived: number;

  @ApiProperty({ example: '2025-01-15T10:30:00Z', description: 'First purchase date', nullable: true })
  startDate: Date | null;

  @ApiProperty({ example: '2025-03-15T10:30:00Z', description: 'Most recent purchase date', nullable: true })
  endDate: Date | null;
}
