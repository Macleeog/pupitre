const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

function existingFile(file) {
  try {
    if (fs.statSync(file).isFile()) return file;
  } catch {
    // Not there.
  }
  return null;
}

// A real file wins. A page path falls back to the SPA shell, so /overlay and /avis
// open the same client. A missing asset stays a 404, otherwise the browser would
// try to run index.html as JavaScript.
function shellFile(rootAbs) {
  return (
    existingFile(path.join(rootAbs, "index.html")) ||
    existingFile(path.join(rootAbs, "_shell.html")) ||
    existingFile(path.join(rootAbs, "_shell", "index.html")) ||
    existingFile(path.join(rootAbs, "_shell"))
  );
}

function fileFor(root, pathname) {
  const rootAbs = path.resolve(root);
  let rel = pathname;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  rel = rel.replace(/\\/g, "/").replace(/^\/+/, "");
  if (rel.includes("\0")) return null;
  const abs = path.resolve(rootAbs, rel);
  if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) return null;
  const direct = rel ? existingFile(abs) : null;
  if (direct) return direct;
  if (rel !== "" && path.extname(rel)) return null;
  return existingFile(path.join(abs, "index.html")) || shellFile(rootAbs);
}

function hasAppShell(root) {
  return Boolean(shellFile(path.resolve(root)));
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  if (TYPES[ext]) return TYPES[ext];
  // TanStack sometimes writes the SPA shell as `_shell` with no extension.
  if (!ext) return "text/html; charset=utf-8";
  return "application/octet-stream";
}

function startStaticServer(root, port) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const file = fileFor(root, url.pathname);
    if (!file) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("introuvable");
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      "content-type": contentType(file),
      "cache-control": ext && ext !== ".html" ? "public, max-age=31536000, immutable" : "no-cache",
    });
    const stream = fs.createReadStream(file);
    stream.on("error", () => {
      if (!res.writableEnded) res.end();
    });
    stream.pipe(res);
  });
  return new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once("error", onError);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", onError);
      resolve(server);
    });
  });
}

module.exports = { fileFor, hasAppShell, startStaticServer };
