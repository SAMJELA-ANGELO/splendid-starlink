import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DisableUserDto {
  @ApiProperty({
    description: 'Username of the user to disable',
    example: 'john_doe',
  })
  @IsString()
  username: string;
}
