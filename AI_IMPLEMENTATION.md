# AI Assistant System - Implementation Guide

## Overview

Hypercord features a **REVOLUTIONARY multi-provider AI assistant** system - the first Discord bot to offer this capability. This guide explains how it works and how to use it.

## Quick Setup

### 1. Get FREE Gemini API Key (Recommended)

```bash
# Visit https://ai.google.dev
# Click "Get API Key" (no credit card required)
# Copy your key

# Add to .env
GEMINI_API_KEY=your_key_here
```

### 2. Configure Default AI

```bash
# In Discord
/ai-config set-default gemini gemini-1.5-flash

# Test it
@YourBot explain TypeScript async/await
```

That's it! Your bot now has FREE unlimited AI capabilities.

## Architecture

### Priority System

AI configuration is resolved in this order:

1. **User-Level Access** (highest priority)
   - Personal AI grants from admins
   - Monthly quotas and expiration
   - Overrides all other settings

2. **Channel-Level Config** (medium priority)
   - Per-channel AI models
   - Custom system prompts
   - Role requirements

3. **Guild-Level Default** (lowest priority)
   - Server-wide fallback
   - Used when no other config exists

### Example Flow

```
User mentions bot in #code-help:
├─ Check: Does user have personal Claude access? → YES
│  └─ Use: Claude Sonnet (user grant)
├─ Check: Does #code-help have channel config? → NO
└─ Fallback: Gemini Flash (guild default)
```

## Advanced Configuration

### Per-Channel Setup

**Use Case**: Different AI for different purposes

```bash
# Code help channel - Best for coding
/ai-config set-channel #code-help anthropic claude-3-5-sonnet "Expert code reviewer. Provide detailed explanations and best practices."

# General chat - FREE unlimited
/ai-config set-channel #general gemini gemini-1.5-flash "Friendly casual assistant"

# Homework help - Don't give direct answers
/ai-config set-channel #homework openai gpt-4o-mini "Help students learn, don't give direct answers. Ask guiding questions."

# Creative writing - Best for creativity
/ai-config set-channel #creative openai gpt-4o "Creative writing assistant with rich vocabulary"
```

### User-Level Grants

**Use Case**: Reward premium members, contest winners, or moderators

```bash
# Grant unlimited Claude to premium member
/ai-grant @user anthropic claude-3-5-sonnet monthly-limit:unlimited

# Grant 50 GPT-4o messages to contest winner (expires in 30 days)
/ai-grant @winner openai gpt-4o monthly-limit:50 expires-days:30

# Grant moderators unlimited access
/ai-grant @mod anthropic claude-3-5-haiku monthly-limit:unlimited
```

### Role-Based Access

**Use Case**: Tie AI access to Discord roles

```bash
# Only @Premium members can use Claude in this channel
/ai-config set-channel #vip-chat anthropic claude-3-5-sonnet required-role:@Premium

# Free members get Gemini (no role requirement)
/ai-config set-channel #general gemini gemini-1.5-flash
```

## Cost Management

### Understanding Costs

**Pricing per 1 Million Tokens:**

| Provider | Model | Input | Output | Typical Message |
|----------|-------|-------|--------|-----------------|
| Gemini | flash | $0.075 | $0.30 | **$0.000** (FREE tier) |
| Gemini | pro | $1.25 | $5.00 | ~$0.0002 |
| OpenAI | gpt-4o-mini | $0.15 | $0.60 | ~$0.00002 |
| OpenAI | gpt-4o | $2.50 | $10.00 | ~$0.0003 |
| Anthropic | haiku | $0.80 | $4.00 | ~$0.00012 |
| Anthropic | sonnet | $3.00 | $15.00 | ~$0.0004 |

### Quota Management

**Prevent Cost Overruns:**

```bash
# User checks their quota
/ai-quota
→ Shows: 45/50 Claude messages used this month

# Admin views server-wide stats
/ai-stats
→ Shows:
  - Total cost: $2.45
  - Messages: 1,234
  - Top users
  - Breakdown by provider
```

**Monthly Reset:**
- All user quotas reset on the 1st of each month
- Automatic job runs at midnight
- Users get fresh quota allocation

### Budget Examples

**Small Server (1,000 msgs/month):**
- 100% Gemini Flash: **$0/month**
- 70% Gemini / 30% GPT-4o-mini: **~$0.01/month**
- 50% Claude Haiku / 50% Gemini: **~$0.06/month**

**Medium Server (5,000 msgs/month):**
- 100% Gemini Flash: **$0/month**
- 80% Gemini / 20% Claude Sonnet: **~$0.40/month**
- 60% GPT-4o-mini / 40% Claude Sonnet: **~$0.90/month**

**Large Server (20,000 msgs/month):**
- 100% Gemini Flash: **$0/month**
- 70% Gemini / 30% Claude Sonnet: **~$2.40/month**
- 50% Claude Sonnet / 50% GPT-4o: **~$7.00/month**

**Recommendation:** Start with 100% Gemini Flash (FREE), then add premium models for specific channels.

## Real-World Examples

### Example 1: Coding Community

```bash
# General chat - free
/ai-config set-default gemini gemini-1.5-flash

# Code help - Claude (best for code)
/ai-config set-channel #code-help anthropic claude-3-5-sonnet "Expert programmer"

# Moderators - unlimited Claude
/ai-grant @mod1 anthropic claude-3-5-sonnet monthly-limit:unlimited
/ai-grant @mod2 anthropic claude-3-5-sonnet monthly-limit:unlimited

# Monthly cost: ~$2-5 for 5k messages
```

### Example 2: Educational Server

```bash
# Default - free Gemini
/ai-config set-default gemini gemini-1.5-flash

# Homework - GPT with "don't cheat" prompt
/ai-config set-channel #homework openai gpt-4o-mini "Guide students, don't give answers"

# Students - 20 messages/month
/ai-grant @student anthropic claude-3-5-haiku monthly-limit:20 expires-days:30

# Teachers - unlimited
/ai-grant @teacher anthropic claude-3-5-sonnet monthly-limit:unlimited

# Monthly cost: ~$1-3 total
```

### Example 3: Premium Tiers

```bash
# Free tier - Gemini only
/ai-config set-default gemini gemini-1.5-flash

# Supporter tier - 50 GPT messages
/ai-grant @supporter openai gpt-4o-mini monthly-limit:50

# Premium tier - Unlimited Claude
/ai-grant @premium anthropic claude-3-5-sonnet monthly-limit:unlimited

# VIP tier - Unlimited GPT-4o
/ai-grant @vip openai gpt-4o monthly-limit:unlimited
```

## Monitoring & Analytics

### Admin Dashboard

```bash
/ai-stats
```

**Shows:**
- Total messages this month
- Cost breakdown by provider
- Top 5 users by usage
- Most active channels
- Success rate
- Average response time

### User Dashboard

```bash
/ai-quota
```

**Shows:**
- Personal AI access grants
- Monthly usage by provider
- Messages remaining
- Total cost accrued
- Expiration dates

## Technical Details

### Database Tables

**aiChannelConfig:**
- Per-channel AI configuration
- Custom models and system prompts
- Role requirements

**aiUserAccess:**
- User-level AI grants
- Monthly quotas and expiration
- Who granted access

**aiUsageLog:**
- Every AI interaction logged
- Token counts (input/output)
- Estimated cost
- Response time
- Success/failure

**aiQuotas:**
- Monthly usage tracking
- Per user/provider/month
- Messages, tokens, costs

### Background Jobs

**Monthly Quota Reset:**
- Runs at midnight on 1st of month
- Resets all `usedThisMonth` counters
- BullMQ job with Redis persistence

### API Integration

**Supported SDKs:**
- `openai` - OpenAI GPT
- `@anthropic-ai/sdk` - Claude
- `@google/generative-ai` - Gemini
- OpenAI-compatible for Grok

**Error Handling:**
- Graceful degradation
- Retry logic
- User-friendly error messages
- Full error logging

## Troubleshooting

### "AI disabled or not configured"

**Solution:**
```bash
/ai-config set-default gemini gemini-1.5-flash
```

### "You don't have the required role"

**Solution:**
- Check channel config: `/ai-config list`
- Admin can remove role requirement or grant you the role

### "You've exceeded your monthly quota"

**Solutions:**
1. Wait until next month (auto-reset on 1st)
2. Ask admin for increased quota
3. Use channels without quotas (guild default)

### "API key not configured"

**Solution:**
```env
# Add to .env file
GEMINI_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
```

## Best Practices

### For Admins

1. **Start Free**: Default to Gemini Flash (unlimited FREE)
2. **Add Premium Selectively**: Only use paid AI where quality matters
3. **Set Quotas**: Prevent abuse with monthly limits
4. **Monitor Costs**: Check `/ai-stats` weekly
5. **Custom Prompts**: Tailor AI behavior per channel
6. **Role Requirements**: Limit expensive AI to paying members

### For Users

1. **Check Quota First**: `/ai-quota` before heavy usage
2. **Use Free Channels**: General chat uses free Gemini
3. **Be Specific**: Clear questions get better answers
4. **Report Issues**: Let admins know if AI misbehaves

## Comparison to Alternatives

### vs ChatGPT Subscription ($20/month)

**ChatGPT:**
- ❌ Single AI model
- ❌ Not integrated with Discord
- ❌ No usage tracking
- ❌ No per-user quotas
- ❌ No channel customization

**Hypercord:**
- ✅ 4 AI providers
- ✅ Native Discord integration
- ✅ Complete analytics
- ✅ Granular quota system
- ✅ Per-channel configs
- **Cost: $0-5/month**

### vs Building Custom Integration

**Custom Build:**
- 40+ hours development time
- Complex quota logic
- Multi-provider management
- Database schema design
- Error handling
- Cost tracking

**Hypercord:**
- ✅ Ready to use
- ✅ Battle-tested
- ✅ Full-featured
- ✅ Production-ready
- **Save 40+ hours**

## Future Enhancements

Planned features:
- Conversation memory (multi-turn context)
- Image analysis (GPT-4 Vision)
- Voice transcription (Whisper API)
- Custom AI personalities
- AI-to-AI debates
- Scheduled AI messages
- AI moderation assistance

---

**Questions? Check the main [README.md](./README.md) or [FEATURES.md](./FEATURES.md)**
