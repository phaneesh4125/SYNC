import pystray
from PIL import Image, ImageDraw
import subprocess
import sys
import os
from dotenv import load_dotenv

# 1. Load the variables from the .env file
load_dotenv()

server_process = None
ngrok_process = None

def start_workers():
    global server_process, ngrok_process
    
    # 2. Fetch the domain securely
    ngrok_domain = os.getenv('NGROK_DOMAIN')
    
    # Safety Check: If the .env is missing or empty, don't crash silently
    if not ngrok_domain:
        print("ERROR: NGROK_DOMAIN not found in .env file!")
        return

    print("Starting background services...")
    
    # Start your Python Server invisibly (Listening on 54321)
    server_process = subprocess.Popen(
        ['server.exe'], # <--- Make sure this says server.exe!
        creationflags=0x08000000 
    )
    
    # Start Ngrok invisibly using the dynamic variable
    ngrok_process = subprocess.Popen(
        ['ngrok', 'http', f'--domain={ngrok_domain}', '127.0.0.1:54321'], 
        creationflags=0x08000000 
    )

def stop_workers():
    global server_process, ngrok_process
    
    print("Shutting down services...")
    
    # 1. Kill Ngrok politely
    if ngrok_process:
        ngrok_process.terminate()
        ngrok_process = None
        
    # 2. Forcefully kill ALL instances of server.exe
    # This cleans up both the bootloader and the actual engine process
    try:
        subprocess.run(['taskkill', '/F', '/IM', 'server.exe', '/T'], 
                       creationflags=0x08000000, 
                       capture_output=True)
        print("All server processes cleared.")
    except Exception as e:
        print(f"Cleanup note: {e}")

    # Clear the handle
    server_process = None

def quit_app(icon, item):
    stop_workers()
    icon.stop()

def create_default_icon():
    image = Image.new('RGB', (64, 64), color=(20, 20, 20))
    draw = ImageDraw.Draw(image)
    draw.rectangle([16, 16, 48, 24], fill="white")
    draw.rectangle([16, 16, 24, 48], fill="white")
    draw.rectangle([16, 40, 48, 48], fill="white")
    draw.rectangle([40, 40, 48, 64], fill="white")
    draw.rectangle([16, 56, 48, 64], fill="white")
    return image

def main():
    start_workers()
    
    icon_image = create_default_icon()
    menu = pystray.Menu(
        pystray.MenuItem('Status: Online', lambda: None, enabled=False),
        pystray.MenuItem('Quit SYNC', quit_app)
    )
    
    tray_icon = pystray.Icon("SYNC_Server", icon_image, "SYNC Remote", menu)
    tray_icon.run()

if __name__ == '__main__':
    main()