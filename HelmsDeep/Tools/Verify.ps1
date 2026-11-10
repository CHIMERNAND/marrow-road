# Marrow Road - automated build verification on the G15.
# 1) syncs D:\Dev\marrow-road to a branch (default main; backs up anything it replaces),
# 2) builds the graybox scene + Windows player with Unity in batch mode,
# 3) runs the player's bot pass (plays the whole night, or -Waves N), at 1920x1080,
# 4) checks report.json against Tools\verify_thresholds.json and the previous run, prints PASS/FAIL.
#
# Usage (PowerShell):
#   powershell -ExecutionPolicy Bypass -File D:\Dev\marrow-road\HelmsDeep\Tools\Verify.ps1 -Branch main
# Options: -Branch <name>  -Waves <n>  -SkipSync  -SkipBuild  -Unity <path>  -TimeoutMinutes <n>
# Results: HelmsDeep\Recordings\verify\<stamp> and HelmsDeep\Recordings\verify\latest (verdict.json inside).
# Exit code 1 when the build fails or a regression rule trips.
param(
    [string]$Repo = "D:\Dev\marrow-road",
    [string]$Branch = "main",
    [string]$Unity = "D:\Unity\Editor\6000.3.26f1\Editor\Unity.exe",
    [int]$Waves = 0,
    [switch]$SkipSync,
    [switch]$SkipBuild,
    [int]$TimeoutMinutes = 30
)

$ErrorActionPreference = "Continue"
$proj = Join-Path $Repo "HelmsDeep"
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"

function Step($msg) { Write-Host ""; Write-Host "== $msg" -ForegroundColor Cyan }

if (Get-Process -Name Unity -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*Unity.exe" }) {
    $lock = Join-Path $proj "Temp\UnityLockfile"
    if (Test-Path $lock) { throw "The Unity editor has this project open. Close it and run again." }
}

$commit = ""
if (-not $SkipSync) {
    Step "Sync $Repo to $Branch"
    Push-Location $Repo
    try {
        git -c safe.directory=* fetch origin
        if ($LASTEXITCODE -ne 0) { throw "git fetch failed" }
        git -c safe.directory=* checkout -f -B $Branch "origin/$Branch"
        if ($LASTEXITCODE -ne 0) { throw "git checkout failed" }
    }
    finally { Pop-Location }
}
Push-Location $Repo
$commit = (git -c safe.directory=* log --oneline -1) -join ""
Pop-Location
Write-Host $commit

if (-not $SkipBuild) {
    Step "Unity batch build (scene + player)"
    if (-not (Test-Path $Unity)) { throw "Unity not found at $Unity" }
    $logDir = Join-Path $proj "Logs"
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    $buildLog = Join-Path $logDir "build_$stamp.log"
    $uargs = @("-batchmode", "-quit", "-projectPath", "`"$proj`"", "-executeMethod", "MarrowRoad.EditorTools.M1Pipeline.BuildAllBatch", "-buildTarget", "Win64", "-logFile", "`"$buildLog`"")
    $p = Start-Process -FilePath $Unity -ArgumentList $uargs -Wait -PassThru
    if ($p.ExitCode -ne 0) {
        Write-Host "Build failed (exit $($p.ExitCode)). Errors:" -ForegroundColor Red
        Select-String -Path $buildLog -Pattern "error CS|Exception|\[MarrowRoad\]" | Select-Object -First 40 | ForEach-Object { $_.Line }
        Get-Content $buildLog -Tail 30
        $failDir = Join-Path $proj "Recordings\verify\latest"
        if (Test-Path $failDir) { Remove-Item $failDir -Recurse -Force }
        New-Item -ItemType Directory -Force -Path $failDir | Out-Null
        Copy-Item $buildLog (Join-Path $failDir "build.log")
        @{ verdict = "FAIL"; commit = $commit; failures = @("Unity build failed (exit $($p.ExitCode))") } | ConvertTo-Json | Set-Content (Join-Path $failDir "verdict.json")
        Write-Host "FAIL - build broken" -ForegroundColor Red
        exit 1
    }
    Select-String -Path $buildLog -Pattern "\[MarrowRoad\]" | ForEach-Object { $_.Line }
}

Step "Bot pass"
$exe = Join-Path $proj "Builds\M1\MarrowRoad.exe"
if (-not (Test-Path $exe)) { throw "Player not found at $exe" }
$root = Join-Path $proj "Recordings\verify"
$out = Join-Path $root $stamp
New-Item -ItemType Directory -Force -Path $out | Out-Null
$playerLog = Join-Path $out "player.log"
$pargs = @("-screen-fullscreen", "0", "-screen-width", "1920", "-screen-height", "1080", "-capture", "`"$out`"", "-logFile", "`"$playerLog`"")
if ($Waves -gt 0) { $pargs += @("-capturewaves", "$Waves") }
$sw = [Diagnostics.Stopwatch]::StartNew()
$run = Start-Process -FilePath $exe -ArgumentList $pargs -PassThru
$timedOut = $false
if (-not $run.WaitForExit($TimeoutMinutes * 60 * 1000)) {
    Write-Host "Bot pass timed out after $TimeoutMinutes min; stopping the player." -ForegroundColor Yellow
    $run.Kill()
    $timedOut = $true
}
Write-Host ("Bot pass took {0:0.0} min" -f $sw.Elapsed.TotalMinutes)

# ---------- Verdict ----------
$latest = Join-Path $root "latest"
$prevReport = $null
$prevPath = Join-Path $latest "report.json"
if (Test-Path $prevPath) { try { $prevReport = Get-Content $prevPath -Raw | ConvertFrom-Json } catch { } }
$thrPath = Join-Path $proj "Tools\verify_thresholds.json"
$t = Get-Content $thrPath -Raw | ConvertFrom-Json

$failures = New-Object System.Collections.ArrayList
$warnings = New-Object System.Collections.ArrayList
$reportPath = Join-Path $out "report.json"
$r = $null
if (Test-Path $reportPath) {
    try { $r = Get-Content $reportPath -Raw | ConvertFrom-Json } catch { [void]$failures.Add("report.json is not valid JSON: $_") }
} else {
    [void]$failures.Add("No report.json (player crashed or hung) - see player.log")
}
if ($timedOut) { [void]$failures.Add("Timed out after $TimeoutMinutes min") }

if ($r) {
    if ($r.error_count -gt $t.max_errors) { [void]$failures.Add("Errors logged: $($r.error_count)") }
    if ($r.spawn_failures -gt $t.max_spawn_failures) { [void]$failures.Add("Spawn failures: $($r.spawn_failures)") }
    if ($r.perf_avg_fps -lt $t.min_avg_fps) { [void]$failures.Add(("Average fps {0:0} < {1}" -f $r.perf_avg_fps, $t.min_avg_fps)) }
    if ($r.perf_p99_ms -gt $t.max_p99_ms) { [void]$failures.Add(("p99 frame {0:0.0} ms > {1} ms" -f $r.perf_p99_ms, $t.max_p99_ms)) }
    if ($r.spike_frames_over_33ms -gt $t.max_spikes_over_33ms) { [void]$warnings.Add("Frames over 33 ms during waves: $($r.spike_frames_over_33ms)") }
    $aborted = ($r.notes | Where-Object { $_ -like "aborted_early*" -or $_ -like "run_budget_exceeded*" })
    if ($t.require_completed_run -and $aborted) { [void]$failures.Add("Run did not complete: $($aborted -join ', ')") }
    if ($prevReport -and $prevReport.wave_reached) {
        $drop = [int]$prevReport.wave_reached - [int]$r.wave_reached
        $sameLength = ([int]$prevReport.waves_total -eq [int]$r.waves_total)
        if ($sameLength -and $drop -gt $t.max_wave_drop_vs_previous) { [void]$failures.Add("Bot reached wave $($r.wave_reached), previous run reached $($prevReport.wave_reached)") }
        if ($prevReport.perf_avg_fps -gt 0) {
            $pct = 100 * ($prevReport.perf_avg_fps - $r.perf_avg_fps) / $prevReport.perf_avg_fps
            if ($pct -gt $t.max_fps_drop_pct_vs_previous) { [void]$failures.Add(("Average fps fell {0:0}% vs previous ({1:0} -> {2:0})" -f $pct, $prevReport.perf_avg_fps, $r.perf_avg_fps)) }
        }
    }
}

$verdict = if ($failures.Count -eq 0) { "PASS" } else { "FAIL" }
$summary = [ordered]@{
    verdict = $verdict
    commit = $commit
    branch = $Branch
    stamp = $stamp
    failures = @($failures)
    warnings = @($warnings)
    previous = if ($prevReport) { [ordered]@{ build = $prevReport.build; wave_reached = $prevReport.wave_reached; avg_fps = $prevReport.perf_avg_fps; p99_ms = $prevReport.perf_p99_ms } } else { $null }
    current = if ($r) { [ordered]@{ build = $r.build; phase_end = $r.phase_end; wave_reached = $r.wave_reached; waves_completed = $r.waves_completed; breach_wave = $r.breach_wave; avg_fps = $r.perf_avg_fps; p99_ms = $r.perf_p99_ms; worst_ms = $r.perf_worst_ms; spikes = $r.spike_frames_over_33ms; errors = $r.error_count } } else { $null }
}
$summary | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $out "verdict.json")

if (Test-Path $latest) { Remove-Item $latest -Recurse -Force }
Copy-Item $out $latest -Recurse

Step "Results in $out (copied to Recordings\verify\latest)"
if ($r) {
    Write-Host ("Build {0}  ended {1}  wave {2}/{3}  breach wave {4}" -f $r.build, $r.phase_end, $r.wave_reached, $r.waves_total, $r.breach_wave)
    Write-Host ("Perf avg {0:0} fps  p99 {1:0.0} ms  worst {2:0.0} ms  spikes>33ms {3}  errors {4}" -f $r.perf_avg_fps, $r.perf_p99_ms, $r.perf_worst_ms, $r.spike_frames_over_33ms, $r.error_count)
    foreach ($w in $r.waves) { Write-Host ("  W{0,-2} {1,5:0}s  kills {2,3}/{3,-3} gate {4,5:0}->{5,-5:0} keep {6,5:0}  downs {7}  shoved {8}" -f $w.wave, $w.duration_s, $w.kills, $w.spawned, $w.gate_start, $w.gate_end, $w.keep_end, $w.downs, $w.shoved) }
}
foreach ($w in $warnings) { Write-Host "warn: $w" -ForegroundColor Yellow }
foreach ($f in $failures) { Write-Host "FAIL: $f" -ForegroundColor Red }
Write-Host ""
if ($verdict -eq "PASS") { Write-Host "PASS" -ForegroundColor Green } else { Write-Host "FAIL" -ForegroundColor Red }
Write-Host "Tell Anton the run finished; it will read Recordings\verify\latest." -ForegroundColor Green
if ($verdict -ne "PASS") { exit 1 }
