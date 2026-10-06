import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// The SPA shell is empty on purpose, and hydrating the desk against it
// mismatches. The node build can still render `/` once; that document is what
// the window opens. Other routes keep `_shell.html`. Web builds skip this.
if (process.env.PUPITRE_DESKTOP !== "1") process.exit(0);

const output = path.resolve(".output");
const port = 47399;
const child = spawn(process.execPath, ["server/index.mjs"], {
  cwd: output,
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    NITRO_HOST: "127.0.0.1",
    NITRO_PORT: String(port),
    PORT: String(port),
  },
  stdio: "ignore",
});

async function renderedDesk() {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < 20000) {
    if (child.exitCode != null) {
      throw new Error("Le rendu du bureau s'est arrêté avant d'écrire la page.");
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) {
        const html = Buffer.from(await response.arrayBuffer());
        if (!html.includes("Pupitre")) throw new Error("La page du bureau est vide.");
        return html;
      }
      lastError = new Error(`Réponse ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw lastError instanceof Error ? lastError : new Error("Le rendu du bureau n'a pas démarré.");
}

try {
  const html = await renderedDesk();
  await writeFile(path.join(output, "public", "index.html"), html);
} finally {
  if (child.exitCode == null) child.kill();
}
