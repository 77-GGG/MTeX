// Typed wrapper around window.mtexAPI
// The actual API is exposed via preload.ts contextBridge

declare global {
  interface Window {
    mtexAPI: import('../../main/preload').MTeXAPI;
  }
}

export const api = window.mtexAPI;
