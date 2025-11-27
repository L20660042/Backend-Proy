import { PartialType } from '@nestjs/mapped-types';
import { CreateGroupDto } from './create-group.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateGroupDto extends PartialType(CreateGroupDto) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}