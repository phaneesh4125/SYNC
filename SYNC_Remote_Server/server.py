from flask import Flask, request, jsonify, render_template
import ctypes 
import psutil # Added our new scanner library

app = Flask(__name__)
SECRET_TOKEN = "sync_remote_2026"

# --- SECURITY MIDDLEWARE ---
@app.before_request
def verify_token():
    if request.path == '/':
        return None 
        
    auth_header = request.headers.get("Authorization")
    if auth_header != f"Bearer {SECRET_TOKEN}":
        return jsonify({"status": "error", "message": "Access Denied"}), 401

# --- THE FRONTEND ROUTE ---
@app.route('/')
def home():
    return render_template('index.html')

# --- HARDWARE COMMANDS ---
@app.route('/api/lock', methods=['POST'])
def lock_pc():
    print("Command: Locking Windows...")
    ctypes.windll.user32.LockWorkStation()
    return jsonify({"status": "success", "message": "PC Locked!"}), 200

@app.route('/api/mute', methods=['POST'])
def mute_pc():
    print("Command: Muting Audio...")
    VK_VOLUME_MUTE = 0xAD
    ctypes.windll.user32.keybd_event(VK_VOLUME_MUTE, 0, 0, 0)
    ctypes.windll.user32.keybd_event(VK_VOLUME_MUTE, 0, 2, 0)
    return jsonify({"status": "success", "message": "Audio Toggled!"}), 200

# --- THE APP MANAGER (NEW DAY 8 CODE) ---
@app.route('/api/apps', methods=['GET'])
def get_apps():
    print("Command: Scanning for active apps...")
    TARGET_APPS = ["chrome.exe", "SpotifyLauncher.exe", "WhatsApp.Root.exe", "msedge.exe", "Antigravity.exe"]
    
    # We use a Python 'set' to automatically prevent duplicates
    running_apps = set()
    
    for process in psutil.process_iter(['name']):
        try:
            if process.info['name'] in TARGET_APPS:
                # If we find it, add the clean name (e.g., "Chrome" instead of "chrome.exe")
                name = process.info['name'].replace('.exe', '').replace('.Root', '')
                running_apps.add(name)
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass

    # We convert the set back to a list so it can be sent as JSON
    return jsonify({"status": "success", "apps": list(running_apps)}), 200
@app.route('/api/kill', methods=['POST'])
def kill_app():
    # We expect the phone to send us JSON telling us WHICH app to close
    data = request.json
    target_app = data.get('name')
    print(f"Command: Force closing {target_app}...")
    
    # We ask psutil to search all running processes
    for process in psutil.process_iter(['name']):
        try:
            # If the clean name (like "chrome") is inside the real name (like "chrome.exe")
            if target_app.lower() in process.info['name'].lower():
                process.terminate() # This is the kill shot
        except:
            pass # Ignore system files we can't touch
            
    return jsonify({"status": "success", "message": f"Closed {target_app}!"}), 200
if __name__ == '__main__':
    print("Starting SYNC Server on port 54321...")
    app.run(host='0.0.0.0', port=54321)