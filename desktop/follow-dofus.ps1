$signature = @'
using System;
using System.Runtime.InteropServices;
public static class PupitreWin {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(System.IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern System.IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool IsIconic(System.IntPtr hWnd);
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
'@
Add-Type -TypeDefinition $signature
# Match the game process only: window titles also match browser tabs such as DofusDB.
$last = ""
while ($true) {
  $windows = @(Get-Process -Name "Dofus*" -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 })
  $foreground = [PupitreWin]::GetForegroundWindow()
  $target = $windows | Where-Object { $_.MainWindowHandle -eq $foreground } | Select-Object -First 1
  if ($null -eq $target) { $target = $windows | Select-Object -First 1 }
  $rect = New-Object PupitreWin+RECT
  if ($null -eq $target -or [PupitreWin]::IsIconic($target.MainWindowHandle) -or -not [PupitreWin]::GetWindowRect($target.MainWindowHandle, [ref]$rect)) {
    $line = "none"
  } else {
    $front = if ($target.MainWindowHandle -eq $foreground) { 1 } else { 0 }
    $line = "{0},{1},{2},{3},{4}" -f $rect.Left, $rect.Top, $rect.Right, $rect.Bottom, $front
  }
  if ($line -ne $last) {
    $last = $line
    Write-Output $line
  }
  Start-Sleep -Milliseconds 400
}
