import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Alert, AlertDocument, AlertType } from './schemas/alert.schema';
import { CreateAlertDto } from './dto/create-alert.dto';
import axios from 'axios';

@Injectable()
export class AlertsService {
  constructor(@InjectModel(Alert.name) private alertModel: Model<AlertDocument>) {}

  /** Crear alerta usando microservicio de IA */
  async create(dto: CreateAlertDto) {
    let riskLevel = 0;

    try {
      const response = await axios.post('https://ml-service-production-fff9.up.railway.app/predict', {
        text: dto.message,
      });

      riskLevel = response.data.risk || 0;
    } catch (error) {
      throw new HttpException('Error al comunicarse con el microservicio de IA', HttpStatus.BAD_GATEWAY);
    }

    const alert = new this.alertModel({
      message: dto.message,
      type: dto.type,
      riskLevel,
      student: dto.student ? new Types.ObjectId(dto.student) : null,
      teacher: dto.teacher ? new Types.ObjectId(dto.teacher) : null,
      group: dto.group ? new Types.ObjectId(dto.group) : null,
    });

    return alert.save();
  }

  async findAll() {
    return this.alertModel
      .find()
      .populate('student')
      .populate('teacher')
      .populate('group')
      .sort({ createdAt: -1 })
      .exec();
  }

  async resolve(id: string) {
    const alert = await this.alertModel.findById(id);
    if (!alert) throw new HttpException('Alerta no encontrada', HttpStatus.NOT_FOUND);

    alert.resolved = true;
    return alert.save();
  }
}
