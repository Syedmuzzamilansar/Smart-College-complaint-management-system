#!/usr/bin/env python3
"""
Smart CMS — Safe App Runner with Port Management
This script ensures clean startup and shutdown, preventing port lingering issues
"""
import os
import subprocess
import sys
import socket
import time
import signal
import runpy
from pathlib import Path

def is_port_in_use(port):
    """Check if a port is currently in use"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(0.4)
    result = sock.connect_ex(('127.0.0.1', port))
    sock.close()
    return result == 0


def _windows_listener_pids(port):
    """Return listener PIDs for a given port on Windows."""
    result = subprocess.run(
        'netstat -ano -p tcp',
        shell=True,
        capture_output=True,
        text=True,
    )
    pids = set()
    for raw_line in (result.stdout or '').splitlines():
        line = raw_line.strip()
        if not line or 'LISTENING' not in line:
            continue
        parts = line.split()
        # Expected: Proto LocalAddress ForeignAddress State PID
        if len(parts) < 5:
            continue
        local_addr = parts[1]
        state = parts[3]
        pid_str = parts[4]
        if state != 'LISTENING':
            continue
        if not local_addr.endswith(f':{port}'):
            continue
        try:
            pid = int(pid_str)
        except ValueError:
            continue
        if pid > 0 and pid != os.getpid():
            pids.add(pid)
    return sorted(pids)

def kill_process_on_port(port):
    """Attempt to kill any process holding the given port"""
    try:
        if sys.platform == 'win32':
            # Windows: only kill LISTENING PIDs for this exact port.
            pids = _windows_listener_pids(port)
            if not pids:
                return
            for pid in pids:
                subprocess.run(
                    f'taskkill /PID {pid} /T /F',
                    shell=True,
                    capture_output=True,
                    text=True,
                )
                print(f"  Killed PID {pid}")
            time.sleep(0.5)
        else:
            # Unix/Linux/Mac
            result = subprocess.run(
                f'lsof -tiTCP:{port} -sTCP:LISTEN',
                shell=True,
                capture_output=True,
                text=True
            )
            for pid in (result.stdout or '').splitlines():
                pid = pid.strip()
                if not pid:
                    continue
                os.kill(int(pid), 9)
                print(f"  Killed PID {pid}")
            time.sleep(0.5)
    except Exception as e:
        print(f"  Note: {e}")

def main():
    print("╔════════════════════════════════════════════════════════════════╗")
    print("║  Smart CMS — Safe App Runner                                 ║")
    print("╚════════════════════════════════════════════════════════════════╝\n")
    
    port = int(os.getenv('PORT', 5001))
    
    # Check and clean port
    print(f"Checking port {port}...")
    if is_port_in_use(port):
        print(f"⚠  Port {port} is in use, attempting to clean up...")
        kill_process_on_port(port)
        time.sleep(0.5)
        if is_port_in_use(port):
            print(f"✗ Could not free port {port}")
            print("  Try restarting your computer or manually killing the process")
            sys.exit(1)
    
    print(f"✓ Port {port} is free\n")
    
    # Get the directory of this script
    script_dir = Path(__file__).parent
    app_file = script_dir / 'app.py'
    
    if not app_file.exists():
        print(f"✗ app.py not found at {app_file}")
        sys.exit(1)
    
    print(f"Starting Flask app from {app_file}...\n")
    print("════════════════════════════════════════════════════════════════")
    print(f"🌐 Homepage: http://127.0.0.1:{port}/")
    print("Press CTRL+C to stop\n")
    print("════════════════════════════════════════════════════════════════\n")
    
    # Run the app in-process so CTRL+C terminates the same Python process.
    try:
        runpy.run_path(str(app_file), run_name='__main__')
    except KeyboardInterrupt:
        print("\n✓ Shutting down...")
    except Exception as e:
        print(f"\n✗ Error: {e}")
        sys.exit(1)
    
    # Verify port is freed after exit
    print("Checking if port was released...")
    time.sleep(0.5)
    if is_port_in_use(port):
        print(f"⚠  Port {port} still in use, cleaning up...")
        kill_process_on_port(port)
    else:
        print(f"✓ Port {port} freed successfully")
    
    print("✓ Done!")
    sys.exit(0)

if __name__ == '__main__':
    main()
