import { ExtractorHtmlService } from './extractor-html.service';
import { FuenteResultados } from '../tipos';

/**
 * Tarjetas reales de loteriadehoy.com: la lista de Guácharo Activo llega hasta el 75 y
 * comparte la estructura con La Granjita, por eso el mismo extractor sirve para ambas.
 */
function tarjeta(codigo: string, nombre: string, hora: string): string {
  return `
    <div class="col-sm-6 col-md-4 col-lg-16 mb-5">
      <div class="circle"><img src="/dist/animals_img/${nombre}_17.webp?v=1.0.0"></div>
      <div class="circle-legend">
        <h4 class="mt-3 rojo">${codigo} ${nombre}</h4>
        <h5>Guacharo Activo ${hora}</h5>
      </div>
    </div>`;
}

const fuente: FuenteResultados = {
  programa: 'Guácharo Activo',
  construirUrl: (fecha) => `https://loteriadehoy.com/animalito/guacharoactivo/resultados/${fecha}/`,
};

describe('ExtractorHtmlService', () => {
  const extractor = new ExtractorHtmlService();

  it('extrae los resultados de Guácharo Activo, incluidos los códigos sobre 36', () => {
    const html = `<div class="row text-center js-con">
      ${tarjeta('58', 'Hormiga', '08:00 AM')}
      ${tarjeta('0', 'Delfin', '02:00 PM')}
      ${tarjeta('40', 'Avispa', '06:00 PM')}
      ${tarjeta('75', 'Guacharo', '07:00 PM')}
    </div>`;

    const resultados = extractor.extraerDeHtml(html, fuente, '2026-09-24', 'https://loteriadehoy.com/animalito/guacharoactivo/resultados/2026-09-24/');

    expect(resultados.map((resultado) => [resultado.hora, resultado.codigo_animal])).toEqual([
      ['08:00:00', '58'],
      ['14:00:00', '0'],
      ['18:00:00', '40'],
      ['19:00:00', '75'],
    ]);
    expect(resultados.every((resultado) => resultado.programa === 'Guácharo Activo')).toBe(true);
  });

  it('ignora el contenido que no es un resultado', () => {
    const html = `<div class="col-sm-6 col-md-4 col-lg-16 mb-5">
      <h4>Animalitos</h4><h5>Resultados de hoy</h5>
    </div>`;

    expect(extractor.extraerDeHtml(html, fuente, '2026-09-24', fuente.construirUrl('2026-09-24'))).toEqual([]);
  });
});
