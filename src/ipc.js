/**
 * ipc.js – bezpieczny wrapper dla ipcRenderer
 *
 * W środowisku Electron (production/dev z nodeIntegration):
 *   zwraca prawdziwy ipcRenderer z window.require('electron')
 *
 * W przeglądarce (vite dev bez Electrona):
 *   zwraca mock który loguje wywołania zamiast crashować.
 *   Dzięki temu `npm run dev` działa normalnie w przeglądarce.
 */

function createMockIpc() {
  const listeners = {};
  return {
    send: (channel, ...args) => {
      console.debug(`[IPC mock] send: ${channel}`, ...args);
    },
    invoke: async (channel, ...args) => {
      console.debug(`[IPC mock] invoke: ${channel}`, ...args);
      return null;
    },
    on: (channel, handler) => {
      if (!listeners[channel]) listeners[channel] = [];
      listeners[channel].push(handler);
      console.debug(`[IPC mock] on: ${channel}`);
    },
    removeListener: (channel, handler) => {
      if (listeners[channel]) {
        listeners[channel] = listeners[channel].filter(h => h !== handler);
      }
    },
    // Pomocnicza metoda do testowania w dev: symuluje zdarzenie z main procesu
    _emit: (channel, ...args) => {
      if (listeners[channel]) listeners[channel].forEach(h => h({}, ...args));
    },
  };
}

let ipcRenderer;

try {
  // Działa tylko w Electron z nodeIntegration: true
  if (typeof window !== 'undefined' && window.require) {
    ipcRenderer = window.require('electron').ipcRenderer;
  } else {
    ipcRenderer = createMockIpc();
  }
} catch {
  ipcRenderer = createMockIpc();
}

export { ipcRenderer };
