#!/usr/bin/env sh
# Descarga el SDK oficial de Spotify App Remote (Apache-2.0) y comprueba su huella antes de usarlo.
# No se guarda en el repositorio: se baja al compilar (CI) a android/app/libs/.
set -eu
VERSION="0.8.0"
ETIQUETA="v0.8.0-appremote_v2.1.0-auth"
SHA256="b5a6dd880eaf01f63a871cba9ef7af77c341f8a94ffc8fdf2e9021f9a9d4c198"
DESTINO="android/app/libs/spotify-app-remote-release-${VERSION}.aar"
mkdir -p android/app/libs
curl -fsSL -o "$DESTINO" "https://github.com/spotify/android-sdk/releases/download/${ETIQUETA}/spotify-app-remote-release-${VERSION}.aar"
echo "${SHA256}  ${DESTINO}" | sha256sum -c -
