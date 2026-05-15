import os
import sys
from flask import Flask, render_template, request, jsonify, session
import ctypes 
from ctypes import cast, POINTER
import psutil 
from waitress import serve
import subprocess

# --- NEW: Direct Windows COM API Imports ---
from comtypes import CLSCTX_ALL, CoInitialize, CoCreateInstance, GUID
from pycaw.pycaw import IAudioEndpointVolume, IMMDeviceEnumerator
from dotenv import load_dotenv
load_dotenv()
# --- PYINSTALLER MAGIC ---
if getattr(sys, 'frozen', False):
    template_folder = os.path.join(sys._MEIPASS, 'templates')
    app = Flask(__name__, template_folder=template_folder)
else:
    app = Flask(__name__)

# --- SECURITY CONFIGURATION ---
app.secret_key = os.getenv("FLASK_SECRET_KEY", "fallback_default_key") 
SYSTEM_PIN = os.getenv("SYSTEM_PIN", "0000")

# --- HELPER: GET VOLUME OBJECT (BULLETPROOF VERSION) ---
def get_volume_control():
    # Convert the raw string into a proper Windows Kernel GUID object
    MMDeviceEnumerator_ID = GUID("{BCDE0395-E52F-467C-8E3D-C4579291692E}")
    
    deviceEnumerator = CoCreateInstance(
        MMDeviceEnumerator_ID,
        IMMDeviceEnumerator,
        CLSCTX_ALL
    )
    # 0 = Speakers (eRender), 1 = Multimedia (eMultimedia)
    defaultDevice = deviceEnumerator.GetDefaultAudioEndpoint(0, 1)
    interface = defaultDevice.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
    return cast(interface, POINTER(IAudioEndpointVolume))

# --- SECURITY MIDDLEWARE (THE VAULT DOOR) ---
@app.before_request
def security_checkpoint():
    # Always allow the browser to load the main page, static files, and the login routes
    if request.endpoint in ['home', 'login', 'check_status'] or request.path.startswith('/static'):
        return
    
    # If they try to hit ANY /api/ command without logging in, block them!
    if not session.get('authenticated'):
        return jsonify({"error": "System Locked. Access Denied."}), 401

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    if data and data.get("pin") == SYSTEM_PIN:
        session['authenticated'] = True
        return jsonify({"status": "unlocked"})
    return jsonify({"error": "Wrong PIN"}), 401

@app.route('/api/status', methods=['GET'])
def check_status():
    # A silent route the frontend uses to check if it's already logged in
    if session.get('authenticated'):
        return jsonify({"status": "unlocked"})
    return jsonify({"error": "locked"}), 401

# --- THE FRONTEND ROUTE ---
@app.route('/')
def home():
    return render_template('index.html')

# --- SYSTEM STATS & SENSORS ---
@app.route('/api/stats', methods=['GET'])
def get_stats():
    # 1. Safe Battery Check (Handles Desktops without batteries!)
    battery = psutil.sensors_battery()
    if battery is None:
        percent = "N/A"
        is_charging = True # Desktops are always plugged in
    else:
        percent = battery.percent
        is_charging = battery.power_plugged
    
    # 2. Safe Audio Check (Fixes the Waitress Multi-threading crash)
    try:
        CoInitialize() # <--- THE MAGIC FIX
        volume = get_volume_control()
        current_vol = int(volume.GetMasterVolumeLevelScalar() * 100)
    except Exception as e:
        print("Audio read error:", e)
        current_vol = 0 # Fallback so the server doesn't crash
    
    return jsonify({
        "status": "success",
        "battery": percent,
        "charging": is_charging,
        "volume": current_vol
    }), 200

# --- HARDWARE COMMANDS ---
@app.route('/api/volume', methods=['POST'])
def set_volume():
    data = request.json
    level = int(data.get('level', 50)) / 100.0 # Convert 0-100 to 0.0-1.0
    
    try:
        CoInitialize() # <--- THE MAGIC FIX
        volume = get_volume_control()
        volume.SetMasterVolumeLevelScalar(level, None)
        return jsonify({"status": "success", "level": level * 100}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/lock', methods=['POST'])
def lock_pc():
    print("Command: Locking Windows...")
    ctypes.windll.user32.LockWorkStation()
    return jsonify({"status": "success", "message": "PC Locked!"}), 200

@app.route('/api/media', methods=['POST'])
def media_control():
    data = request.json
    action = data.get('action')
    
    # Windows Virtual Key Codes for Media
    if action == 'playpause':
        vk_code = 0xB3
    elif action == 'next':
        vk_code = 0xB0
    elif action == 'prev':
        vk_code = 0xB1
    else:
        return jsonify({"status": "error", "message": "Invalid action"}), 400
        
    print(f"Command: Media {action.upper()}")
    # Press and release the virtual key
    ctypes.windll.user32.keybd_event(vk_code, 0, 0, 0)
    ctypes.windll.user32.keybd_event(vk_code, 0, 2, 0)
    
    return jsonify({"status": "success", "message": f"Media: {action.capitalize()}"}), 200

# --- THE APP LAUNCHER ---
@app.route('/api/launch', methods=['POST'])
def launch_app():
    data = request.json
    app_id = data.get('id')
    
    # Fetch the hidden Windows AppData folder dynamically for Opera
    local_app_data = os.environ.get('LOCALAPPDATA')
    
    # Bulletproof Universal Launch Paths
    app_paths = {
        "chrome": "start chrome",
        "spotify": "start spotify",
        "edge": "start msedge",
        "opera": f'"{local_app_data}\\Programs\\Opera GX\\launcher.exe"'
    }
    
    target_cmd = app_paths.get(app_id)
    
    if not target_cmd:
        return jsonify({"status": "error", "message": "Unknown app"}), 400
        
    print(f"Command: Launching {app_id.capitalize()}...")
    
    try:
        subprocess.Popen(target_cmd, shell=True)
        return jsonify({"status": "success", "message": f"Launched {app_id.capitalize()}!"}), 200
    except Exception as e:
        print("Launch error:", e)
        return jsonify({"status": "error", "message": "Launch failed"}), 500

@app.route('/api/mute', methods=['POST'])
def mute_pc():
    print("Command: Muting Audio...")
    VK_VOLUME_MUTE = 0xAD
    ctypes.windll.user32.keybd_event(VK_VOLUME_MUTE, 0, 0, 0)
    ctypes.windll.user32.keybd_event(VK_VOLUME_MUTE, 0, 2, 0)
    return jsonify({"status": "success", "message": "Audio Toggled!"}), 200

# --- THE APP MANAGER ---
@app.route('/api/apps', methods=['GET'])
def get_apps():
    print("Command: Scanning for active apps...")
    TARGET_APPS = [
        "chrome.exe", "spotify.exe", "msedge.exe", 
        "antigravity.exe", "opera.exe", "launcher.exe" 
    ]
    
    running_apps = set()
    
    for process in psutil.process_iter(['name']):
        try:
            pc_process_name = process.info['name'].lower()
            
            if any(target.lower() == pc_process_name for target in TARGET_APPS):
                display_name = pc_process_name.replace('.exe', '').replace('.root', '').capitalize()
                if "Msedge" in display_name: display_name = "Edge"
                if "Launcher" in display_name: display_name = "Opera"
                
                running_apps.add(display_name)
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass

    return jsonify({"status": "success", "apps": list(running_apps)}), 200

@app.route('/api/kill', methods=['POST'])
def kill_app():
    data = request.json
    target_app = data.get('name')
    print(f"Command: Force closing {target_app}...")
    
    for process in psutil.process_iter(['name']):
        try:
            if target_app.lower() in process.info['name'].lower():
                process.terminate() 
        except:
            pass 
            
    return jsonify({"status": "success", "message": f"Closed {target_app}!"}), 200

# --- IGNITION ---
if __name__ == '__main__':
    print("Starting SYNC Server on port 54321 (PRODUCTION ENGINE)...")
    serve(app, host='0.0.0.0', port=54321)