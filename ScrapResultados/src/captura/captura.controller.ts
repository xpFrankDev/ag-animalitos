import { Controller, Get } from '@nestjs/common';
import { CapturaService } from './captura.service';

@Controller('salud')
export class CapturaController {
  constructor(private readonly captura: CapturaService) {}

  @Get()
  estado(): { estado: string; en_ejecucion: boolean; ultima_ejecucion?: string } {
    return { estado: 'ok', ...this.captura.estado() };
  }
}
