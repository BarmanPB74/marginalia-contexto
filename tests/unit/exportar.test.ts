import { describe, expect, it } from 'vitest';
import { exportar, nombreArchivo } from '../../src/core/exportar/formatos';
import { leerNota, type Nota } from '../../src/core/notas/nota';

const nota: Nota = {
  id: '01J9ZK3Q8V2M4N6P7R8S9T0WXY',
  titulo: 'Reunión <b>5/10</b>',
  creado: '2026-10-05T09:00:00-05:00',
  editado: '2026-10-05T09:30:00-05:00',
  etiquetas: ['reunión'],
  extra: { fecha: '2026-10-05' },
  cuerpo: '## Temas\n\n- [ ] Enviar **acta** @2026-10-12\n\n<script>alert(1)</script>',
};

describe('nombreArchivo', () => {
  it('sin barras ni caracteres raros, con la extensión pedida', () => {
    expect(nombreArchivo('Reunión: 5/10 ¿ok?', 'md')).toBe('Reunión 5-10 ok.md');
    expect(nombreArchivo('../../etc/passwd', 'txt')).toBe('etc-passwd.txt');
    expect(nombreArchivo('   ', 'html')).toBe('nota.html');
    expect(nombreArchivo('a'.repeat(100), 'md')).toHaveLength(63);
  });
});

describe('exportar', () => {
  it('Markdown: el mismo .md de siempre, legible y que se vuelve a importar igual', () => {
    const md = exportar(nota, 'md');
    expect(md.startsWith('---\n')).toBe(true);
    expect(md).not.toContain('MARGINALIA-CIFRADO');
    expect(leerNota(md)).toEqual(nota);
  });

  it('Texto: título subrayado y cuerpo sin marcas', () => {
    const txt = exportar(nota, 'txt');
    expect(txt.split('\n')[0]).toBe('Reunión <b>5/10</b>');
    expect(txt).toContain('☐ Enviar acta @2026-10-12');
  });

  it('HTML: página completa, título escapado y cuerpo sanitizado', () => {
    const html = exportar(nota, 'html');
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>Reunión &lt;b&gt;5/10&lt;/b&gt;</title>');
    expect(html).toContain('<strong>acta</strong>');
    expect(html).not.toContain('<script>');
  });
});
