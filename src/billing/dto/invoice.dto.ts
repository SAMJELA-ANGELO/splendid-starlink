import { ApiProperty } from '@nestjs/swagger';

export class InvoiceDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Invoice/Payment ID',
  })
  id: string;

  @ApiProperty({ example: 'starter', description: 'Plan name' })
  planName: string;

  @ApiProperty({ example: 2000, description: 'Amount in CFA' })
  amount: number;

  @ApiProperty({ example: 24, description: 'Duration in hours' })
  duration: number;

  @ApiProperty({
    example: '2025-03-15T10:30:00Z',
    description: 'Purchase date',
  })
  purchaseDate: Date;

  @ApiProperty({
    example: 'SUCCESSFUL',
    enum: ['created', 'pending', 'SUCCESSFUL', 'FAILED', 'EXPIRED'],
    description: 'Payment status',
  })
  status: string;

  @ApiProperty({ example: 'FAP123456', description: 'Fapshi transaction ID' })
  transactionId: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'Email used for payment',
  })
  email?: string;

  @ApiProperty({
    example: '+237671234567',
    description: 'Phone number used for payment',
  })
  phone?: string;

  @ApiProperty({
    example: false,
    description: 'Whether this was a gift purchase',
  })
  isGift?: boolean;

  @ApiProperty({
    example: 'recipient_user',
    description: 'Recipient username if this is a gift',
  })
  recipientUsername?: string;

  @ApiProperty({
    example: 'Home',
    description: 'Router where this session is/was active',
  })
  activeRouter?: string;
}

export class BillingHistoryResponseDto {
  @ApiProperty({ example: 5, description: 'Total number of invoices' })
  totalInvoices: number;

  @ApiProperty({ example: 15000, description: 'Total amount spent in CFA' })
  totalAmountSpent: number;

  @ApiProperty({ type: [InvoiceDto], description: 'List of invoices' })
  invoices: InvoiceDto[];

  @ApiProperty({
    example: '2025-03-01T00:00:00Z',
    description: 'Earliest purchase date',
  })
  startDate?: Date;

  @ApiProperty({
    example: '2025-03-15T10:30:00Z',
    description: 'Latest purchase date',
  })
  endDate?: Date;
}
