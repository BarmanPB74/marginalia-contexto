# PRODUCTO — qué es y qué NO es

## Propósito
Un cuaderno digital local para guardar notas y estudios, con la sensación de escribir en papel. Pensado para alguien que valora el orden, el silencio visual y los detalles.

## Usuario objetivo (v1)
Una persona que estudia por su cuenta (idiomas, programación, ciberseguridad…), escucha música mientras estudia y quiere recordar **qué sonaba** y **cuándo** estudió cada cosa. Usa Android. Privacidad por defecto.

## Las cuatro secciones (navegación inferior)

| Sección | Qué hace |
|---|---|
| **Notas** | Árbol de páginas; cada página es un `.md`. Editor Markdown + modo lectura. Búsqueda. |
| **Calendario** | Vista de mes tipo Google Calendar. Cada día muestra las notas que tienen etiqueta de fecha. Tocar un día lista sus notas. |
| **Música** | Pegar/compartir un enlace de YouTube Music → reproductor incrustado. Lista de canciones guardadas. |
| **Ajustes** | Tema papel, tamaño de texto, carpeta de exportación, bloqueo, acerca de / licencias. |

Más un **mini-reproductor** persistente (franja fina sobre la navegación) cuando hay canción activa.

## Historias de usuario (criterio de aceptación = demostrable)

1. *Como estudiante, creo una página, escribo en Markdown y la veo renderizada.*
2. *Organizo páginas dentro de otras páginas (árbol).*
3. *Etiqueto una nota con una fecha y la veo aparecer en ese día del calendario.*
4. *Reproduzco una canción de YouTube Music y, mientras suena, creo una nota que guarda canción + segundo (p. ej. 1:39).*
5. *Al abrir esa nota, toco la etiqueta ♪ y la canción se reproduce desde ese segundo.*
6. *Busco texto en todas mis notas, también por etiqueta (#estudio) o por fecha.*
7. *Exporto todas mis notas como carpeta de `.md` / ZIP y las importo de nuevo sin pérdida.*

## Fuera de alcance (v1) — NO construir
- Cuentas, sincronización en la nube, colaboración en tiempo real.
- Base de datos tipo Notion (tablas con vistas, relaciones, fórmulas).
- Descargar o reproducir música offline; reproducción en segundo plano forzada.
- Cualquier uso de APIs no oficiales de YouTube.
- Analíticas, anuncios, tienda, suscripciones.
- IA integrada, plugins de terceros, temas de colores múltiples.
- Versión iOS / escritorio (la base web lo permitirá luego, pero no ahora).

## Ideas diferidas (banco, no se construyen sin decisión explícita)
Modo nocturno "papel de noche", vista semana/agenda avanzada, sincronización opcional vía Syncthing (los `.md` ya lo permiten), plantillas de nota, repetición espaciada para estudios, widget de inicio.

## Métricas de "terminado" de la v1
- Las 7 historias funcionan en un teléfono real.
- 0 hallazgos críticos/altos abiertos en la auditoría de la Fase 5.
- APK firmado publicado en GitHub Releases con README claro.
