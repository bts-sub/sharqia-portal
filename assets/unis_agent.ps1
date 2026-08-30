param(
  [switch]$Send,
  [switch]$Roster,
  [switch]$Install,
  [int]$InitialDays = 7,
  [string]$Url   = "https://hr.sharqiaa-tech.net/api/device/punches",
  [string]$Token = "92c0774b38330f6b33db7fdf8257005752b640056bd56471"
)
$ErrorActionPreference = "Stop"; $ProgressPreference = "SilentlyContinue"

# --- relaunch in 32-bit if no OLEDB provider here (server has Jet/ACE in 32-bit only) ---
$provs = (New-Object System.Data.OleDb.OleDbEnumerator).GetElements() | Select-Object -Expand SOURCES_NAME
$prov  = @("Microsoft.ACE.OLEDB.16.0","Microsoft.ACE.OLEDB.12.0","Microsoft.Jet.OLEDB.4.0") | Where-Object { $provs -contains $_ } | Select-Object -First 1
if (-not $prov -and [IntPtr]::Size -eq 8) {
  & "$env:WINDIR\SysWOW64\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath @PSBoundParameters
  exit $LASTEXITCODE
}
if (-not $prov) { throw "No OLEDB provider (ACE/Jet) even in 32-bit." }

$Base = "C:\UNIS_Agent"; New-Item -ItemType Directory -Force $Base | Out-Null
$stateFile = "$Base\state.json"; $log = "$Base\agent_$(Get-Date -f yyyyMMdd).log"
function Say($m){ $l = "[{0}] {1}" -f (Get-Date -f HH:mm:ss), $m; Write-Host $l; Add-Content $log $l }

# --- Install as scheduled task (every 5 min, runs 32-bit, survives restart) ---
if ($Install) {
  $ps32 = "$env:WINDIR\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
  $act = New-ScheduledTaskAction -Execute $ps32 -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Send"
  $trg = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)
  $set = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
  Register-ScheduledTask -TaskName "UNIS_Odoo_Agent" -Action $act -Trigger $trg -Settings $set -User "SYSTEM" -RunLevel Highest -Force | Out-Null
  Say "Scheduled task UNIS_Odoo_Agent registered (every 5 min)."; return
}

# --- locate the live UNIS mdb ---
$cands = @()
Get-CimInstance Win32_Service -EA 0 | Where-Object { $_.Name -match "^UNIS_" -and $_.PathName -notmatch "svchost" } |
  ForEach-Object { $d = Split-Path ($_.PathName -replace '^"|"$','') -Parent; if (Test-Path $d) { $cands += $d } }
$cands += "C:\Program Files (x86)\UNIS","C:\Program Files\UNIS","C:\UNIS"
$mdb = $cands | Select-Object -Unique | Where-Object { Test-Path $_ } |
  ForEach-Object { Get-ChildItem $_ -Recurse -Include *.mdb,*.accdb -EA 0 } |
  Where-Object { $_.Name -notmatch "Temp" } | Sort-Object Length -Descending | Select-Object -First 1
if (-not $mdb) { throw "UNIS mdb not found." }

$pw = "unisamho"
$xml = $cands | Select-Object -Unique | Where-Object { Test-Path $_ } |
  ForEach-Object { Get-ChildItem $_ -Recurse -Filter RManager.xml -EA 0 } | Select-Object -First 1
if ($xml) { $mm = Select-String $xml.FullName -Pattern 'UDBAccPwd="([^"]*)"'; if ($mm) { $pw = $mm.Matches[0].Groups[1].Value } }

# --- snapshot the live mdb to a writable folder (Program Files blocks the lock file) ---
$work = "$Base\work"; New-Item -ItemType Directory -Force $work | Out-Null
$snap = "$work\UNIS_snapshot.mdb"
$si = [IO.File]::Open($mdb.FullName,'Open','Read','ReadWrite')
$so = [IO.File]::Open($snap,'Create','Write','None')
$si.CopyTo($so); $so.Close(); $si.Close()

function ToUtc($k){
  try { return ([datetime]::ParseExact("$k","yyyyMMddHHmmss",$null)).AddHours(-3).ToString("yyyy-MM-dd HH:mm:ss") } catch { return $null }
}
function Fill($sql,$conn){ $a=New-Object System.Data.OleDb.OleDbDataAdapter($sql,$conn); $t=New-Object System.Data.DataTable; [void]$a.Fill($t); return ,$t }

# --- ROSTER: pull the device-user list into Odoo for HR to link ---
if ($Roster) {
  $usersUrl = $Url -replace '/punches$','/users'
  $C = New-Object System.Data.OleDb.OleDbConnection("Provider=$prov;Data Source=$snap;Jet OLEDB:Database Password=$pw;Mode=Read")
  $C.Open()
  $agg = Fill "SELECT L_UID, COUNT(*) AS Cnt, MAX(C_Date & C_Time) AS LastK, MIN(C_Date & C_Time) AS FirstK FROM [tEnter] WHERE L_UID > 0 GROUP BY L_UID" $C
  $nm  = Fill "SELECT L_UID, C_Name, COUNT(*) AS c FROM [tEnter] WHERE L_UID > 0 GROUP BY L_UID, C_Name" $C
  $dv  = Fill "SELECT DISTINCT L_UID, L_TID FROM [tEnter] WHERE L_UID > 0" $C
  $C.Close()
  $names=@{}; foreach($r in $nm.Rows){ $u="$($r.L_UID)"; $c=[int]$r.c; if(-not $names.ContainsKey($u) -or $c -gt $names[$u].c){ $names[$u]=@{ n="$($r.C_Name)"; c=$c } } }
  $devs=@{};  foreach($r in $dv.Rows){ $u="$($r.L_UID)"; $tt="{0:D4}" -f [int]$r.L_TID; if(-not $devs.ContainsKey($u)){ $devs[$u]=@() }; if($devs[$u] -notcontains $tt){ $devs[$u]+=$tt } }
  $rows=@()
  foreach($r in $agg.Rows){
    $u="$($r.L_UID)"
    $nameVal = ""; if($names.ContainsKey($u)){ $nameVal = $names[$u].n }
    $devVal = ""; if($devs.ContainsKey($u)){ $devVal = (($devs[$u] | Sort-Object) -join ",") }
    $rows += [ordered]@{
      code=$u
      name=$nameVal
      device_codes=$devVal
      punch_count=[int]$r.Cnt
      first_seen= ToUtc "$($r.FirstK)"
      last_seen=  ToUtc "$($r.LastK)"
    }
  }
  Say "roster users: $($rows.Count) -> $usersUrl"
  $sent=0
  for($i=0;$i -lt $rows.Count;$i+=2000){
    $chunk=@($rows[$i..([math]::Min($i+1999,$rows.Count-1))])
    $body=@{ users=$chunk } | ConvertTo-Json -Depth 5
    $bytes=[Text.Encoding]::UTF8.GetBytes($body)
    $res=Invoke-RestMethod -Uri $usersUrl -Method Post -Body $bytes -ContentType "application/json; charset=utf-8" -Headers @{ Authorization="Bearer $Token" }
    $sent+=$chunk.Count; Say "posted $sent/$($rows.Count)  (created=$($res.created) updated=$($res.updated))"
  }
  Say "roster done."; return
}

# --- high-water mark (yyyyMMddHHmmss). first run: InitialDays back ---
$mark = (Get-Date).AddDays(-$InitialDays).ToString("yyyyMMdd") + "000000"
if (Test-Path $stateFile) { try { $mark = (Get-Content $stateFile -Raw | ConvertFrom-Json).mark } catch {} }
$today1 = (Get-Date).AddDays(1).ToString("yyyyMMdd")

$C = New-Object System.Data.OleDb.OleDbConnection("Provider=$prov;Data Source=$snap;Jet OLEDB:Database Password=$pw;Mode=Read")
$C.Open()
$sql = "SELECT C_Date,C_Time,L_TID,L_UID,C_Unique,C_Name,L_MatchingType,L_Result FROM [tEnter] " +
       "WHERE (C_Date & C_Time) > '$mark' AND L_UID > 0 AND C_Date <= '$today1' ORDER BY C_Date, C_Time"
$dt = Fill $sql $C; $C.Close()
Say "mark=$mark  new punches: $($dt.Rows.Count)"
if ($dt.Rows.Count -eq 0) { Say "nothing new."; return }

# --- build batch: Riyadh(UTC+3) -> UTC, unique_key = TID|UID|Date|Time ---
$batch = @(); $newMark = $mark
foreach ($row in $dt.Rows) {
  $d = "$($row.C_Date)"; $t = ("{0:D6}" -f [int]"$($row.C_Time)")
  $utc = ToUtc "$d$t"; if (-not $utc) { continue }
  $tid = "{0:D4}" -f [int]$row.L_TID
  $batch += [ordered]@{
    unique_key  = "$tid|$($row.L_UID)|$d|$t"
    device_code = $tid
    device_user_id = "$($row.L_UID)"
    user_name   = "$($row.C_Name)"
    punch_utc   = $utc
    raw_date    = $d
    raw_time    = $t
    match_type  = [int]$row.L_MatchingType
    result      = [int]$row.L_Result
  }
  if ("$d$t" -gt $newMark) { $newMark = "$d$t" }
}

# --- dry-run: CSV only. -Send: POST batches of 200 ---
if (-not $Send) {
  $csv = "$Base\pending_$(Get-Date -f yyyyMMdd_HHmmss).csv"
  $batch | ForEach-Object { [pscustomobject]$_ } | Export-Csv $csv -NoTypeInformation -Encoding UTF8
  Say "DRY-RUN: wrote $($batch.Count) rows -> $csv  (mark NOT advanced). Review, then run with -Send."
  return
}

$sent = 0; $created = 0; $matched = 0
for ($i = 0; $i -lt $batch.Count; $i += 200) {
  $chunk = @($batch[$i..([math]::Min($i+199,$batch.Count-1))])
  $body  = @{ punches = $chunk } | ConvertTo-Json -Depth 5
  $bytes = [Text.Encoding]::UTF8.GetBytes($body)
  $res = Invoke-RestMethod -Uri $Url -Method Post -Body $bytes -ContentType "application/json; charset=utf-8" -Headers @{ Authorization = "Bearer $Token" }
  $sent += $chunk.Count; $created += [int]$res.created; $matched += [int]$res.matched
  Say "posted $sent/$($batch.Count)  (created=$($res.created) matched=$($res.matched) skipped=$($res.skipped))"
}
@{ mark = $newMark; at = (Get-Date).ToString("s") } | ConvertTo-Json | Set-Content $stateFile -Encoding UTF8
Say "done. sent=$sent created=$created matched=$matched  new mark=$newMark"
