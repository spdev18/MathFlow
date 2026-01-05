<# 
backup-G.ps1
Creates/overwrites a single snapshot ZIP of D:\G into "D:\G Back".
- Always overwrites the same archive name (no archive pile-up).
- By default includes the folder name "G" inside the ZIP (safer restore).
#>

param(
  [string]$SourcePath = "D:\G",
  [string]$DestDir    = "D:\G Back",
  [string]$ArchiveName = "G.latest.zip"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $SourcePath)) {
  throw "SourcePath does not exist: $SourcePath"
}

if (-not (Test-Path -LiteralPath $DestDir)) {
  New-Item -ItemType Directory -Path $DestDir | Out-Null
}

$destZip = Join-Path $DestDir $ArchiveName
$tmpZip  = Join-Path $DestDir ($ArchiveName + ".tmp")

# If a temp archive exists from a previous crash — remove it.
if (Test-Path -LiteralPath $tmpZip) {
  Remove-Item -LiteralPath $tmpZip -Force
}

# Create ZIP (write to tmp first, then swap — avoids leaving a broken ZIP on disk)
# NOTE: Using $SourcePath (not "$SourcePath\*") so the ZIP contains top-level folder "G".
Compress-Archive -Path $SourcePath -DestinationPath $tmpZip -Force

# Replace old ZIP atomically
if (Test-Path -LiteralPath $destZip) {
  Remove-Item -LiteralPath $destZip -Force
}
Move-Item -LiteralPath $tmpZip -Destination $destZip -Force

Write-Host ("OK: Snapshot created -> " + $destZip)
