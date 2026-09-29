$signature = @'
using System;
using System.Runtime.InteropServices;
public static class PupitreWin {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(System.IntPtr hWnd, out RECT rect);
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
'@
Add-Type -TypeDefinition $signature
while ($true) {
  $proc = Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 -and ($_.ProcessName -eq "Dofus" -or $_.MainWindowTitle -like "*Dofus*") -and $_.MainWindowTitle -notlike "*Pupitre*" } |
    Select-Object -First 1
  if ($null -eq $proc) {
    Write-Output "none"
  } else {
    $rect = New-Object PupitreWin+RECT
    $ok = [PupitreWin]::GetWindowRect($proc.MainWindowHandle, [ref]$rect)
    if ($ok) {
      Write-Output ("{0},{1},{2},{3}" -f $rect.Left, $rect.Top, $rect.Right, $rect.Bottom)
    } else {
      Write-Output "none"
    }
  }
  Start-Sleep -Milliseconds 800
}
