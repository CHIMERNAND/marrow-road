# Launch Helms Deep with FFmpeg gameplay recording enabled.
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$exe = Join-Path $here "HelmsDeep.exe"
if (-not (Test-Path $exe)) {
    Write-Error "Missing HelmsDeep.exe next to this script. Build first."
}

$env:HELMS_RECORD = "1"
$toolsFfmpeg = Join-Path (Split-Path (Split-Path $here -Parent) -Parent) "Tools\ffmpeg.exe"
if (Test-Path $toolsFfmpeg) {
    $env:FFMPEG_PATH = $toolsFfmpeg
}

Write-Host "Recording to ..\..\Recordings\ (F9 toggles). Starting..."
Start-Process -FilePath $exe -ArgumentList "-record" -WorkingDirectory $here -Wait
Write-Host "Done. Check HelmsDeep\Recordings for mp4 + txt sidecars."
