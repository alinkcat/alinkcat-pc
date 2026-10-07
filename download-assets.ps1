<#
====================================================================
  Alinkcat Theme Assets Downloader  download-assets.ps1
--------------------------------------------------------------------
  Batch-download assets from a manifest JSON, then move to target.

  USAGE:
    # Batch mode (recommended)
    .\download-assets.ps1 -Manifest assets-manifest.json [-BaseDir .]

    # Single task
    .\download-assets.ps1 -Url <url> -File <name.ext> -Dest <dir>

    # Help
    .\download-assets.ps1 -Help

  PARAMETERS:
    -Manifest : path to asset manifest JSON (see README for format)
    -BaseDir  : base directory for relative dest paths (default: pwd)
    -Url      : direct download URL (single-task mode)
    -File     : output filename (with extension)
    -Dest     : output directory (relative to BaseDir, or absolute)
    -Retry    : retry count on failure (default 3)
    -Timeout  : per-request timeout in seconds (default 30)
    -UserAgent: custom User-Agent (some CDNs need this)
    -SkipCheck: skip text/html rejection check (some CDNs behave oddly)

  NOTES:
    - Uses System.Net.WebClient (works on Windows PowerShell 5.1 / PS 7+,
      http/https/file:// schemes).
    - Downloads to <target>.part first, then MOVES to final path on success.
    - Rejects responses whose Content-Type is text/html (hotlink/error pages)
      unless -SkipCheck is set.
====================================================================
#>

param(
  [string]$Manifest,
  [string]$BaseDir = (Get-Location).Path,
  [string]$Url,
  [string]$File,
  [string]$Dest,
  [int]$Retry = 3,
  [int]$Timeout = 30,
  [string]$UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  [switch]$SkipCheck,
  [switch]$Help
)

# ────────── helpers ──────────────────────────────────────────────

function Write-Step  { param([string]$m) Write-Host "`n=== $m ===" -ForegroundColor Magenta }
function Write-OK    { param([string]$m) Write-Host "  [OK]   $m" -ForegroundColor Green }
function Write-Warn  { param([string]$m) Write-Host "  [WARN] $m" -ForegroundColor Yellow }
function Write-Err   { param([string]$m) Write-Host "  [FAIL] $m" -ForegroundColor Red }

function Resolve-DestPath {
  param([string]$DestRel)
  if ([string]::IsNullOrWhiteSpace($DestRel)) { return $BaseDir }
  if ([System.IO.Path]::IsPathRooted($DestRel)) { return $DestRel }
  return (Join-Path $BaseDir $DestRel)
}

# ────────── download engine ──────────────────────────────────────

function Invoke-OneDownload {
  param(
    [hashtable]$Task,
    [string]$TaskBaseDir,
    [int]$TimeoutSec,
    [int]$RetryCount,
    [string]$UA,
    [bool]$SkipHtmlCheck
  )

  $file    = [string]$Task.file
  $url     = [string]$Task.url
  $destAbs = Resolve-DestPath ([string]$Task.dest)
  $minSize = 0
  if ($Task.minSize -ne $null) { $minSize = [long]$Task.minSize }

  if ([string]::IsNullOrWhiteSpace($url)) { Write-Err "$file : url is empty"; return $false }
  if ([string]::IsNullOrWhiteSpace($file)) { Write-Err "entry missing 'file' field"; return $false }

  try { New-Item -ItemType Directory -Force -Path $destAbs | Out-Null }
  catch { Write-Err "cannot create directory $destAbs : $_"; return $false }

  $target = Join-Path $destAbs $file
  $tmp    = "$target.part"

  Write-Host "  - $file" -ForegroundColor Cyan
  Write-Host "    <- $url"

  $attempt = 0
  while ($attempt -le $RetryCount) {
    $attempt++
    $wc = $null
    try {
      $wc = New-Object System.Net.WebClient
      $wc.Headers.Add('User-Agent', $UA)

      # pull synchronously into a temp file (ResponseHeaders are populated after OpenRead, so we can check Content-Type)
      $stream = $wc.OpenRead($url)

      if (-not $SkipHtmlCheck) {
        $ct = ''
        try { $ct = [string]$wc.ResponseHeaders['Content-Type'] } catch { }
        if ($ct -match '^text/html') {
          Write-Warn "got HTML (hotlink protection / error page) (attempt $attempt/$($RetryCount+1))"
          $stream.Dispose(); $wc.Dispose()
          Start-Sleep -Seconds 2
          continue
        }
      }

      $fs = [System.IO.File]::Create($tmp)
      $stream.CopyTo($fs)
      $fs.Dispose(); $stream.Dispose(); $wc.Dispose()

      $len = (Get-Item $tmp).Length
      if ($len -eq 0 -or $len -lt $minSize) {
        Write-Warn "file too small ($len bytes, need >= $minSize) (attempt $attempt/$($RetryCount+1))"
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        continue
      }

      # success -> move into place (overwrite)
      if (Test-Path $target) { Remove-Item $target -Force -ErrorAction SilentlyContinue }
      Move-Item $tmp $target -Force -ErrorAction Stop

      $kb = [math]::Round($len / 1KB, 1)
      Write-OK "$file done ($kb KB) -> $destAbs"
      return $true
    }
    catch {
      Write-Warn "exception: $($_.Exception.Message) (attempt $attempt/$($RetryCount+1))"
      Remove-Item $tmp -Force -ErrorAction SilentlyContinue
      Start-Sleep -Seconds 2
    }
    finally {
      if ($wc) { try { $wc.Dispose() } catch {} }
    }
  }

  Write-Err "$file failed after $RetryCount retries"
  return $false
}

# ────────── main ─────────────────────────────────────────────────

if ($Help) {
  Get-Content $MyInvocation.MyCommand.Path | Select-String -Pattern '^  #' | ForEach-Object { $_.Line }
  exit 0
}

$okCount = 0
$failCount = 0

# -- single task mode --
if ($Url) {
  $task = @{ url = $Url; file = ($File -as [string]); dest = ($Dest -as [string]); minSize = 0 }
  $ok = Invoke-OneDownload $task $BaseDir $Timeout $Retry $UserAgent $SkipCheck.IsPresent
  if ($ok) { $okCount++ } else { $failCount++ }
}
# -- batch manifest mode --
elseif ($Manifest) {
  if (-not (Test-Path $Manifest)) { Write-Err "manifest not found: $Manifest"; exit 1 }
  $json = Get-Content $Manifest -Raw -Encoding UTF8 | ConvertFrom-Json
  $assets = if ($json.assets) { $json.assets } else { $json }

  Write-Step "Downloading $($assets.Count) asset(s)"
  $i = 0
  foreach ($a in $assets) {
    $i++
    Write-Host "`n[$i/$($assets.Count)]" -ForegroundColor Yellow
    $task = @{
      url     = [string]$a.url
      file    = [string]$a.file
      dest    = if ($a.dest) { [string]$a.dest } else { "." }
      minSize = if ($a.minSize -ne $null) { [long]$a.minSize } else { 0 }
    }
    $ok = Invoke-OneDownload $task $BaseDir $Timeout $Retry $UserAgent $SkipCheck.IsPresent
    if ($ok) { $okCount++ } else { $failCount++ }
  }
}
else {
  Write-Err "no task specified. use -Manifest for batch, or -Url -File -Dest for single."
  Write-Err "see .\download-assets.ps1 -Help"
  exit 1
}

Write-Step "Summary"
Write-OK "succeeded: $okCount    failed: $failCount"
if ($failCount -gt 0) {
  Write-Warn "some assets failed. common causes: dead link / hotlink protection / need Referer."
  exit 1
}
exit 0