import { parseDocument, stringify } from 'yaml';
import { esUlid } from './ulid';

/** Una página: frontmatter YAML + cuerpo Markdown. Contrato en docs/FORMATO_NOTAS.md. */
export interface Nota {
  id: string;
  titulo: string;
  /** ISO 8601 con desfase horario. */
  creado: string;
  editado: string;
  etiquetas: string[];
  padre?: string;
  /** Campos del frontmatter que esta versión no usa: se guardan tal cual. */
  extra: Record<string, unknown>;
  cuerpo: string;
}

export class NotaInvalida extends Error {
  constructor(motivo: string) {
    super(`Nota inválida: ${motivo}`);
    this.name = 'NotaInvalida';
  }
}

export const TAMANO_MAXIMO = 2 * 1024 * 1024;
const CONOCIDOS = new Set(['id', 'titulo', 'creado', 'editado', 'etiquetas', 'padre']);

/** "2026-10-03T20:45:00-05:00": hora del dispositivo con su desfase. */
export function isoConOffset(fecha: Date): string {
  const dos = (n: number) => String(Math.abs(n)).padStart(2, '0');
  const desfase = -fecha.getTimezoneOffset();
  const signo = desfase >= 0 ? '+' : '-';
  return (
    `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}` +
    `T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:${dos(fecha.getSeconds())}` +
    `${signo}${dos(Math.trunc(desfase / 60))}:${dos(desfase % 60)}`
  );
}

function separar(texto: string): { yaml: string; cuerpo: string } {
  const limpio = texto.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!limpio.startsWith('---\n')) throw new NotaInvalida('falta el frontmatter');
  const fin = /^---[ \t]*$/m;
  const resto = limpio.slice(4);
  const cierre = fin.exec(resto);
  if (!cierre) throw new NotaInvalida('el frontmatter no se cierra');
  const despues = resto.slice(cierre.index + cierre[0].length);
  return { yaml: resto.slice(0, cierre.index), cuerpo: despues.startsWith('\n') ? despues.slice(1) : despues };
}

function leerYaml(yaml: string): Record<string, unknown> {
  // Esquema "core": sin etiquetas de código ni fechas mágicas. Pocos alias: frena las bombas.
  const doc = parseDocument(yaml, { schema: 'core', uniqueKeys: true });
  if (doc.errors.length > 0) throw new NotaInvalida(doc.errors[0]?.message ?? 'YAML inválido');
  let valor: unknown;
  try {
    valor = doc.toJS({ maxAliasCount: 100 });
  } catch (e) {
    throw new NotaInvalida(e instanceof Error ? e.message : 'YAML inválido');
  }
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
    throw new NotaInvalida('el frontmatter no es un mapa');
  }
  // Copia con propiedades propias: "__proto__" queda como dato, no como prototipo.
  return Object.fromEntries(Object.entries(valor));
}

function comoEtiquetas(valor: unknown): string[] {
  const lista = Array.isArray(valor) ? valor : valor === undefined ? [] : [valor];
  return lista
    .filter((v): v is string | number => typeof v === 'string' || typeof v === 'number')
    .map(String);
}

function tituloDelCuerpo(cuerpo: string): string {
  return /^#[ \t]+(.+)$/m.exec(cuerpo)?.[1]?.trim() || 'Sin título';
}

export function leerNota(texto: string): Nota {
  if (new TextEncoder().encode(texto).length > TAMANO_MAXIMO) {
    throw new NotaInvalida('supera 2 MB');
  }
  const { yaml, cuerpo } = separar(texto);
  const meta = leerYaml(yaml);
  const id = meta['id'];
  if (typeof id !== 'string' || !esUlid(id)) throw new NotaInvalida('id ausente o no es ULID');

  const extra = Object.fromEntries(Object.entries(meta).filter(([clave]) => !CONOCIDOS.has(clave)));
  const titulo = meta['titulo'];
  const texto_ = (v: unknown) => (typeof v === 'string' ? v : '');
  const padre = meta['padre'];
  return {
    id,
    titulo: typeof titulo === 'string' && titulo.trim() ? titulo : tituloDelCuerpo(cuerpo),
    creado: texto_(meta['creado']),
    editado: texto_(meta['editado']) || texto_(meta['creado']),
    etiquetas: comoEtiquetas(meta['etiquetas']),
    ...(typeof padre === 'string' && esUlid(padre) ? { padre } : {}),
    extra,
    cuerpo,
  };
}

export function escribirNota(nota: Nota): string {
  const meta: Record<string, unknown> = Object.fromEntries([
    ['id', nota.id],
    ['titulo', nota.titulo],
    ['creado', nota.creado],
    ['editado', nota.editado],
    ...(nota.etiquetas.length > 0 ? [['etiquetas', nota.etiquetas]] : []),
    ...(nota.padre ? [['padre', nota.padre]] : []),
    ...Object.entries(nota.extra).filter(([clave]) => !CONOCIDOS.has(clave)),
  ]);
  // Listas con guiones (como las escribe Obsidian); sin cortar líneas largas.
  const yaml = stringify(meta, { schema: 'core', lineWidth: 0 });
  return `---\n${yaml}---\n${nota.cuerpo}`;
}
