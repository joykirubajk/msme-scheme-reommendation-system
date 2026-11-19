# Runs all three test suites (Windows PowerShell). Exit code 1 if any suite fails.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$failed = $false

Write-Host '== Backend (Jest + Supertest) =='
Push-Location "$root\Backend"; npm test; if ($LASTEXITCODE -ne 0) { $failed = $true }; Pop-Location

Write-Host '== Ranking service (pytest) =='
$py = "$root\ranking-service\.venv\Scripts\python.exe"
if (-not (Test-Path $py)) { $py = 'python' }
Push-Location "$root\ranking-service"; & $py -m pytest -q; if ($LASTEXITCODE -ne 0) { $failed = $true }; Pop-Location

Write-Host '== Frontend (React Testing Library) =='
Push-Location "$root\Frontend"; $env:CI = 'true'; npx react-scripts test --watchAll=false; if ($LASTEXITCODE -ne 0) { $failed = $true }; Remove-Item Env:CI; Pop-Location

if ($failed) { Write-Host 'SOME SUITES FAILED'; exit 1 } else { Write-Host 'ALL SUITES PASSED'; exit 0 }
