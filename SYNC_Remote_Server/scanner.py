import psutil
import json

print("Scanning and Filtering Windows Processes...\n")

# --- THE WHITELIST ---
# We only want to see these specific apps. 
# You can add or remove exact names from your terminal list here!
TARGET_APPS = [
    "chrome.exe", 
    "SpotifyLauncher.exe", 
    "WhatsApp.Root.exe", 
    "msedge.exe", 
    "Antigravity.exe"
]

# We will store our clean data in this empty list
clean_app_list = []

for process in psutil.process_iter(['pid', 'name']):
    try:
        app_name = process.info['name']
        app_pid = process.info['pid']
        
        # Check if the app is on our VIP Whitelist
        if app_name in TARGET_APPS:
            # Add it to our clean list formatted as a dictionary
            clean_app_list.append({
                "name": app_name,
                "pid": app_pid
            })
            
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
        pass

# Print the final result formatted as beautiful JSON
print(json.dumps(clean_app_list, indent=4))
print("\nFilter Complete.")