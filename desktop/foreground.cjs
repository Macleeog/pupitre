const { spawn } = require("node:child_process");
const readline = require("node:readline");

// Watches the Dofus window the player is using: title and screen rectangle.
// It does not send anything to the game. When several Dofus windows are open,
// the last one that was in front is kept, including while Pupitre itself is in front.
const SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class PupitreFg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
'@
$script:tracked = [IntPtr]::Zero
while ($true) {
  $fg = [PupitreFg]::GetForegroundWindow()
  $fgPid = [uint32]0
  [void][PupitreFg]::GetWindowThreadProcessId($fg, [ref]$fgPid)
  $fgProc = Get-Process -Id $fgPid -ErrorAction SilentlyContinue
  if ($fgProc -and $fgProc.ProcessName -match '^Dofus') { $script:tracked = $fg }
  $alive = $script:tracked -ne [IntPtr]::Zero -and [PupitreFg]::IsWindow($script:tracked) -and [PupitreFg]::IsWindowVisible($script:tracked)
  if (-not $alive) {
    $script:tracked = [IntPtr]::Zero
    $wins = @(Get-Process | Where-Object { $_.ProcessName -match '^Dofus' -and $_.MainWindowHandle -ne 0 })
    if ($wins.Count -eq 1) { $script:tracked = [IntPtr]$wins[0].MainWindowHandle }
  }
  $name = ''
  $title = ''
  $x = 0
  $y = 0
  $w = 0
  $h = 0
  if ($script:tracked -ne [IntPtr]::Zero) {
    $pidOf = [uint32]0
    [void][PupitreFg]::GetWindowThreadProcessId($script:tracked, [ref]$pidOf)
    $proc = Get-Process -Id $pidOf -ErrorAction SilentlyContinue
    if ($proc) { $name = [string]$proc.ProcessName }
    $buf = New-Object System.Text.StringBuilder 512
    [void][PupitreFg]::GetWindowText($script:tracked, $buf, $buf.Capacity)
    $title = [string]$buf
    $rect = New-Object PupitreFg+RECT
    if ([PupitreFg]::GetWindowRect($script:tracked, [ref]$rect)) {
      $x = [int]$rect.Left
      $y = [int]$rect.Top
      $w = [int]($rect.Right - $rect.Left)
      $h = [int]($rect.Bottom - $rect.Top)
    }
  }
  $name = $name -replace "[\\r\\n\\t]", ' '
  $title = $title -replace "[\\r\\n\\t]", ' '
  $tab = [char]9
  Write-Output ($name + $tab + $title + $tab + $x + $tab + $y + $tab + $w + $tab + $h)
  Start-Sleep -Milliseconds 700
}
`;

function parseWindowLine(line) {
  const parts = String(line).split("\t");
  if (parts.length < 6) return null;
  const x = Number(parts[2]);
  const y = Number(parts[3]);
  const width = Number(parts[4]);
  const height = Number(parts[5]);
  const rect =
    Number.isFinite(x) && Number.isFinite(y) && width >= 80 && height >= 80 && x > -10000 && y > -10000
      ? { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }
      : null;
  return { processName: parts[0], title: parts[1], rect };
}

function startForegroundWatch(onWindow) {
  if (process.platform !== "win32" || typeof onWindow !== "function") return { stop() {} };
  const encoded = Buffer.from(SCRIPT, "utf16le").toString("base64");
  const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], {
    windowsHide: true,
    stdio: ["ignore", "pipe", "ignore"],
  });
  readline.createInterface({ input: child.stdout }).on("line", (line) => {
    const parsed = parseWindowLine(line);
    if (parsed) onWindow(parsed);
  });
  return {
    stop() {
      if (!child.killed) child.kill();
    },
  };
}

module.exports = { startForegroundWatch, parseWindowLine };
