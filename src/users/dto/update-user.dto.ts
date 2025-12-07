import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsString, MinLength, ValidateIf } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ValidateIf(o => o.password !== undefined && o.password !== '') // Solo valida si se proporciona y no está vacía
  @IsString()
  @MinLength(6)
  password?: string;
}
