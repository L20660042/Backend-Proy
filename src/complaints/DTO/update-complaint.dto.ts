import { PartialType } from '@nestjs/mapped-types';
import { CreateComplaintDto } from './create-complaint.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateComplaintDto extends PartialType(CreateComplaintDto) {
  @IsEnum(['pendiente', 'en_revision', 'resuelta', 'rechazada'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  resolution?: string;
}