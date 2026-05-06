#!/usr/bin/env python3
"""
Fresha Bot - Uses app_mentions to find when bot is mentioned
"""
import requests
import time
import json

BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN")

def get_fresha_code():
    """Returns the current Fresha code"""
    # TODO: Add screenshot logic here
    return "1739"

def main():
    print("🤖 Fresha Bot Mentions Monitor")
    print("Waiting for mentions of @Fresha Bot...\n")
    
    # Test authentication
    auth_resp = requests.get(
        "https://slack.com/api/auth.test",
        headers={"Authorization": f"Bearer {BOT_TOKEN}"}
    )
    auth_data = auth_resp.json()
    
    if not auth_data.get('ok'):
        print(f"❌ Auth failed: {auth_data.get('error')}")
        return
        
    bot_id = auth_data['user_id']
    print(f"Bot authenticated as: {auth_data['user']} ({bot_id})")
    print("Note: Bot must be invited to channels to see messages there")
    print("Use: /invite @Fresha Bot\n")
    
    # Try different endpoints to find mentions
    processed = set()
    
    while True:
        # Try to get channels bot is in
        channels_resp = requests.get(
            "https://slack.com/api/users.conversations",
            headers={"Authorization": f"Bearer {BOT_TOKEN}"},
            params={"types": "public_channel,private_channel,im,mpim"}
        )
        
        if channels_resp.json().get('ok'):
            channels = channels_resp.json().get('channels', [])
            if channels:
                print(f"Bot is in {len(channels)} channels/conversations")
                
                # Check each channel for mentions
                for channel in channels:
                    history_resp = requests.get(
                        "https://slack.com/api/conversations.history",
                        headers={"Authorization": f"Bearer {BOT_TOKEN}"},
                        params={"channel": channel['id'], "limit": 5}
                    )
                    
                    if history_resp.json().get('ok'):
                        messages = history_resp.json().get('messages', [])
                        for msg in messages:
                            msg_id = f"{channel['id']}-{msg['ts']}"
                            if msg_id in processed:
                                continue
                                
                            # Check if bot is mentioned
                            if f'<@{bot_id}>' in msg.get('text', ''):
                                print(f"\n🔔 Mentioned in {channel.get('name', 'DM')}!")
                                print(f"   From: {msg.get('user', 'unknown')}")
                                print(f"   Text: {msg['text']}")
                                processed.add(msg_id)
                                
                                # Check if asking for code
                                if 'code' in msg['text'].lower():
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
        
        # Also try to send a test message to see what channels we can access
        test_resp = requests.post(
            "https://slack.com/api/chat.postMessage", 
            headers={"Authorization": f"Bearer {BOT_TOKEN}"},
            json={
                "channel": "general",
                "text": "🤖 Fresha Bot is online. Mention me to get codes!"
            }
        )
        if test_resp.json().get('ok'):
            print("✅ Sent startup message to #general")
            break
        elif test_resp.json().get('error') == 'channel_not_found':
            # Try with channel ID
            test_resp2 = requests.post(
                "https://slack.com/api/chat.postMessage",
                headers={"Authorization": f"Bearer {BOT_TOKEN}"}, 
                json={
                    "channel": "C04UR6XAKC4",  # general channel ID
                    "text": "🤖 Fresha Bot is online. Mention @Fresha Bot to get codes!"
                }
            )
            if test_resp2.json().get('ok'):
                print("✅ Sent startup message to #general")
                break
                
        time.sleep(5)
        print(".", end="", flush=True)

if __name__ == "__main__":
    main()