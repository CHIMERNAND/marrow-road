# Marrow Road - M1 verification on the G15.
# Superseded by Tools\Verify.ps1 (M2+); kept for the M1 record.
# 1) syncs D:\Dev\marrow-road to the m1/graybox-slice branch (backs up anything it replaces),
# 2) builds the graybox scene + Windows player with Unity in batch mode,
# 3) runs the player's automated capture pass at 1920x1080 and prints report.json.
#
# Usage (PowerShell):
#   powershell -ExecutionPolicy Bypass -File D:\Dev\marrow-road\HelmsDeep\Tools\M1Verify.ps1
# Options: -SkipSync  -SkipBuild  -Branch <name>  -Unity <path to Unity.exe>
param(
    [string]$Repo = "D:\Dev\marrow-road",
    [string]$Branch = "m1/graybox-slice",
    [string]$Unity = "D:\Unity\Editor\6000.3.26f1\Editor\Unity.exe",
    [switch]$SkipSync,
    [switch]$SkipBuild,
    [int]$TimeoutMinutes = 15
)

$ErrorActionPreference = "Continue"
$proj = Join-Path $Repo "HelmsDeep"
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"

function Step($msg) { Write-Host ""; Write-Host "== $msg" -ForegroundColor Cyan }

if (Get-Process -Name Unity -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*Unity.exe" }) {
    $lock = Join-Path $proj "Temp\UnityLockfile"
    if (Test-Path $lock) { throw "The Unity editor has this project open. Close it and run again." }
}

if (-not $SkipSync) {
    Step "Sync $Repo to $Branch"
    Push-Location $Repo
    try {
        $backup = Join-Path (Split-Path $Repo -Parent) ("marrow-road-backup\" + $stamp)
        New-Item -ItemType Directory -Force -Path $backup | Out-Null
        foreach ($f in @(".gitignore", "README.md")) { if (Test-Path $f) { Copy-Item $f $backup -Force } }
        git fetch origin
        if ($LASTEXITCODE -ne 0) { throw "git fetch failed" }
        # Legacy scripts moved to Assets/Legacy on this branch; park the old untracked copy so classes aren't duplicated.
        $oldScripts = Join-Path $proj "Assets\Scripts"
        $tracked = git ls-files -- "HelmsDeep/Assets/Scripts"
        if ((Test-Path $oldScripts) -and -not $tracked) {
            Move-Item $oldScripts (Join-Path $backup "Scripts") -Force
            if (Test-Path "$oldScripts.meta") { Move-Item "$oldScripts.meta" (Join-Path $backup "Scripts.meta") -Force }
            Write-Host "Parked old Assets/Scripts in $backup"
        }
        git checkout -f -B $Branch "origin/$Branch"
        if ($LASTEXITCODE -ne 0) { throw "git checkout failed" }
        git log --oneline -1
    }
    finally { Pop-Location }
}

if (-not $SkipBuild) {
    Step "Unity batch build (scene + player). First run reimports and can take several minutes."
    if (-not (Test-Path $Unity)) { throw "Unity not found at $Unity" }
    $logDir = Join-Path $proj "Logs"
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    $buildLog = Join-Path $logDir "m1_build_$stamp.log"
    $uargs = @("-batchmode", "-quit", "-projectPath", "`"$proj`"", "-executeMethod", "MarrowRoad.EditorTools.M1Pipeline.BuildAllBatch", "-buildTarget", "Win64", "-logFile", "`"$buildLog`"")
    $p = Start-Process -FilePath $Unity -ArgumentList $uargs -Wait -PassThru
    if ($p.ExitCode -ne 0) {
        Write-Host "Build failed (exit $($p.ExitCode)). Last log lines:" -ForegroundColor Red
        Get-Content $buildLog -Tail 60
        Select-String -Path $buildLog -Pattern "error CS|Exception|\[MarrowRoad\]" | Select-Object -First 40 | ForEach-Object { $_.Line }
        exit 1
    }
    Select-String -Path $buildLog -Pattern "\[MarrowRoad\]" | ForEach-Object { $_.Line }
}

Step "Run capture pass"
$exe = Join-Path $proj "Builds\M1\MarrowRoad.exe"
if (-not (Test-Path $exe)) { throw "Player not found at $exe" }
$out = Join-Path $proj "Recordings\m1\$stamp"
New-Item -ItemType Directory -Force -Path $out | Out-Null
$playerLog = Join-Path $out "player.log"
$pargs = @("-screen-fullscreen", "0", "-screen-width", "1920", "-screen-height", "1080", "-m1capture", "`"$out`"", "-logFile", "`"$playerLog`"")
$run = Start-Process -FilePath $exe -ArgumentList $pargs -PassThru
if (-not $run.WaitForExit($TimeoutMinutes * 60 * 1000)) {
    Write-Host "Capture timed out after $TimeoutMinutes min; stopping the player." -ForegroundColor Yellow
    $run.Kill()
}

$latest = Join-Path $proj "Recordings\m1\latest"
if (Test-Path $latest) { Remove-Item $latest -Recurse -Force }
Copy-Item $out $latest -Recurse
Step "Results in $out (copied to Recordings\m1\latest)"
Get-ChildItem $out | Select-Object Name, Length | Format-Table -AutoSize
$report = Join-Path $out "report.json"
if (Test-Path $report) { Get-Content $report } else { Write-Host "No report.json - see $playerLog" -ForegroundColor Red; Get-Content $playerLog -Tail 40 }
Write-Host ""
Write-Host "Done. Tell Anton the run finished; it will read Recordings\m1\latest." -ForegroundColor Green
