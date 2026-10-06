# Licencias de terceros (auditoría F5, 2026-10-06)

Todo lo que entra en el APK es compatible con la licencia MIT del proyecto. Generado con
`npm ls --omit=dev --all` (dependencias de producción) y revisado a mano para Android.

## JavaScript (entra en el bundle de la app)
| Paquete | Versión | Licencia | Nota |
|---|---|---|---|
| preact | 11.0.0 | MIT | |
| @capacitor/core, @capacitor/android | 8.5.2 | MIT | |
| @capacitor/filesystem | 8.1.4 | MIT | |
| @capacitor/synapse | 1.0.4 | ISC | dependencia de Capacitor |
| @codemirror/* (state, view, commands, language, autocomplete) | 6.x | MIT | |
| @lezer/* (common, lr, highlight, markdown) | 1.x | MIT | |
| @marijn/find-cluster-break, crelt, style-mod, w3c-keyname | — | MIT | dependencias de CodeMirror |
| markdown-it | 15.0.2 | MIT | |
| linkify-it, mdurl, uc.micro, punycode.js | — | MIT | dependencias de markdown-it |
| entities | 8.1.0 | BSD-2-Clause | exige atribución → incluir aviso en F6 (pantalla «Acerca de») |
| argparse | 3.0.2 | PSF-2.0 | solo la CLI de markdown-it; no entra al bundle |
| dompurify | 3.4.16 | MPL-2.0 o Apache-2.0 | usamos Apache-2.0 |
| yaml | 2.9.1 | ISC | |
| fflate | 0.8.3 | MIT | |
| tslib | 2.8.1 | 0BSD | |
| @types/trusted-types | 2.0.7 | MIT | solo tipos |

## Android (nativo)
| Componente | Licencia | Nota |
|---|---|---|
| AndroidX (appcompat, coordinatorlayout, core-splashscreen, webkit…) | Apache-2.0 | vía Capacitor |
| Spotify App Remote SDK 0.8.0 (`.aar`) | Apache-2.0 | ADR-013; descargado y verificado por SHA256 en CI |
| Gson 2.14.0 | Apache-2.0 | lo exige el SDK de Spotify |
| androidx.biometric 1.1.0 | Apache-2.0 | bloqueo con huella/PIN (ADR-014) |

## Recursos
| Recurso | Licencia | Nota |
|---|---|---|
| Newsreader, Kalam, JetBrains Mono | OFL-1.1 | `OFL.txt` en cada carpeta de `src/assets/fonts/` |
| Marca EK (icono) | **no MIT** | ver README y LEGAL §4 |

## Herramientas de desarrollo (no entran al APK)
vite, @preact/preset-vite, typescript (Apache-2.0), eslint y typescript-eslint, vitest, jsdom, @playwright/test (Apache-2.0), @capacitor/cli: MIT salvo lo indicado. `lightningcss` (MPL-2.0) solo como herramienta de build, sin modificar.

## Pendiente para F6
- Pantalla o archivo «Avisos de terceros» en la app con los textos de licencia de entities (BSD-2), Apache-2.0 (AndroidX, Spotify SDK, Gson, DOMPurify) y OFL.
