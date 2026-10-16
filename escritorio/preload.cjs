/*
 * Único puente entre la página y Windows (ADR-017): envolver la clave de cifrado con
 * safeStorage (DPAPI, ligada a la cuenta de Windows). La página no recibe nada más.
 */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stark', {
  escritorio: true,
  boveda: {
    disponible: () => ipcRenderer.invoke('boveda:disponible'),
    envolver: (clave) => ipcRenderer.invoke('boveda:envolver', String(clave)),
    desenvolver: (envuelta) => ipcRenderer.invoke('boveda:desenvolver', String(envuelta)),
  },
});
