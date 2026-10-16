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
    # Clicking the bandeau focuses Pupitre. Treat that as Dofus still being in front, or the
    # bandeau would hide itself the moment it is dragged. The desk window is a different handle.
    $foregroundValue = $foreground.ToInt64()
    $overlayValue = [int64]__OVERLAY_HWND__
    $front = if ($target.MainWindowHandle.ToInt64() -eq $foregroundValue -or $foregroundValue -eq $overlayValue) { 1 } else { 0 }
    $line = "{0},{1},{2},{3},{4},{5}" -f $rect.Left, $rect.Top, $rect.Right, $rect.Bottom, $front, $target.MainWindowHandle.ToInt64()
  }
  if ($line -ne $last) {
    $last = $line
    Write-Output $line
  }
  Start-Sleep -Milliseconds 400
}
