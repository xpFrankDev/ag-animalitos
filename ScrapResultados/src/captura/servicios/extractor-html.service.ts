import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { AnyNode } from 'domhandler';
import { FuenteResultados, ResultadoExtraido, ResultadosNoDisponibles } from '../tipos';
import { normalizarCodigoAnimal, normalizarHora } from '../utilidades/normalizador-resultados';

const selectoresTarjeta = [
  'div.col-6.col-xl-2.col-lg-3.col-md-4.col-sm-6.d-flex.flex-column.align-items-center',
  'div.col-sm-6.col-md-4.col-lg-16.mb-5',
  '[class*="resultado"]', '[class*="result"]', '.card', 'article',
];

@Injectable()
export class ExtractorHtmlService {
  private readonly logger = new Logger(ExtractorHtmlService.name);

  async extraer(fuente: FuenteResultados, fecha: string): Promise<ResultadoExtraido[]> {
    const url = fuente.construirUrl(fecha);
    const respuesta = await this.consultar(url, { accept: 'text/html,application/xhtml+xml' });
    if (!respuesta.ok) throw new Error(`${fuente.programa}: HTTP ${respuesta.status} al consultar ${url}.`);
    const html = await respuesta.text();
    if (fuente.enlace_lottoactivo) return this.extraerLottoActivo(html, fuente, fecha, url);
    const resultados = this.extraerDeHtml(html, fuente, fecha, url);
    if (!resultados.length) throw new ResultadosNoDisponibles(fuente.programa);
    return resultados;
  }

  private async consultar(url: string, encabezados: Record<string, string>, opciones: RequestInit = {}): Promise<Response> {
    return fetch(url, {
      ...opciones,
      headers: { 'user-agent': 'AG-ScrapResultados/0.1 (+administracion@animalitos.local)', ...encabezados },
      signal: AbortSignal.timeout(Number(process.env.TIEMPO_ESPERA_HTTP_MS ?? 20_000)),
    });
  }

  private async extraerLottoActivo(html: string, fuente: FuenteResultados, fecha: string, url: string): Promise<ResultadoExtraido[]> {
    const consultas = [...html.matchAll(/data\s*=\s*\{\s*['"]option['"]\s*:\s*['"]([^'"]+)['"]([\s\S]*?)\}/g)];
    if (!consultas.length) throw new Error(`${fuente.programa}: Lotto Activo cambió la página y no se encontraron consultas de resultados.`);
    let juegos: Array<{ date_result?: string; number_animal?: string; time_schedule?: string; time_s?: string }> = [];
    for (const consulta of consultas) {
      const loteria = consulta[2].match(/['"]loteria['"]\s*:\s*['"]([^'"]+)['"]/)?.[1];
      if (!loteria) continue;
      const cuerpo = new URLSearchParams({ option: consulta[1], loteria });
      if (consulta[2].match(/['"]fecha['"]\s*:/)) cuerpo.set('fecha', fecha);
      const respuesta = await this.consultar('https://www.lottoactivo.com/core/process.php', {
        accept: 'application/json, text/javascript, */*; q=0.01',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest',
      }, { method: 'POST', body: cuerpo });
      if (!respuesta.ok) continue;
      const datos = await respuesta.json() as { datos?: Array<{ link?: string; link_game?: string; resultados?: Array<{ date_result?: string; number_animal?: string; time_schedule?: string; time_s?: string }>; date_result?: string; number_animal?: string; time_schedule?: string; time_s?: string }> };
      const grupos = datos.datos ?? [];
      juegos = grupos.flatMap((grupo) => grupo.link === fuente.enlace_lottoactivo ? grupo.resultados ?? [] : [])
        .concat(grupos.filter((grupo) => grupo.link_game === fuente.enlace_lottoactivo));
      if (juegos.length) break;
    }
    const encontrados = new Map<string, ResultadoExtraido>();
    for (const juego of juegos) {
      try {
        const codigo_animal = normalizarCodigoAnimal(juego.number_animal ?? '');
        const hora = normalizarHora(juego.time_schedule ?? juego.time_s ?? '');
        const fechaResultado = juego.date_result && /^\d{4}-\d{2}-\d{2}$/.test(juego.date_result) ? juego.date_result : fecha;
        encontrados.set(hora, { programa: fuente.programa, fecha_juego: fechaResultado, hora, codigo_animal, url_origen: url });
      } catch {
        // Un registro incompleto no debe impedir preservar los demás resultados válidos.
      }
    }
    const resultados = [...encontrados.values()].sort((a, b) => a.hora.localeCompare(b.hora));
    if (!resultados.length) throw new ResultadosNoDisponibles(fuente.programa);
    this.logger.debug(`${fuente.programa}: ${resultados.length} resultados extraídos del endpoint oficial.`);
    return resultados;
  }

  extraerDeHtml(html: string, fuente: FuenteResultados, fecha: string, url: string): ResultadoExtraido[] {
    const $ = cheerio.load(html);
    const candidatos = new Set<AnyNode>();
    for (const selector of selectoresTarjeta) {
      $(selector).each((_, elemento) => {
        candidatos.add(elemento);
      });
    }

    const encontrados = new Map<string, ResultadoExtraido>();
    for (const tarjeta of candidatos) {
      const numero = $(tarjeta).find('span.badge, .circle-legend h4, h4, [class*="numero"], [class*="animal"]').first().text().trim() || $(tarjeta).text();
      const hora = $(tarjeta).find('p.small, .circle-legend h5, h5, time, [class*="hora"]').first().text().trim() || $(tarjeta).text();
      try {
        const codigo_animal = normalizarCodigoAnimal(numero);
        const horaNormalizada = normalizarHora(hora);
        encontrados.set(horaNormalizada, { programa: fuente.programa, fecha_juego: fecha, hora: horaNormalizada, codigo_animal, url_origen: url });
      } catch {
        // Las tarjetas de navegación y publicidad no son resultados.
      }
    }

    const resultados = [...encontrados.values()].sort((a, b) => a.hora.localeCompare(b.hora));
    this.logger.debug(`${fuente.programa}: ${resultados.length} resultados extraídos de ${url}.`);
    return resultados;
  }
}
