import { IsMongoId, IsString, IsOptional, IsEnum } from 'class-validator';
import { AlertType } from '../schemas/alert.schema';

export class CreateAlertDto {
  @IsOptional()
  @IsMongoId()
  student?: string;

  @IsOptional()
  @IsMongoId()
  teacher?: string;

  @IsOptional()
  @IsMongoId()
  group?: string;

  @IsString()
  message: string;

  @IsEnum(AlertType)
  type: AlertType;
}
