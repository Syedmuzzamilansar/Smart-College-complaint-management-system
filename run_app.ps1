# Smart CMS - Safe App Startup Script
# This script cleans up any lingering processes before starting the Flask app
# Usage: ./run_app.ps1

Write-Host "╔════════════════════════════════════════════════════════════════╗"
Write-Host "║  Smart CMS — Safe App Startup                               ║"
Write-Host "╚════════════════════════════════════════════════════════════════╝"
Write-Host ""

# Define ports to check
$ports = @(5001, 5000)

# Step 1: Clean up lingering processes
Write-Host "Step 1: Cleaning up any lingering processes..."
$conns = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ports -contains $_.LocalPort }

if ($conns) {
    foreach ($conn in $conns) {
        $pid = $conn.OwningProcess
        Write-Host "  ⚠  Found process PID=$pid on port $($conn.LocalPort)"
        try {
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Write-Host "  ✓ Killed PID=$pid"
        } catch {
            Write-Host "  ✗ Could not kill PID=$pid — it may already be closing"
        }
    }
    Start-Sleep -Milliseconds 500
} else {
    Write-Host "  ✓ No lingering processes found"
}

# Step 2: Verify ports are free
Write-Host ""
Write-Host "Step 2: Verifying ports are free..."
$remaining = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ports -contains $_.LocalPort }

if ($remaining) {
    Write-Host "  ✗ WARNING: Ports still occupied:"
    $remaining | Select-Object LocalPort,OwningProcess | Format-Table -AutoSize
    Write-Host ""
    Write-Host "  Waiting 2 seconds and retrying..."
    Start-Sleep -Seconds 2
    
    $remaining = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ports -contains $_.LocalPort }
    if ($remaining) {
        Write-Host "  ✗ ERROR: Could not free ports. Try restarting your computer."
        exit 1
    }
}

Write-Host "  ✓ All ports are free"

# Step 3: Activate virtual environment
Write-Host ""
Write-Host "Step 3: Activating virtual environment..."
& ".\.venv\Scripts\Activate.ps1"

# Step 4: Start the app
Write-Host ""
Write-Host "Step 4: Starting Flask app..."
Write-Host "════════════════════════════════════════════════════════════════"
Write-Host ""
Write-Host "🌐 Homepage: http://127.0.0.1:5001/"
Write-Host "Press CTRL+C to stop the server"
Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════"
Write-Host ""

& ".\.venv\Scripts\python.exe" app.py

Write-Host ""
Write-Host "✓ App stopped. Goodbye!"
