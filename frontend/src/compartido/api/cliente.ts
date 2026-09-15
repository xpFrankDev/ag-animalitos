const URL_API = import.meta.env.VITE_API_URL ?? '/api';

export type Sesion = { token: string; vence_en: number; usuario: { nombre_usuario: string; nombre_completo: string; tipo_usuario: string } };

const claveDispositivo = 'ag_serial_dispositivo';

export function obtenerSerialDispositivo(): string {
  const existente = localStorage.getItem(claveDispositivo);
  if (existente) return existente;
  const aleatorio = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const serial = `ag-${aleatorio}`;
  localStorage.setItem(claveDispositivo, serial);
  return serial;
}

export class ErrorApi extends Error {
  public constructor(public readonly estado: number, mensaje: string) { super(mensaje); }
}

export async function llamarApi<T>(ruta: string, opciones: RequestInit = {}, token?: string): Promise<T> {
  const respuesta = await fetch(`${URL_API}${ruta}`, { ...opciones, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opciones.headers } });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new ErrorApi(respuesta.status, datos.message?.toString() ?? 'No se pudo completar la operación.');
  return datos as T;
}

export const iniciarSesion = (nombre_usuario: string, contrasena: string) => llamarApi<Sesion>('/autenticacion/iniciar-sesion', { method: 'POST', body: JSON.stringify({ nombre_usuario, contrasena, serial_dispositivo: obtenerSerialDispositivo() }) });
