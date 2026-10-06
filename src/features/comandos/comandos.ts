import type { Ajustes } from '../../app/ajustes';
import { diaDe } from '../../core/notas/fechas';
import { PLANTILLAS } from '../../core/notas/plantillas';
import type { RepositorioNotas } from '../../core/notas/repositorio';
import type { NombreIcono } from '../../ui/Icono';
import { elegirZip, exportarCopia, importarCopia } from '../notas/copia';

export type GrupoComando = 'Esta nota' | 'Herramientas' | 'Ir a' | 'Ajustes' | 'Música';

/** Una acción de la app que se puede buscar por nombre. */
export interface Comando {
  id: string;
  nombre: string;
  grupo: GrupoComando;
  /** sinónimos que también encuentran el comando ("crear", "dark"…) */
  palabras?: string;
  icono?: NombreIcono;
  ejecutar: () => void | Promise<void>;
}

interface Contexto {
  repo: RepositorioNotas;
  ajustes: Ajustes;
  cambiarAjustes: (parcial: Partial<Ajustes>) => void;
  sonando: boolean;
  alternar: () => void;
  hoy?: Date;
  /** Mensaje para la persona tras una herramienta (exportar, importar…) */
  avisar?: (mensaje: string) => void;
}

/** Comandos que existen en cualquier pantalla. Los de una nota abierta los añade PantallaNota. */
export function comandosGlobales({
  repo,
  ajustes,
  cambiarAjustes,
  sonando,
  alternar,
  hoy = new Date(),
  avisar = () => undefined,
}: Contexto): Comando[] {
  const abrir = async (opciones: Parameters<RepositorioNotas['crear']>[0]) => {
    const nota = await repo.crear(opciones);
    location.hash = `#/notas/${nota.id}`;
  };
  const dia = diaDe(hoy);
  return [
    {
      id: 'bitacora-hoy',
      nombre: 'Bitácora de hoy',
      grupo: 'Herramientas',
      palabras: 'diario nueva crear calendario',
      icono: 'calendario',
      ejecutar: () => abrir({ plantilla: 'bitacora', dia }),
    },
    ...PLANTILLAS.map<Comando>((p) => ({
      id: `nueva-${p.id}`,
      nombre: `Nueva nota: ${p.nombre}`,
      grupo: 'Herramientas',
      palabras: 'crear escribir plantilla',
      icono: 'mas',
      ejecutar: () => abrir({ plantilla: p.id }),
    })),
    {
      id: 'exportar-zip',
      nombre: 'Exportar todas las notas (ZIP)',
      grupo: 'Herramientas',
      palabras: 'copia respaldo backup guardar descifrar obsidian markdown',
      icono: 'exportar',
      ejecutar: async () => avisar(await exportarCopia(repo, hoy)),
    },
    {
      id: 'importar-zip',
      nombre: 'Importar notas (ZIP)',
      grupo: 'Herramientas',
      palabras: 'copia respaldo backup restaurar recuperar',
      icono: 'mas',
      ejecutar: async () => {
        // elegirZip() se llama sin esperar nada antes: sigue dentro del toque o de Intro
        const archivo = await elegirZip();
        if (archivo) avisar(await importarCopia(repo, archivo));
      },
    },
    {
      id: 'calendario-hoy',
      nombre: 'Ver hoy en el calendario',
      grupo: 'Ir a',
      palabras: 'fecha dia agenda',
      icono: 'calendario',
      ejecutar: () => void (location.hash = `#/calendario/${dia}`),
    },
    { id: 'ir-notas', nombre: 'Notas', grupo: 'Ir a', icono: 'notas', ejecutar: () => void (location.hash = '#/notas') },
    {
      id: 'ir-calendario',
      nombre: 'Calendario',
      grupo: 'Ir a',
      icono: 'calendario',
      ejecutar: () => void (location.hash = '#/calendario'),
    },
    { id: 'ir-musica', nombre: 'Música', grupo: 'Ir a', icono: 'musica', ejecutar: () => void (location.hash = '#/musica') },
    {
      id: 'ir-ajustes',
      nombre: 'Ajustes',
      grupo: 'Ir a',
      palabras: 'configuracion opciones preferencias',
      icono: 'ajustes',
      ejecutar: () => void (location.hash = '#/ajustes'),
    },
    {
      id: 'tema-sistema',
      nombre: 'Tema: como el sistema',
      grupo: 'Ajustes',
      palabras: 'apariencia automatico',
      ejecutar: () => cambiarAjustes({ tema: 'sistema' }),
    },
    {
      id: 'tema-claro',
      nombre: 'Tema: claro',
      grupo: 'Ajustes',
      palabras: 'apariencia blanco dia light',
      ejecutar: () => cambiarAjustes({ tema: 'claro' }),
    },
    {
      id: 'tema-oscuro',
      nombre: 'Tema: oscuro',
      grupo: 'Ajustes',
      palabras: 'apariencia negro noche dark',
      ejecutar: () => cambiarAjustes({ tema: 'oscuro' }),
    },
    {
      id: 'vista-notas',
      nombre: ajustes.vistaNotas === 'tarjetas' ? 'Ver notas como lista' : 'Ver notas como tarjetas',
      grupo: 'Ajustes',
      palabras: 'vista recientes multitarea',
      icono: ajustes.vistaNotas === 'tarjetas' ? 'lista' : 'tarjetas',
      ejecutar: () => cambiarAjustes({ vistaNotas: ajustes.vistaNotas === 'tarjetas' ? 'lista' : 'tarjetas' }),
    },
    {
      id: 'flotante',
      nombre: ajustes.flotante ? 'Anclar el reproductor sobre la barra' : 'Reproductor flotante',
      grupo: 'Ajustes',
      palabras: 'globo burbuja mini',
      icono: 'mover',
      ejecutar: () => cambiarAjustes({ flotante: !ajustes.flotante }),
    },
    {
      id: 'globo',
      nombre: ajustes.miniEscondido ? 'Mostrar el globo de música' : 'Esconder el globo de música a un lado',
      grupo: 'Música',
      palabras: 'reproductor mini burbuja ocultar',
      icono: 'esconder',
      ejecutar: () => cambiarAjustes({ miniEscondido: ajustes.miniEscondido ? null : 'derecha' }),
    },
    {
      id: 'reproducir',
      nombre: sonando ? 'Pausar música' : 'Reproducir música',
      grupo: 'Música',
      palabras: 'play pausa cancion',
      icono: sonando ? 'pausa' : 'reproducir',
      ejecutar: alternar,
    },
  ];
}
