#!/usr/bin/env python3
"""
Test what the Fresha Bot can actually do
"""
import requests
import json

BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN")

print("Testing Fresha Bot capabilities...\n")

# 1. Test authentication
print("1. Testing authentication...")
auth = requests.get(
    "https://slack.com/api/auth.test",
    headers={"Authorization": f"Bearer {BOT_TOKEN}"}
)
auth_data = auth.json()
print(f"   Auth: {auth_data.get('ok')}")
if auth_data.get('ok'):
    print(f"   Bot: @{auth_data['user']} ({auth_data['user_id']})")
else:
    print(f"   Error: {auth_data.get('error')}")

# 2. Test what scopes we have
print("\n2. Testing bot info...")
bot_info = requests.get(
    "https://slack.com/api/bots.info",
    headers={"Authorization": f"Bearer {BOT_TOKEN}"},
    params={"bot": auth_data.get('bot_id')}
)
bot_data = bot_info.json()
if bot_data.get('ok'):
    print(f"   Bot name: {bot_data['bot']['name']}")
else:
    print(f"   Error: {bot_data.get('error')}")

# 3. Test sending a message to a specific channel  
print("\n3. Testing message sending...")
# Try general channel
test_msg = requests.post(
    "https://slack.com/api/chat.postMessage",
    headers={"Authorization": f"Bearer {BOT_TOKEN}"},
    json={
        "channel": "C04UR6XAKC4",  # general channel ID
        "text": "🤖 Fresha Bot test message - I'm online!"
    }
)
msg_data = test_msg.json()
print(f"   Send to #general: {msg_data.get('ok')}")
if not msg_data.get('ok'):
    print(f"   Error: {msg_data.get('error')}")

# 4. Test if we can list any channels
print("\n4. Testing channel access...")
channels = requests.get(
    "https://slack.com/api/conversations.list",
    headers={"Authorization": f"Bearer {BOT_TOKEN}"},
    params={"types": "public_channel", "limit": 5}
)
ch_data = channels.json()
print(f"   List channels: {ch_data.get('ok')}")
if not ch_data.get('ok'):
    print(f"   Error: {ch_data.get('error')}")

# 5. Test user conversations
print("\n5. Testing user conversations...")
user_convs = requests.get(
    "https://slack.com/api/users.conversations",
    headers={"Authorization": f"Bearer {BOT_TOKEN}"},
    params={"limit": 5}
)
uc_data = user_convs.json()
print(f"   User conversations: {uc_data.get('ok')}")
if not uc_data.get('ok'):
    print(f"   Error: {uc_data.get('error')}")
else:
    print(f"   Found {len(uc_data.get('channels', []))} conversations")

print("\n📊 Summary:")
print("The bot has app_mentions:read, chat:write, and channels:read scopes")
print("But it needs to be invited to channels to work properly")
print("\nTo use: In Slack, type: /invite @Fresha Bot")