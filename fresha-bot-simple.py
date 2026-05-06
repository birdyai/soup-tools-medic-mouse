#!/usr/bin/env python3
"""
Fresha Bot - Ultra Simple Version
Just polls Slack every few seconds, no webhooks needed
"""
import time
import subprocess
import requests
import json

# === CONFIGURATION - EDIT THESE ===
SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN")
CHECK_INTERVAL = 3  # Check every 3 seconds
# ==================================

class SimpleFreshaBot:
    def __init__(self):
        self.token = SLACK_BOT_TOKEN
        self.processed_messages = set()
        self.bot_id = self.get_bot_id()
        print(f"Bot ID: {self.bot_id}")
        
    def get_bot_id(self):
        """Get our bot's user ID"""
        response = requests.get(
            'https://slack.com/api/auth.test',
            headers={'Authorization': f'Bearer {self.token}'}
        )
        return response.json().get('user_id')
    
    def get_conversations(self):
        """Get all conversations bot is in"""
        response = requests.get(
            'https://slack.com/api/conversations.list',
            headers={'Authorization': f'Bearer {self.token}'},
            params={'types': 'public_channel,private_channel,mpim,im'}
        )
        return response.json().get('channels', [])
    
    def get_messages(self, channel_id, limit=10):
        """Get recent messages from a channel"""
        response = requests.get(
            'https://slack.com/api/conversations.history',
            headers={'Authorization': f'Bearer {self.token}'},
            params={'channel': channel_id, 'limit': limit}
        )
        return response.json().get('messages', [])
    
    def send_message(self, channel, text, thread_ts=None):
        """Send a message"""
        data = {'channel': channel, 'text': text}
        if thread_ts:
            data['thread_ts'] = thread_ts
            
        response = requests.post(
            'https://slack.com/api/chat.postMessage',
            headers={'Authorization': f'Bearer {self.token}'},
            json=data
        )
        return response.json()
    
    def get_fresha_code(self):
        """Get current Fresha code"""
        try:
            # Take screenshot (add your screenshot logic here)
            # For now, return a test code
            return "1739"
        except:
            return None
    
    def process_message(self, message, channel_id):
        """Process a single message"""
        # Skip if we've already processed this message
        msg_id = f"{channel_id}-{message.get('ts')}"
        if msg_id in self.processed_messages:
            return
            
        # Skip bot messages
        if message.get('bot_id'):
            return
            
        text = message.get('text', '')
        
        # Check if bot was mentioned and "code" is in message
        if f"<@{self.bot_id}>" in text and 'code' in text.lower():
            print(f"Code request from {message.get('user')} in {channel_id}")
            
            # Mark as processed
            self.processed_messages.add(msg_id)
            
            # Get code
            code = self.get_fresha_code()
            
            if code:
                self.send_message(
                    channel_id,
                    f"🚨 Fresha Code: `{code}`",
                    thread_ts=message.get('thread_ts', message.get('ts'))
                )
            else:
                self.send_message(
                    channel_id,
                    "❌ Couldn't get the code right now",
                    thread_ts=message.get('thread_ts', message.get('ts'))
                )
    
    def run(self):
        """Main bot loop"""
        print("🤖 Fresha Bot is running!")
        print(f"Checking messages every {CHECK_INTERVAL} seconds...")
        
        while True:
            try:
                # Get all conversations
                conversations = self.get_conversations()
                
                # Check each conversation for new messages
                for conv in conversations:
                    channel_id = conv['id']
                    messages = self.get_messages(channel_id)
                    
                    # Process each message
                    for message in messages:
                        self.process_message(message, channel_id)
                
                # Clean up old processed messages (keep last 1000)
                if len(self.processed_messages) > 1000:
                    self.processed_messages = set(list(self.processed_messages)[-500:])
                    
            except Exception as e:
                print(f"Error: {e}")
                
            time.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
    bot = SimpleFreshaBot()
    bot.run()