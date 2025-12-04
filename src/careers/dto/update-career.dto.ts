import { PartialType } from '@nestjs/mapped-types';
import { CreateCareerDto } from './create-career.dto';

export class UpdateCareerDto extends PartialType(CreateCareerDto) {
  // Se puede extender si quieres permitir activar/desactivar
}
