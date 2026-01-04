import { IsIn, IsInt, IsMongoId, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateActivityDto {
  @IsOptional()
  @IsMongoId()
  periodId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  responsibleName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  capacity?: number;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
