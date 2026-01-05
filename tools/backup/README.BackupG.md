# Backup tool: one rolling snapshot for D:\G

## What it does
`backup-G.ps1` creates **one** ZIP snapshot of `D:\G` into `D:\G Back` and always **overwrites** the same archive name, so you don't accumulate hundreds of backups.

Default output:
- Folder: `D:\G Back`
- Archive: `G.latest.zip`

The ZIP contains the top-level folder `G\...` inside (safer restore: unzip to `D:\`).

## Run
PowerShell (copy-paste)

```powershell
cd D:\G
powershell -ExecutionPolicy Bypass -File ".\tools\backup\backup-G.ps1"
```

## Optional args
```powershell
powershell -ExecutionPolicy Bypass -File ".\tools\backup\backup-G.ps1" -ArchiveName "G.before-antigravity.zip"
```

## Restore idea (manual)
- Rename current `D:\G` to `D:\G.broken` (or move away)
- Unzip `D:\G Back\G.latest.zip` to `D:\`
- You’ll get `D:\G\...` back
