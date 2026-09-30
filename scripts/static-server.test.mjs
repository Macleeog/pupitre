import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { fileFor, hasAppShell, startStaticServer } = require("../desktop/static.cjs");

test("les pages tombent sur le shell, un fichier manquant non", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pupitre-static-"));
  try {
    await writeFile(path.join(root, "index.html"), "<p>pupitre</p>");
    await writeFile(path.join(root, "app.js"), "ok");
    assert.equal(fileFor(root, "/"), path.join(root, "index.html"));
    assert.equal(fileFor(root, "/overlay"), path.join(root, "index.html"));
    assert.equal(fileFor(root, "/avis"), path.join(root, "index.html"));
    assert.equal(fileFor(root, "/app.js"), path.join(root, "app.js"));
    assert.equal(fileFor(root, "/missing.js"), null);
    assert.equal(fileFor(root, "/../package.json"), null);

    const server = await startStaticServer(root, 0);
    const { port } = server.address();
    const page = await fetch(`http://127.0.0.1:${port}/overlay`);
    const script = await fetch(`http://127.0.0.1:${port}/missing.js`);
    assert.equal(await page.text(), "<p>pupitre</p>");
    assert.equal(page.headers.get("content-type"), "text/html; charset=utf-8");
    assert.equal(script.status, 404);
    await new Promise((resolve) => server.close(resolve));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("le shell SPA _shell.html sert les routes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pupitre-static-"));
  try {
    await writeFile(path.join(root, "_shell.html"), "<p>shell</p>");
    await writeFile(path.join(root, "app.js"), "console.log(1)");
    assert.equal(hasAppShell(root), true);
    assert.equal(fileFor(root, "/"), path.join(root, "_shell.html"));
    assert.equal(fileFor(root, "/avis"), path.join(root, "_shell.html"));
    assert.equal(fileFor(root, "/app.js"), path.join(root, "app.js"));

    const server = await startStaticServer(root, 0);
    const { port } = server.address();
    const page = await fetch(`http://127.0.0.1:${port}/avis?m=%7B%7D`);
    const script = await fetch(`http://127.0.0.1:${port}/app.js`);
    assert.equal(page.status, 200);
    assert.equal(await page.text(), "<p>shell</p>");
    assert.equal(page.headers.get("content-type"), "text/html; charset=utf-8");
    assert.equal(script.headers.get("content-type"), "text/javascript; charset=utf-8");
    await new Promise((resolve) => server.close(resolve));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("un shell sans extension est servi en HTML", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pupitre-static-"));
  try {
    await writeFile(path.join(root, "_shell"), "<p>nu</p>");
    assert.equal(hasAppShell(root), true);
    const server = await startStaticServer(root, 0);
    const { port } = server.address();
    const page = await fetch(`http://127.0.0.1:${port}/overlay`);
    assert.equal(page.status, 200);
    assert.equal(page.headers.get("content-type"), "text/html; charset=utf-8");
    assert.equal(await page.text(), "<p>nu</p>");
    await new Promise((resolve) => server.close(resolve));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("un dossier vide n'a pas de shell", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pupitre-static-"));
  try {
    assert.equal(hasAppShell(root), false);
    assert.equal(fileFor(root, "/"), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("un dossier index.html gagne sur le shell", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pupitre-static-"));
  try {
    await mkdir(path.join(root, "overlay"));
    await writeFile(path.join(root, "index.html"), "shell");
    await writeFile(path.join(root, "overlay", "index.html"), "bandeau");
    assert.equal(fileFor(root, "/overlay"), path.join(root, "overlay", "index.html"));
    assert.equal(fileFor(root, "/"), path.join(root, "index.html"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
