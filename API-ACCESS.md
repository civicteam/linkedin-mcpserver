# LinkedIn MCP Server - API Access Levels

This document explains which LinkedIn MCP tools are available with different levels of API access.

## Tool Categories

### 1. Share API (✅ Available with Standard OAuth)

**No special approval needed** - Works with standard LinkedIn OAuth

**Tools:**
- `get-my-profile` - Get your own LinkedIn profile
- `create-text-post` - Create text posts
- `create-article-share` - Share articles with commentary
- `create-image-share` - Share images with commentary

**OAuth Scopes:** `openid`, `profile`, `email`, `w_member_social`

### 2. Partner API (🔒 Requires LinkedIn Partner Program)

**Requirements:**
- Incorporated company
- 3-6 month application review
- <10% approval rate
- No sandbox environment

**Tools:**
- `search-people` - Search LinkedIn profiles
- `get-profile` - Get other users' profiles
- `search-jobs` - Search job postings
- `send-message` - Send messages to connections
- `get-network-stats` - Get connection statistics
- `get-connections` - List your connections

**OAuth Scopes:** `r_basicprofile`, `r_1st_connections_size` (plus base scopes)

**Application:** [LinkedIn Partner Program](https://learn.microsoft.com/en-us/linkedin/shared/references/partner-program)

### 3. Marketing API (🔒 Requires Marketing API Access)

**Access Tiers:**
- **Development Tier:** Automatic (read-only + edit up to 5 accounts)
- **Standard Tier:** Application required (unlimited accounts)

**Tools:**

*Ad Account Management:*
- `search-ad-accounts` - Search accessible ad accounts
- `get-ad-account` - Get account details
- `create-ad-account` - Create new account (Standard tier only)

*Campaign Group Management:*
- `search-campaign-groups` - Search campaign groups
- `get-campaign-group` - Get group details
- `create-campaign-group` - Create new group

*Campaign Management:*
- `search-campaigns` - Search campaigns
- `get-campaign` - Get campaign details
- `create-campaign` - Create new campaign
- `update-campaign-status` - Update status (activate/pause/archive)

*Creative Management:*
- `search-creatives` - Search creatives
- `get-creative` - Get creative details

*Analytics:*
- `get-ad-analytics` - Get advertising performance metrics

**OAuth Scopes:** `rw_ads` (read-write) or `r_ads` (read-only)

**Application:** [LinkedIn Marketing API](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/marketing-tiers)

## Current Implementation Status

✅ **Share API**: Fully implemented and tested
✅ **Partner API**: Implemented, requires Partner Program access
✅ **Marketing API**: Implemented with proper Rest.li encoding

## Technical Details

### Rest.li Protocol

The Marketing API uses LinkedIn's Rest.li protocol which requires special parameter encoding:
- URN values must be URL-encoded: `urn:li:campaign:123` → `urn%3Ali%3Acampaign%3A123`
- Rest.li syntax (List, parentheses, commas) must NOT be encoded
- Example: `List(urn%3Ali%3Acampaign%3A123,urn%3Ali%3Acampaign%3A456)`

### Required Headers

All API requests include:
```
Authorization: Bearer {access_token}
X-Restli-Protocol-Version: 2.0.0
LinkedIn-Version: {YYYYMM}
Content-Type: application/json
```

## Documentation References

- [LinkedIn Marketing API](https://learn.microsoft.com/en-us/linkedin/marketing/)
- [LinkedIn Share API](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin)
- [LinkedIn Partner Program](https://learn.microsoft.com/en-us/linkedin/shared/references/partner-program)
- [Rest.li Protocol Specification](https://linkedin.github.io/rest.li/spec/protocol)
