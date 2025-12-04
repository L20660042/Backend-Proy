import { IsString, IsMongoId, IsOptional } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  name: string;

  @IsMongoId()
  subject: string;

  @IsMongoId()
  @IsOptional()
  teacher?: string;

  @IsOptional()
  students?: string[]; // opcional

  @IsOptional()
  active?: boolean;
}
