import { IsString, IsMongoId, IsOptional, IsNumber, IsBoolean, IsArray } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsMongoId()
  @IsOptional()
  career?: string;

  @IsMongoId()
  subject: string;

  @IsMongoId()
  @IsOptional()
  teacher?: string;

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  students?: string[];

  @IsString()
  @IsOptional()
  schedule?: string;

  @IsNumber()
  @IsOptional()
  capacity?: number;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}