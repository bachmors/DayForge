"""
DayForge Local Agent
Runs on each machine (PC, Laptop) to execute local apps and files.
Listens on localhost:5555 for launch commands from the DayForge web frontend.

Usage:
  python dayforge_agent.py

Requirements:
  pip install fastapi uvicorn

Built with ∞ love by Hypatia & Carles
"""

import os
import sys
import socket
import subprocess
import platform
from datetime import datetime

try:
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    import uvicorn
except ImportError:
    print("❌ Instala dependencias: pip install fastapi uvicorn")
    sys.exit(1)

# ─── Config ───────────────────────────────────────────
AGENT_PORT = 5555
DEVICE_NAME = os.environ.get("DAYFORGE_DEVICE_NAME", socket.gethostname())

app = FastAPI(title=f"DayForge Agent — {DEVICE_NAME}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow DayForge frontend from any Railway URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Models ───────────────────────────────────────────
class LaunchRequest(BaseModel):
    type: str  # app, file, url
    path: str
    browser: str = "chrome"  # chrome, edge, default

class LaunchResponse(BaseModel):
    success: bool
    message: str
    device: str = DEVICE_NAME

# ─── Endpoints ────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "name": DEVICE_NAME,
        "hostname": socket.gethostname(),
        "platform": platform.system(),
        "time": datetime.now().isoformat()
    }

@app.post("/launch")
async def launch(req: LaunchRequest):
    """Launch an app, file, or URL on this machine"""
    try:
        if platform.system() == "Windows":
            return await launch_windows(req)
        elif platform.system() == "Darwin":
            return await launch_mac(req)
        else:
            return await launch_linux(req)
    except Exception as e:
        return LaunchResponse(success=False, message=str(e))

async def launch_windows(req: LaunchRequest):
    """Launch on Windows using PowerShell Start-Process"""
    if req.type == "url":
        if req.browser == "edge":
            cmd = f'Start-Process "msedge.exe" -ArgumentList "{req.path}"'
        elif req.browser == "chrome":
            cmd = f'Start-Process "chrome.exe" -ArgumentList "{req.path}"'
        else:
            cmd = f'Start-Process "{req.path}"'
    elif req.type == "app":
        cmd = f'Start-Process "{req.path}"'
    elif req.type == "file":
        cmd = f'Start-Process "{req.path}"'
    else:
        return LaunchResponse(success=False, message=f"Unknown type: {req.type}")
    
    result = subprocess.run(
        ["powershell", "-Command", cmd],
        capture_output=True, text=True, timeout=10
    )
    
    if result.returncode == 0:
        return LaunchResponse(success=True, message=f"Launched: {req.path}")
    else:
        return LaunchResponse(success=False, message=f"Error: {result.stderr[:200]}")

async def launch_mac(req: LaunchRequest):
    """Launch on macOS using open command"""
    if req.type == "url":
        subprocess.Popen(["open", req.path])
    elif req.type in ("app", "file"):
        subprocess.Popen(["open", req.path])
    return LaunchResponse(success=True, message=f"Launched: {req.path}")

async def launch_linux(req: LaunchRequest):
    """Launch on Linux using xdg-open"""
    subprocess.Popen(["xdg-open", req.path])
    return LaunchResponse(success=True, message=f"Launched: {req.path}")

@app.get("/catalog")
async def catalog():
    """List known app paths on this machine"""
    apps = []
    
    if platform.system() == "Windows":
        # Common Windows app locations
        user = os.path.expanduser("~")
        scan_dirs = [
            os.path.join(user, "AppData", "Local", "Programs"),
            "C:\\Program Files",
            "C:\\Program Files (x86)",
        ]
        
        for scan_dir in scan_dirs:
            if os.path.exists(scan_dir):
                for root, dirs, files in os.walk(scan_dir):
                    for f in files:
                        if f.endswith('.exe') and not f.startswith('unins'):
                            apps.append({
                                "name": f.replace('.exe', ''),
                                "path": os.path.join(root, f),
                                "dir": root
                            })
                    # Don't go deeper than 3 levels
                    if root.count(os.sep) - scan_dir.count(os.sep) >= 3:
                        dirs.clear()
    
    return {
        "device": DEVICE_NAME,
        "platform": platform.system(),
        "app_count": len(apps),
        "apps": apps[:200]  # Limit to 200
    }

# ─── Main ─────────────────────────────────────────────
if __name__ == "__main__":
    print(f"""
╔══════════════════════════════════════════╗
║     🔨 DayForge Local Agent             ║
║     Device: {DEVICE_NAME:<28s}║
║     Port:   {AGENT_PORT:<28d}║
║     Status: Running                      ║
╚══════════════════════════════════════════╝
    """)
    uvicorn.run(app, host="127.0.0.1", port=AGENT_PORT, log_level="info")
