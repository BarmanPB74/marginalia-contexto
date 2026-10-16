/*
 * Stark para Windows (ADR-017): la misma app web (dist/) dentro de una ventana de Electron.
 * - Se sirve desde app://stark/ (no file://): rutas absolutas de Vite, contexto seguro para
 *   WebCrypto e IndexedDB propio y persistente en %APPDATA%\Stark.
 * - Sin red: toda petición que no sea app:// se bloquea. Sin Node en la página
 *   (contextIsolation + sandbox); el único puente es preload.cjs (safeStorage).
 * - Una sola instancia: dos ventanas escribiendo el mismo diario lo romperían.
 */
'use strict';
const { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, safeStorage, session, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ORIGEN = 'app://stark';
const WEB = path.join(__dirname, 'web');

app.setName('Stark');
app.setAppUserModelId('io.github.barmanpb74.stark');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const v = BrowserWindow.getAllWindows()[0];
    if (v) {
      if (v.isMinimized()) v.restore();
      v.focus();
    }
  });
  app.whenReady().then(arrancar);
}

/** Ruta dentro de web/ sin poder salir de ella (../). Rutas desconocidas → index.html. */
function archivoDe(url) {
  const { pathname } = new URL(url);
  const relativa = decodeURIComponent(pathname).replace(/^\/+/, '');
  const ruta = path.normalize(path.join(WEB, relativa));
  if (ruta !== WEB && !ruta.startsWith(WEB + path.sep)) return null;
  return relativa === '' ? path.join(WEB, 'index.html') : ruta;
}

function validarB64(texto) {
  if (typeof texto !== 'string' || texto.length === 0 || texto.length > 8192 || !/^[A-Za-z0-9+/]+=*$/.test(texto)) {
    throw new Error('dato no válido');
  }
  return texto;
}

function arrancar() {
  Menu.setApplicationMenu(null);
  const ses = session.defaultSession;

  protocol.handle('app', async (pedido) => {
    if (new URL(pedido.url).host !== 'stark') return new Response('', { status: 404 });
    const ruta = archivoDe(pedido.url);
    if (!ruta) return new Response('', { status: 403 });
    const respuesta = await net.fetch(pathToFileURL(ruta).toString()).catch(() => null);
    if (respuesta && respuesta.ok) return respuesta;
    return net.fetch(pathToFileURL(path.join(WEB, 'index.html')).toString());
  });

  // Sin red (como el APK sin INTERNET): solo app://, data:, blob: y los archivos de web/.
  const webUrl = pathToFileURL(WEB).toString() + '/';
  ses.webRequest.onBeforeRequest((detalles, responder) => {
    const permitido = /^(app|data|blob|devtools):/.test(detalles.url) || detalles.url.startsWith(webUrl);
    responder({ cancel: !permitido });
  });
  // Ningún permiso del navegador (cámara, micrófono, ubicación, notificaciones…).
  ses.setPermissionRequestHandler((_wc, _permiso, responder) => responder(false));
  ses.setPermissionCheckHandler(() => false);

  // Exportaciones (CSV, ZIP, copias): preguntar dónde guardar, empezando en Documentos\Stark.
  ses.on('will-download', (_e, item) => {
    item.setSaveDialogOptions({ defaultPath: path.join(app.getPath('documents'), 'Stark', item.getFilename()) });
  });

  ipcMain.handle('boveda:disponible', () => safeStorage.isEncryptionAvailable());
  ipcMain.handle('boveda:envolver', (_e, clave) =>
    safeStorage.encryptString(validarB64(clave)).toString('base64'),
  );
  ipcMain.handle('boveda:desenvolver', (_e, envuelta) =>
    safeStorage.decryptString(Buffer.from(validarB64(envuelta), 'base64')),
  );

  crearVentana();
}

function crearVentana() {
  const ventana = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 360,
    minHeight: 560,
    title: 'Stark',
    backgroundColor: '#E8ECF4',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
    },
  });
  ventana.once('ready-to-show', () => {
    ventana.maximize();
    ventana.show();
  });

  // Enlaces externos (p. ej. licencias): al navegador del sistema, nunca dentro de la app.
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  ventana.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGEN + '/')) e.preventDefault();
  });
  ventana.webContents.on('will-attach-webview', (e) => e.preventDefault());

  // Cerrar con la caja abierta es válido (la caja sigue abierta mañana), pero se avisa.
  ventana.on('close', (e) => {
    const r = dialog.showMessageBoxSync(ventana, {
      type: 'question',
      buttons: ['Salir', 'Cancelar'],
      defaultId: 1,
      cancelId: 1,
      title: 'Stark',
      message: '¿Salir de Stark?',
      detail: 'Todo lo registrado ya está guardado. Si la caja está abierta, seguirá abierta al volver.',
    });
    if (r === 1) e.preventDefault();
  });

  ventana.loadURL(ORIGEN + '/');
}

app.on('window-all-closed', () => app.quit());
