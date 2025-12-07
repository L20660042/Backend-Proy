import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ValidateIf(o => o.password !== undefined) // Solo valida si se proporciona password
  @IsString()
  @MinLength(6)
  password?: string;
}
