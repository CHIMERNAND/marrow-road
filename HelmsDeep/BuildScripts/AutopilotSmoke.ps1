# Smoke-test a HelmsDeep build with autopilot + recording.
# Exit codes mirror the game harness: 0 victory/smoke ok, 1 defeat, 2 timeout, other = launch/error.
param(
    [int]$MaxWaves = 2,
    [int]$MaxSeconds = 180,
    [double]$Timescale = 2.0,
    [switch]$FullRun
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$exe = Join-Path $here "HelmsDeep.exe"
if (-not (Test-Path $exe)) {
    Write-Error "Missing HelmsDeep.exe. Build first."
}

$projectRoot = Resolve-Path (Join-Path $here "..\..")
$toolsFfmpeg = Join-Path $projectRoot "Tools\ffmpeg.exe"
if (Test-Path $toolsFfmpeg) {
    $env:FFMPEG_PATH = $toolsFfmpeg
}

$env:HELMS_AUTOPILOT = "1"
$env:HELMS_RECORD = "1"
$env:HELMS_QUIT_AFTER_END = "1"
$env:HELMS_TIMESCALE = "$Timescale"
$env:HELMS_MAX_SECONDS = "$MaxSeconds"

$args = @("-autopilot", "-record", "-quit-after-end", "-max-seconds", "$MaxSeconds", "-timescale", "$Timescale")
if (-not $FullRun) {
    $env:HELMS_MAX_WAVES = "$MaxWaves"
    $args += @("-max-waves", "$MaxWaves")
    Write-Host "Autopilot smoke: first $MaxWaves waves, timescale=$Timescale, timeout=${MaxSeconds}s"
} else {
    Remove-Item Env:HELMS_MAX_WAVES -ErrorAction SilentlyContinue
    Write-Host "Autopilot full run: all waves, timescale=$Timescale, timeout=${MaxSeconds}s"
}

$proc = Start-Process -FilePath $exe -ArgumentList $args -WorkingDirectory $here -PassThru -Wait
$code = $proc.ExitCode
$rec = Join-Path $here "Recordings"
Write-Host "Exit code: $code"
Write-Host "Reports: $rec\runs\"
Write-Host "Videos:  $rec\"
if (Test-Path (Join-Path $rec "runs")) {
    Get-ChildItem (Join-Path $rec "runs") | Sort-Object LastWriteTime -Descending | Select-Object -First 3 | ForEach-Object {
        Write-Host "--- $($_.Name) ---"
        Get-Content $_.FullName -TotalCount 20
    }
}
exit $code
