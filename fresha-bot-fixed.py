#!/usr/bin/env python3
"""
Fresha Bot - Fixed version with better error handling
"""
import time
import subprocess
import requests
import json
import sys

# Configuration
BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN")
CHECK_INTERVAL = 3

class FreshaBot:
    def __init__(self):
        self.token = BOT_TOKEN
        self.processed_messages = set()
        self.bot_id = None
        self.bot_name = None
        
    def get_bot_info(self):
        """Get bot user ID and name"""
        response = requests.get(
            "https://slack.com/api/auth.test",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        data = response.json()
        if data['ok']:
            self.bot_id = data['user_id']
            self.bot_name = data['user']
            print(f"Bot ID: {self.bot_id}")
            print(f"Bot name: @{self.bot_name}")
            return True
        else:
            print(f"Error getting bot info: {data.get('error', 'Unknown')}")
            return False
            
    def get_fresha_code(self):
        """Get the current Fresha code"""
        # For now, return the last detected code
        return "1739"
        
    def check_messages(self):
        """Check all channels for mentions"""
        # Get list of channels bot is in
        channels_response = requests.get(
            "https://slack.com/api/conversations.list",
            headers={"Authorization": f"Bearer {self.token}"},
            params={
                "types": "public_channel,private_channel",
                "limit": 100
            }
        )
        
        channels_data = channels_response.json()
        if not channels_data.get('ok'):
            print(f"Error listing channels: {channels_data.get('error', 'Unknown')}")
            return
            
        # Check each channel for recent messages
        for channel in channels_data.get('channels', []):
            if not channel.get('is_member', False):
                continue
                
            # Get recent messages
            history_response = requests.get(
                "https://slack.com/api/conversations.history",
                headers={"Authorization": f"Bearer {self.token}"},
                params={
                    "channel": channel['id'],
                    "limit": 10
                }
            )
            
            history_data = history_response.json()
            if not history_data.get('ok'):
                continue
                
            # Check each message
            for message in history_data.get('messages', []):
                # Skip if we've already processed this message
                msg_id = f"{channel['id']}-{message.get('ts', '')}"
                if msg_id in self.processed_messages:
                    continue
                    
                # Check if bot is mentioned
                text = message.get('text', '').lower()
                if (f"<@{self.bot_id}>" in message.get('text', '') or
                    f"@{self.bot_name}" in text):
                    
                    print(f"\n🔔 Mentioned in #{channel['name']} by {message.get('user', 'unknown')}")
                    print(f"   Message: {message.get('text', '')}")
                    
                    # Mark as processed
                    self.processed_messages.add(msg_id)
                    
                    # Check if they're asking for code
                    if 'code' in text or 'what' in text or 'get' in text:
                        code = self.get_fresha_code()
                        self.send_response(channel['id'], message['ts'], code)
                        
    def send_response(self, channel_id, thread_ts, code):
        """Send response with the Fresha code"""
        response = requests.post(
            "https://slack.com/api/chat.postMessage",
            headers={"Authorization": f"Bearer {self.token}"},
            json={
                "channel": channel_id,
                "thread_ts": thread_ts,  # Reply in thread
                "text": f"Current Fresha code: *{code}*"
            }
        )
        
        data = response.json()
        if data['ok']:
            print(f"   ✅ Sent code: {code}")
        else:
            print(f"   ❌ Error sending: {data.get('error', 'Unknown')}")
            
    def run(self):
        """Main bot loop"""
        if not self.get_bot_info():
            print("Failed to get bot info. Check your token.")
            return
            
        print(f"\n🤖 Fresha Bot is running!")
        print(f"Mention me with @{self.bot_name} or <@{self.bot_id}>")
        print(f"Checking messages every {CHECK_INTERVAL} seconds...\n")
        
        while True:
            try:
                self.check_messages()
                time.sleep(CHECK_INTERVAL)
            except KeyboardInterrupt:
                print("\n👋 Bot stopped")
                break
            except Exception as e:
                print(f"Error: {e}")
                time.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
    bot = FreshaBot()
    bot.run()