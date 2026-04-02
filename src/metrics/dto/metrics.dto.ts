import { ApiProperty } from '@nestjs/swagger';

export class MetricsDto {
  @ApiProperty({ example: 85.5, description: 'Current download speed in Mbps' })
  downloadSpeed: number;

  @ApiProperty({ example: 42.3, description: 'Current upload speed in Mbps' })
  uploadSpeed: number;

  @ApiProperty({ example: 25, description: 'Latency in milliseconds' })
  latency: number;

  @ApiProperty({
    example: 98,
    description: 'Signal strength as percentage (0-100)',
  })
  signalStrength: number;

  @ApiProperty({
    example: 'good',
    enum: ['excellent', 'good', 'fair', 'poor'],
    description: 'Connection quality rating',
  })
  connectionQuality: string;

  @ApiProperty({
    example: '2025-03-15T10:30:00Z',
    description: 'Timestamp when metrics were measured',
  })
  timestamp: Date;
}

export class ConnectionMetricsResponseDto {
  @ApiProperty({
    example: true,
    description: 'Whether the user has an active session',
  })
  isConnected: boolean;

  @ApiProperty({ type: MetricsDto, description: 'Real-time metrics data' })
  metrics: MetricsDto;

  @ApiProperty({
    example: 'active',
    enum: ['active', 'inactive', 'limited'],
    description: 'Current connection status',
  })
  status: string;

  @ApiProperty({ example: 1234567890, description: 'Data used in bytes' })
  dataUsed: number;

  @ApiProperty({
    example: 2147483648,
    description: 'Data limit in bytes (null if unlimited)',
  })
  dataLimit?: number;

  @ApiProperty({
    example: '2025-03-15T18:30:00Z',
    description: 'When the current session expires',
  })
  sessionExpiry?: Date;

  @ApiProperty({
    example: 'Home',
    description: 'Router where user is connected',
  })
  router?: string;
}

export class HistoricalMetricsDto {
  @ApiProperty({
    type: [MetricsDto],
    description: 'Historical metrics data points (last 24 hours)',
  })
  measurements: MetricsDto[];

  @ApiProperty({
    example: 82.5,
    description: 'Average download speed over period',
  })
  averageDownloadSpeed: number;

  @ApiProperty({
    example: 40.2,
    description: 'Average upload speed over period',
  })
  averageUploadSpeed: number;

  @ApiProperty({ example: 28, description: 'Average latency over period' })
  averageLatency: number;

  @ApiProperty({
    example: 92,
    description: 'Average signal strength over period',
  })
  averageSignalStrength: number;

  @ApiProperty({
    example: '2025-03-14T10:30:00Z',
    description: 'Start of the period',
  })
  startTime: Date;

  @ApiProperty({
    example: '2025-03-15T10:30:00Z',
    description: 'End of the period',
  })
  endTime: Date;
}
