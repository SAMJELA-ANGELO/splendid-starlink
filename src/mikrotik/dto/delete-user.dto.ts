import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DeleteUserDto {
  @ApiProperty({
    description: 'Username of the user to delete',
    example: 'john_doe',
  })
  @IsString()
  username: string;
}
