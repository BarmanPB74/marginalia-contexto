import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import {
  fuenteEtiquetas,
  fuenteFechas,
  sugerenciasEtiqueta,
  sugerenciasFecha,
} from '../../src/features/notas/editor/sugerencias';

const LUNES = new Date(2026, 9, 5); // lunes 5 de octubre de 2026

function contexto(texto: string) {
  const estado = EditorState.create({ doc: texto });
  return new CompletionContext(estado, texto.length, false);
}

describe('sugerenciasFecha', () => {
  it('hoy, mañana, pasado mañana y los días de la semana que vienen', () => {
    expect(sugerenciasFecha(LUNES).map((s) => `${s.nombre} ${s.dia}`)).toEqual([
      'hoy 2026-10-05',
      'mañana 2026-10-06',
      'pasado mañana 2026-10-07',
      'jueves 2026-10-08',
      'viernes 2026-10-09',
      'sábado 2026-10-10',
      'domingo 2026-10-11',
      'el próximo lunes 2026-10-12',
    ]);
  });

  it('cruza fin de mes y de año', () => {
    expect(sugerenciasFecha(new Date(2026, 11, 31))[1]?.dia).toBe('2027-01-01');
  });
});

describe('sugerenciasEtiqueta', () => {
  it('primero las que empiezan igual, luego las que contienen; sin tildes, sin repetir', () => {
    const conocidas = ['Estudio', 'estudio', 'proyecto-estudio', 'español', 'idiomas'];
    expect(sugerenciasEtiqueta('es', conocidas)).toEqual(['Estudio', 'español', 'proyecto-estudio']);
    expect(sugerenciasEtiqueta('espan', conocidas)).toEqual(['español']);
  });

  it('no sugiere lo que ya está escrito entero', () => {
    expect(sugerenciasEtiqueta('idiomas', ['idiomas'])).toEqual([]);
  });
});

describe('fuentes de CodeMirror', () => {
  it('# tras un espacio sugiere etiquetas; pegado a una palabra o en un encabezado no', () => {
    const fuente = fuenteEtiquetas(() => ['estudio', 'idiomas']);
    const r = fuente(contexto('Hoy #es')) as { from: number; options: { label: string; apply: string }[] };
    expect(r.from).toBe(4);
    expect(r.options.map((o) => o.apply)).toEqual(['#estudio ']);
    expect(fuente(contexto('correo#es'))).toBeNull();
  });

  it('@ sugiere fechas filtradas por nombre y ofrece el calendario', () => {
    const fuente = fuenteFechas(() => LUNES, () => undefined);
    const r = fuente(contexto('Entrega @man')) as unknown as { options: { label: string; detail?: string }[] };
    expect(r.options.map((o) => o.detail ?? o.label)).toEqual(['mañana', 'pasado mañana', 'Elegir en el calendario…']);
    const todas = fuente(contexto('@')) as unknown as { options: unknown[] };
    expect(todas.options).toHaveLength(9);
  });
});
