# Fresha Bot Fix Loop - Task List

## Goal: Make Fresha Bot respond with ONLY the 4-digit code when asked "what's the code?"

## Current Status
- Bot exists and is connected
- Bot responds but asks for context instead of providing codes
- Agent workspace files not being used by Slack integration

## Fix Loop Tasks

### Phase 1: Understand Current Setup
- [ ] Check OpenClaw documentation for Slack bot configuration
- [ ] Examine how other bots (Rex, Ace, Yes Man) are configured
- [ ] Find where Slack bot system prompts are stored
- [ ] Check if there's a way to override default behavior

### Phase 2: Test Configuration Methods
- [ ] Try setting bot behavior through OpenClaw config commands
- [ ] Check if Slack app manifest can be modified
- [ ] Test if bot reads from a specific config file
- [ ] Look for webhook or API configuration options

### Phase 3: Alternative Approaches
- [ ] Create a monitoring script that responds instead of bot
- [ ] Use a different integration method (webhook vs socket)
- [ ] Check if bot can be trained through repeated interactions
- [ ] Explore using a proxy/wrapper approach

### Phase 4: Implementation
- [ ] Implement the working solution
- [ ] Test with "what's the code?" message
- [ ] Verify bot responds with just digits
- [ ] Document the working configuration

### Phase 5: Verification
- [ ] Test multiple times
- [ ] Test with different phrasings
- [ ] Ensure it checks iPhone Mirroring
- [ ] Confirm it returns current code

## Loop Process
1. Pick next unchecked task
2. Execute and document results
3. If solution found, jump to Phase 4
4. If all tasks complete without solution, research new approaches
5. Continue until bot works correctly

## Success Criteria
When asked "what's the code?" the bot should:
1. Take screenshot of iPhone Mirroring
2. Extract 4-digit Fresha code
3. Reply with ONLY the digits (e.g., "9646")
4. No questions, no context, just the code