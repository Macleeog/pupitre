declare global {
  interface ImportMetaEnv {
    readonly VITE_PUPITRE_VERSION?: string;
  }
}

// Baked in by Vite from package.json, so the desk, the overlay and the packaged exe
// show Pupitre's version rather than Electron's.
export const APP_VERSION: string = import.meta.env.VITE_PUPITRE_VERSION || "dev";
