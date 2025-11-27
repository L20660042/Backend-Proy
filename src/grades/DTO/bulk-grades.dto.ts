import { IsArray, ValidateNested, IsMongoId, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

class BulkGradeItem {
  @IsMongoId()
  @IsNotEmpty()
  student: string;

  @IsMongoId()
  @IsNotEmpty()
  subject: string;

  @IsMongoId()
  @IsNotEmpty()
  group: string;

  @IsNotEmpty()
  score: number;
}

export class BulkGradesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkGradeItem)
  grades: BulkGradeItem[];

  @IsMongoId()
  @IsNotEmpty()
  group: string;

  @IsMongoId()
  @IsNotEmpty()
  subject: string;

  @IsNotEmpty()
  period: string;
}