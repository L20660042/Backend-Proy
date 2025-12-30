import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateComplaintStatusDto {
  @IsEnum(['open', 'in_review', 'resolved', 'rejected'] as any)
  status: 'open' | 'in_review' | 'resolved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  resolutionNote?: string;
}
