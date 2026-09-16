import { fechaCaracas } from '../../compartido/utilidades/formato';
import type { Ticket } from './consulta.tipos';

export const ticketsDemostracion: Ticket[] = [{ serial: 'AG-DEMO-240914', numero_ticket: 1204, fecha_juego: fechaCaracas(), estado: 'ACTIVO', total_jugado: '8.00', total_premio: '0.00', monto_pagado: '0.00', es_demostracion: true, jugadas: [{ monto: '4.00', animal: { codigo_animal: '05', nombre: 'León' }, horario_sorteo: { hora: '14:00', sorteo: { nombre: 'Lotto Activo' } } }, { monto: '4.00', animal: { codigo_animal: '18', nombre: 'Burro' }, horario_sorteo: { hora: '16:00', sorteo: { nombre: 'La Granjita' } } }] }];
