import { PartialType } from '@nestjs/mapped-types';
import { CreateCapacitacionDto } from './create-capacitacion.dto';

export class UpdateCapacitacionDto extends PartialType(CreateCapacitacionDto) {}
