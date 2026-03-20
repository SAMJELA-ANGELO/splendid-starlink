import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class WebhookDto {
  @ApiProperty({ example: 'AbCd1234', description: 'Fapshi transaction ID' })
  @IsString()
  transId: string;
}
