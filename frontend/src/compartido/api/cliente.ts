const URL_API = import.meta.env.VITE_API_URL ?? '/api';

export type Sesion = { token: string; vence_en: number; usuario: { nombre_usuario: string; nombre_completo: string; tipo_usuario: string } };

const claveDispositivo = 'ag_codigo_equipo';

/** Resumen estable de una cadena: solo identifica el equipo, no protege secretos. */
function resumir(texto: string): string {
  let fnv = 0x811c9dc5;
  let djb2 = 5381;
  for (let indice = 0; indice < texto.length; indice += 1) {
    const codigo = texto.charCodeAt(indice);
    fnv = Math.imul(fnv ^ codigo, 0x01000193) >>> 0;
    djb2 = (Math.imul(djb2, 33) ^ codigo) >>> 0;
  }
  return `${fnv.toString(16).padStart(8, '0')}${djb2.toString(16).padStart(8, '0')}`;
}

/**
 * Identificador aleatorio propio de este navegador. Se guarda para que la taquilla
 * conserve su código entre sesiones; si se borra el almacenamiento, la agencia deberá
 * pedir la liberación del equipo.
 */
function identificadorPersistente(): string {
  try {
    const existente = localStorage.getItem(claveDispositivo);
    if (existente) return existente;
  } catch {
    // Almacenamiento no disponible (modo privado): se usa un identificador de la sesión.
  }
  const aleatorio =
    typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  try {
    localStorage.setItem(claveDispositivo, aleatorio);
  } catch {
    // Sin persistencia: el código cambiará en el próximo inicio de sesión.
  }
  return aleatorio;
}

/**
 * Rasgos estables del equipo (plataforma, núcleos, memoria, pantalla y zona horaria).
 * Se combinan con el identificador persistente para que el código sea único por PC y
 * navegador, y distinto cuando la taquilla se abre desde otro equipo.
 */
function huellaDispositivo(): string {
  const navegador = window.navigator as Navigator & { deviceMemory?: number; userAgentData?: { platform?: string } };
  return resumir(
    [
      navegador.userAgentData?.platform ?? navegador.platform ?? '',
      String(navegador.hardwareConcurrency ?? ''),
      String(navegador.deviceMemory ?? ''),
      String(navegador.maxTouchPoints ?? ''),
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
      (navegador.languages ?? []).slice(0, 2).join(','),
      `${Math.round(window.screen.width / 200)}x${Math.round(window.screen.height / 200)}`,
    ].join('|'),
  );
}

/** Código único por equipo y navegador; se recalcula en cada inicio de sesión. */
export function obtenerSerialDispositivo(): string {
  const persistente = identificadorPersistente().replace(/[^a-z0-9]/gi, '').slice(0, 12);
  return `ag-${huellaDispositivo()}-${persistente}`;
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
