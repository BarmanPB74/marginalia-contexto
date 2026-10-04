/*
 * Galería interna de componentes (F1): todo el sistema de diseño en una pantalla para revisarlo de un vistazo.
 * No se enlaza desde la app; se abre con #/galeria. Los textos son de ejemplo.
 */
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { Boton } from '../ui/Boton';
import { CampoTexto } from '../ui/CampoTexto';
import { CeldaDia } from '../ui/CeldaDia';
import { Encabezado } from '../ui/Encabezado';
import { Etiqueta } from '../ui/Etiqueta';
import { Icono, NOMBRES_ICONO } from '../ui/Icono';
import { Interruptor } from '../ui/Interruptor';
import { Pagina } from '../ui/Pagina';
import { Tarjeta } from '../ui/Tarjeta';
import { CANCION_DEMO } from '../features/musica/demo';
import { MiniReproductor } from '../features/musica/MiniReproductor';
import { Reproductor } from '../features/musica/Reproductor';
import './Galeria.css';

function Muestra({ nombre, children }: { nombre: string; children: ComponentChildren }) {
  return (
    <section class="muestra" aria-labelledby={`muestra-${nombre}`}>
      <h2 class="muestra__nombre" id={`muestra-${nombre}`}>
        {nombre}
      </h2>
      <div class="muestra__contenido">{children}</div>
    </section>
  );
}

// Una semana de ejemplo: [día, notas, hoy, fuera de mes]
const SEMANA: [number, number, boolean, boolean][] = [
  [29, 0, false, true],
  [30, 1, false, true],
  [1, 0, false, false],
  [2, 2, true, false],
  [3, 0, false, false],
  [4, 5, false, false],
  [5, 1, false, false],
];

export function Galeria() {
  const [titulo, setTitulo] = useState('');
  const [lectura, setLectura] = useState(true);
  const [sinConexion, setSinConexion] = useState(false);
  const [sonando, setSonando] = useState(true);

  return (
    <Pagina>
      <Encabezado titulo="Galería" accion={{ etiqueta: 'Volver', alTocar: () => (location.hash = '#/notas') }} />

      <Muestra nombre="Tipografía">
        <p class="galeria-mano">Apuntes de armonía</p>
        <p>
          La <em>quinta justa</em> suena estable porque sus frecuencias guardan una razón simple. <strong>Pendiente:</strong>{' '}
          repasar <mark>los acordes de séptima</mark> y anotar dudas en <a href="#/galeria">la página de teoría</a>.
        </p>
        <p class="galeria-secundario">Texto secundario · hace 5 min</p>
        <p>
          <code>tempo = 92</code>
        </p>
      </Muestra>

      <Muestra nombre="Icono">
        <div class="galeria-fila">
          {NOMBRES_ICONO.map((nombre) => (
            <Icono key={nombre} nombre={nombre} tamano={32} />
          ))}
        </div>
      </Muestra>

      <Muestra nombre="Boton">
        <div class="galeria-fila">
          <Boton>Guardar</Boton>
          <Boton variante="texto">Cancelar</Boton>
          <Boton desactivado>Desactivado</Boton>
        </div>
      </Muestra>

      <Muestra nombre="Etiqueta">
        <div class="galeria-fila">
          <Etiqueta tipo="cancion">♪ Canción de ejemplo · 1:24</Etiqueta>
          <Etiqueta tipo="fecha">@ 12 oct</Etiqueta>
          <Etiqueta>estudio</Etiqueta>
        </div>
      </Muestra>

      <Muestra nombre="Tarjeta">
        <Tarjeta>
          <p class="galeria-mano">Ideas para el viernes</p>
          <p class="galeria-secundario">3 tareas · editada ayer</p>
        </Tarjeta>
      </Muestra>

      <Muestra nombre="CampoTexto">
        <CampoTexto etiqueta="Título" valor={titulo} alCambiar={setTitulo} marcador="Sin título" />
      </Muestra>

      <Muestra nombre="Interruptor">
        <Interruptor etiqueta="Abrir notas en modo lectura" activo={lectura} alCambiar={setLectura} />
        <Interruptor etiqueta="Ejemplo apagado" activo={sinConexion} alCambiar={setSinConexion} />
      </Muestra>

      <Muestra nombre="CeldaDia">
        <div class="galeria-semana">
          {SEMANA.map(([dia, notas, hoy, fuera]) => (
            <CeldaDia key={`${dia}-${fuera}`} dia={dia} notas={notas} hoy={hoy} fuera={fuera} />
          ))}
        </div>
      </Muestra>

      <Muestra nombre="Reproductor">
        <Reproductor {...CANCION_DEMO} sonando={sonando} alAlternar={() => setSonando(!sonando)} />
      </Muestra>

      <Muestra nombre="MiniReproductor">
        <MiniReproductor {...CANCION_DEMO} modo="en-linea" sonando={sonando} alAlternar={() => setSonando(!sonando)} />
      </Muestra>
    </Pagina>
  );
}
