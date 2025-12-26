import { IsString, Matches, MinLength } from 'class-validator';

export class RegisterStudentDto {
  @IsString()
  @Matches(/^\d{8}$/, { message: 'controlNumber debe tener 8 dígitos' })
  controlNumber: string;

  @IsString()
  @MinLength(6)
  password: string;
}
