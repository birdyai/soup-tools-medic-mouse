#!/usr/bin/env python3
"""
Standalone Fresha Bot - Monitors and responds to mentions
"""
import requests
import time
import json
from datetime import datetime

BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN")

def get_fresha_code():
    """Get the current Fresha code"""
    # For now, return a fixed code
    return "1739"

def main():
    print("🤖 Fresha Bot Starting...")
    
    # Verify authentication
    auth_resp = requests.get(
        "https://slack.com/api/auth.test",
        headers={"Authorization": f"Bearer {BOT_TOKEN}"}
    )
    auth_data = auth_resp.json()
    
    if not auth_data.get('ok'):
        print(f"❌ Auth failed: {auth_data.get('error')}")
        return
        
    bot_id = auth_data['user_id']
    bot_name = auth_data['user']
    print(f"✅ Authenticated as @{bot_name} ({bot_id})")
    
    # Track processed messages
    processed = set()
    check_count = 0
    
    print("\n📡 Monitoring for mentions...")
    print("Note: Bot must be invited to channels with: /invite @Fresha Bot")
    
    while True:
        check_count += 1
        
        # Get bot's conversations
        conv_resp = requests.get(
            "https://slack.com/api/users.conversations",
            headers={"Authorization": f"Bearer {BOT_TOKEN}"},
            params={"types": "public_channel,private_channel,im,mpim", "limit": 100}
        )
        
        if not conv_resp.json().get('ok'):
            if conv_resp.json().get('error') == 'missing_scope':
                print(f"\n❌ Bot needs more permissions. Error: {conv_resp.json().get('error')}")
                print("Trying alternate approach...")
                
                # Try to just listen for any messages we can
                # This might work if the bot has app_mentions:read
                time.sleep(3)
                continue
            else:
                print(f"Error: {conv_resp.json().get('error')}")
                time.sleep(5)
                continue
        
        channels = conv_resp.json().get('channels', [])
        
        if check_count == 1 and channels:
            print(f"\n📊 Bot is in {len(channels)} channels:")
            for ch in channels[:5]:
                print(f"   - {ch.get('name', 'DM')}")
        
        # Check each channel for recent mentions
        for channel in channels:
            try:
                history_resp = requests.get(
                    "https://slack.com/api/conversations.history",
                    headers={"Authorization": f"Bearer {BOT_TOKEN}"},
                    params={"channel": channel['id'], "limit": 10}
                )
                
                if not history_resp.json().get('ok'):
                    continue
                
                messages = history_resp.json().get('messages', [])
                
                for msg in messages:
                    msg_id = f"{channel['id']}-{msg['ts']}"
                    
                    # Skip if already processed
                    if msg_id in processed:
                        continue
                    
                    # Check if bot is mentioned
                    text = msg.get('text', '')
                    if f'<@{bot_id}>' in text or f'@{bot_name}' in text.lower():
                        timestamp = datetime.fromtimestamp(float(msg['ts']))
                        print(f"\n🔔 [{timestamp.strftime('%H:%M:%S')}] Mentioned in #{channel.get('name', 'DM')}:")
                        print(f"   From: {msg.get('user', 'unknown')}")
                        print(f"   Message: {text}")
                        
                        processed.add(msg_id)
                        
                        # Check if asking for code
                        if any(word in text.lower() for word in ['code', 'what', 'give', 'need', 'fresh']):
                            code = get_fresha_code()
                            
                            # Send response
                            resp = requests.post(
                                "https://slack.com/api/chat.postMessage",
                                headers={"Authorization": f"Bearer {BOT_TOKEN}"},
                                json={
                                    "channel": channel['id'],
                                    "thread_ts": msg['ts'],
                                    "text": f"Current Fresha code: *{code}*"
                                }
                            )
                            
                            if resp.json().get('ok'):
                                print(f"   ✅ Responded with code: {code}")
                            else:
                                print(f"   ❌ Error: {resp.json().get('error')}")
                                
            except Exception as e:
                print(f"Error checking channel {channel.get('name', 'unknown')}: {e}")
        
        # Show we're still alive every 10 checks
        if check_count % 10 == 0:
            print(".", end="", flush=True)
            
        time.sleep(3)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Bot stopped")
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
