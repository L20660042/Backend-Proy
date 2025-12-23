import { IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @IsOptional()
  @IsIn(['active', 'inactive', 'pending'])
  status?: 'active' | 'inactive' | 'pending';

  @IsOptional()
  @IsString()
  linkedEntityId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
