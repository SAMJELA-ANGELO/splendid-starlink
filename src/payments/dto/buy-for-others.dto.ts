import { IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';

export class BuyForOthersDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores'
  })
  targetUsername: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  targetPassword: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[67]\d{8}$/, {
    message: 'Invalid phone number format. Use Fapshi format (e.g., 674818818)'
  })
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  planId: string;
}
