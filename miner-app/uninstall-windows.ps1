# ============================================
#   Krelz Network Miner - Windows Uninstall
# ============================================
# Usage (PowerShell):
#   powershell -ExecutionPolicy Bypass -File .\uninstall-windows.ps1
# ============================================

$ErrorActionPreference = "Stop"
$KRELZ_VERSION = "3.42.0"
$INSTALL_DIR = "$HOME\krelz-miner"
$TASK_NAME = "KrelzMiner"

function Unregister-Miner {
  $cfgPath = "$INSTALL_DIR\miner-app\config.json"
  if (Test-Path $cfgPath) {
    try { $tok = (Get-Content $cfgPath -Raw | ConvertFrom-Json).miner_token } catch { $tok = "" }
    if ($tok) {
      Write-Host "  Notifying krelz.xyz..."
      try {
        $r = Invoke-RestMethod -Uri https://krelz.xyz/api/miners/unregister -Method POST `
          -Body (@{ miner_token = $tok } | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 15
        if ($r.success) { Write-Host "  ✓ Removed from your Krelz dashboard (earnings kept in History)" -ForegroundColor Green }
      } catch { Write-Host "  ! Could not reach krelz.xyz - remove it from the dashboard (My Miners)" -ForegroundColor Yellow }
    }
  }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "  Krelz Miner Uninstaller (Windows) v$KRELZ_VERSION" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""
Write-Host "  What do you want to remove?"
Write-Host ""
Write-Host "  1) Miner only (task + app files)"
Write-Host "  2) Everything (miner + Ollama + all downloaded models)"
Write-Host "  0) Cancel"
Write-Host ""

$choice = Read-Host "  Choice [0-2]"

switch ($choice) {
  "1" {
    Write-Host ""
    Write-Host "Removing miner..." -ForegroundColor Yellow
    Unregister-Miner
    Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "  ✓ Scheduled task removed" -ForegroundColor Green
    if (Test-Path $INSTALL_DIR) {
      Remove-Item -Recurse -Force $INSTALL_DIR
      Write-Host "  ✓ Miner files removed" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "  Miner removed successfully!" -ForegroundColor Green
    Write-Host "  Ollama and models are still installed."
  }
  "2" {
    Write-Host ""
    Write-Host "Removing everything..." -ForegroundColor Red
    Unregister-Miner
    Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false -ErrorAction SilentlyContinue
    if (Test-Path $INSTALL_DIR) {
      Remove-Item -Recurse -Force $INSTALL_DIR
      Write-Host "  ✓ Miner files removed" -ForegroundColor Green
    }
    try { Stop-Process -Name ollama -Force -ErrorAction SilentlyContinue } catch {}
    if (Test-Path "$HOME\.ollama") {
      Remove-Item -Recurse -Force "$HOME\.ollama"
      Write-Host "  ✓ Ollama models removed" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "  To also remove Ollama itself: winget uninstall Ollama.Ollama"
    Write-Host ""
    Write-Host "  Everything removed successfully!" -ForegroundColor Green
  }
  "0" { Write-Host "  Cancelled."; exit 0 }
  default { Write-Host "  Invalid choice." -ForegroundColor Red; exit 1 }
}
