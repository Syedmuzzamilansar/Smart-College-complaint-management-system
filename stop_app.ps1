#!/usr/bin/env powershell
<#
Smart CMS — App Stopper
Safely terminates Flask and frees port 5001
#>

Write-Output @"
╔════════════════════════════════════════════════════════════════╗
║  Smart CMS — Stop App                                        ║
╚════════════════════════════════════════════════════════════════╝
"@

$port = 5001
Write-Output "`nStopping Flask app on port $port..."

# Get all connections on the port
$connections = @(Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue)

if ($connections.Count -eq 0) {
    Write-Output "✓ Port $port is already free"
    exit 0
}

# Kill processes holding the port
$killed = @()
foreach ($conn in $connections) {
    if ($conn.OwningProcess) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Output "  Terminating: $($proc.Name) (PID $($conn.OwningProcess))"
            taskkill /PID $conn.OwningProcess /F /T 2>$null
            $killed += $conn.OwningProcess
        }
    }
}

if ($killed.Count -gt 0) {
    Start-Sleep -Milliseconds 500
    $remaining = @(Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }).Count
    if ($remaining -eq 0) {
        Write-Output "✓ Port $port freed successfully"
    } else {
        Write-Output "✗ Port $port still in use (may be in TIME_WAIT state)"
    }
} else {
    Write-Output "✗ Could not find process on port $port"
}

Write-Output "`n✓ Done!"
