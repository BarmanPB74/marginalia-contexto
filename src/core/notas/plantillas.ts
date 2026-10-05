/**
 * Plantillas para crear notas, al estilo de Obsidian: Markdown con variables
 * `{{titulo}}`, `{{fecha}}` (AAAA-MM-DD) y `{{hora}}` (HH:mm). Las variables
 * desconocidas se dejan tal cual.
 */
export interface Plantilla {
  id: string;
  nombre: string;
  /** Título por defecto (admite variables). */
  titulo: string;
  etiquetas: string[];
  cuerpo: string;
}

export const PLANTILLAS: readonly Plantilla[] = [
  { id: 'en-blanco', nombre: 'En blanco', titulo: 'Sin título', etiquetas: [], cuerpo: '' },
  {
    id: 'rapida',
    nombre: 'Nota rápida',
    titulo: 'Nota rápida {{fecha}} {{hora}}',
    etiquetas: ['rápida'],
    cuerpo: '',
  },
  {
    id: 'bitacora',
    nombre: 'Bitácora',
    titulo: 'Bitácora {{fecha}}',
    etiquetas: ['bitácora'],
    cuerpo: '# {{titulo}}\n\n## {{hora}}\n\n',
  },
  {
    id: 'reunion',
    nombre: 'Reunión',
    titulo: 'Reunión {{fecha}}',
    etiquetas: ['reunión'],
    cuerpo:
      '# {{titulo}}\n\n' +
      '**Fecha:** {{fecha}} {{hora}}\n' +
      '**Asistentes:** \n\n' +
      '## Temas\n\n- \n\n' +
      '## Acuerdos\n\n- \n\n' +
      '## Tareas\n\n- [ ] \n',
  },
];

export function buscarPlantilla(id: string): Plantilla | undefined {
  return PLANTILLAS.find((p) => p.id === id);
}

interface Variables {
  titulo: string;
  ahora: Date;
}

export function aplicarPlantilla(texto: string, { titulo, ahora }: Variables): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  const valores: Record<string, string> = {
    titulo,
    fecha: `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`,
    hora: `${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`,
  };
  // Una sola pasada: lo que se inserta no se vuelve a interpretar.
  return texto.replace(/\{\{\s*([a-z]+)\s*\}\}/g, (original, nombre: string) =>
    Object.hasOwn(valores, nombre) ? (valores[nombre] ?? original) : original,
  );
}
