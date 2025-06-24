import requests
import time
from datetime import datetime

# Your ICS feed URL
ICS_URL = 'https://outlook.office365.com/owa/calendar/11ce1ab3abc6489ebb31f517ba16006a@cloudimperiumgames.com/b6b9e6dd9ae34a8080006397f11306d814650322668902300299/calendar.ics'


# How often to download (in seconds)
INTERVAL = 60 * 30  # 30 minutes

def download_ics():
    try:
        response = requests.get(ICS_URL)
        response.raise_for_status()
        with open('calendar.ics', 'w', encoding='utf-8') as f:
            f.write(response.text)
        print(f"[{datetime.now()}] Downloaded and saved calendar.ics")
    except Exception as e:
        print(f"[{datetime.now()}] Failed to download: {e}")

if __name__ == '__main__':
    while True:
        download_ics()
        time.sleep(INTERVAL)
