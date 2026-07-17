// Exposes a tiny settings store to the page.
//
// The page cannot use localStorage for this: the server picks a free port on
// every launch, and browser storage is keyed by origin *including the port* —
// so http://127.0.0.1:49916 and http://127.0.0.1:51308 are different sites and
// yesterday's saved API key is invisible today. Settings therefore live in the
// main process, keyed to the app rather than to whatever port it grabbed.
//
// contextBridge only, no node in the renderer: the page is served over HTTP and
// must never get filesystem access.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("shortsStore", {
  get: (key) => ipcRenderer.invoke("settings:get", key),
  set: (key, value) => ipcRenderer.invoke("settings:set", key, value),
});
