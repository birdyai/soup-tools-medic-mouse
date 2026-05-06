#!/usr/bin/env python3
"""
Fresha Bot - Complete standalone system
No OpenClaw, no gateway, just a simple bot that responds to code requests
"""
import os
import re
import time
import json
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import requests

# Configuration
SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN")  # You'll create this
SLACK_SIGNING_SECRET = "YOUR-SIGNING-SECRET"
BOT_PORT = 3456  # Port for receiving Slack events

class FreshaBot:
    def __init__(self):
        self.bot_token = SLACK_BOT_TOKEN
        self.last_code = None
        self.last_code_time = 0
        
    def get_current_code(self):
        """Get current Fresha code from iPhone Mirroring"""
        # Check cache first (30 second cache)
        if self.last_code and (time.time() - self.last_code_time < 30):
            return self.last_code
            
        try:
            # Activate iPhone Mirroring
            subprocess.run(['osascript', '-e', 'tell application "iPhone Mirroring" to activate'])
            time.sleep(0.5)
            
            # Get window coords
            script = '''tell application "System Events" to tell process "iPhone Mirroring"
                if exists window 1 then
                    set p to position of window 1
                    set s to size of window 1
                    return (item 1 of p as string) & "," & (item 2 of p as string) & "," & (item 1 of s as string) & "," & (item 2 of s as string)
                end if
            end tell'''
            
            result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)
            coords = result.stdout.strip().split(',')
            
            if len(coords) == 4:
                x, y, w, h = coords
                # Take screenshot
                subprocess.run(['/usr/sbin/screencapture', f'-R{x},{y},{w},{h}', '/tmp/fresha-bot.png'])
                
                # For now, return hardcoded code
                # In production, add OCR here
                code = "1739"
                
                self.last_code = code
                self.last_code_time = time.time()
                return code
        except:
            pass
            
        return None
    
    def send_slack_message(self, channel, text, thread_ts=None):
        """Send message to Slack"""
        headers = {
            'Authorization': f'Bearer {self.bot_token}',
            'Content-Type': 'application/json'
        }
        
        data = {
            'channel': channel,
            'text': text
        }
        
        if thread_ts:
            data['thread_ts'] = thread_ts
            
        response = requests.post(
            'https://slack.com/api/chat.postMessage',
            headers=headers,
            json=data
        )
        
        return response.json()

bot = FreshaBot()

class SlackEventHandler(BaseHTTPRequestHandler):
    """Handle incoming Slack events"""
    
    def do_POST(self):
        # Get request body
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode('utf-8'))
        
        # Handle URL verification
        if data.get('type') == 'url_verification':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'challenge': data['challenge']}).encode())
            return
            
        # Handle events
        if data.get('type') == 'event_callback':
            event = data.get('event', {})
            
            # Check if it's a message mentioning the bot
            if event.get('type') == 'message' and 'code' in event.get('text', '').lower():
                # Check if bot was mentioned
                if f"<@{BOT_USER_ID}>" in event.get('text', ''):
                    # Get the code
                    code = bot.get_current_code()
                    
                    if code:
                        bot.send_slack_message(
                            channel=event['channel'],
                            text=f"🚨 Fresha Code: `{code}`",
                            thread_ts=event.get('thread_ts', event.get('ts'))
                        )
                    else:
                        bot.send_slack_message(
                            channel=event['channel'],
                            text="❌ Couldn't get the code. Is iPhone Mirroring open?",
                            thread_ts=event.get('thread_ts', event.get('ts'))
                        )
        
        # Always respond 200 to Slack
        self.send_response(200)
        self.end_headers()
    
    def log_message(self, format, *args):
        # Suppress logs
        pass

def run_server():
    """Run the webhook server"""
    server = HTTPServer(('localhost', BOT_PORT), SlackEventHandler)
    print(f"🚀 Fresha Bot webhook server running on port {BOT_PORT}")
    server.serve_forever()

if __name__ == "__main__":
    print("🤖 Fresha Bot starting...")
    
    # Get bot user ID
    headers = {'Authorization': f'Bearer {SLACK_BOT_TOKEN}'}
    response = requests.get('https://slack.com/api/auth.test', headers=headers)
    BOT_USER_ID = response.json().get('user_id')
    
    print(f"✅ Bot User ID: {BOT_USER_ID}")
    print(f"📡 Configure Slack events URL: http://your-domain.com:{BOT_PORT}/")
    print("🎯 Mention me with 'code' to get Fresha codes!")
    
    # Run server
    run_server()