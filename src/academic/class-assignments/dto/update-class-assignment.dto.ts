import { PartialType } from '@nestjs/mapped-types';
import { CreateClassAssignmentDto } from './create-class-assignment.dto';

export class UpdateClassAssignmentDto extends PartialType(CreateClassAssignmentDto) {}
