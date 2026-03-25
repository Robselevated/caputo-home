# Environment Variables

This document lists all required environment variables for deploying the Caputo Household App to Netlify.

## Required Variables

### Supabase Configuration

**VITE_SUPABASE_URL**
- **Value**: Your Supabase project URL
- **Source**: Supabase Dashboard → Settings → API → Project URL
- **Build/Runtime**: Build time (VITE_ prefix means it's embedded in the frontend bundle)
- **Security**: Public, safe to expose in frontend code
- **Example**: `https://ddjgghmwfwmhqndhkjkp.supabase.co`

**VITE_SUPABASE_ANON_KEY**
- **Value**: Your Supabase anonymous/public key
- **Source**: Supabase Dashboard → Settings → API → Project API keys → anon public
- **Build/Runtime**: Build time (embedded in frontend)
- **Security**: Public, designed to be exposed. Row Level Security (RLS) policies protect your data.
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

**SUPABASE_SERVICE_ROLE_KEY**
- **Value**: Your Supabase service role key (full admin access)
- **Source**: Supabase Dashboard → Settings → API → Project API keys → service_role
- **Build/Runtime**: Runtime only (used in Netlify Functions)
- **Security**: **SECRET** - Never expose in frontend code. Has full database access, bypasses RLS.
- **Used in**: `send-push.js` function

---

### VAPID Keys (Web Push Notifications)

**VITE_VAPID_PUBLIC_KEY**
- **Value**: VAPID public key for web push
- **Source**: Generate using `npx web-push generate-vapid-keys` or use existing key
- **Build/Runtime**: Build time (embedded in frontend)
- **Security**: Public, safe to expose
- **Used in**: Frontend service worker registration

**VAPID_PRIVATE_KEY**
- **Value**: VAPID private key for web push
- **Source**: Generated alongside public key (same command as above)
- **Build/Runtime**: Runtime only (used in Netlify Functions)
- **Security**: **SECRET** - Must never be exposed in frontend
- **Used in**: `send-push.js` function

**VAPID_SUBJECT**
- **Value**: Mailto or HTTPS URL identifying your service
- **Source**: Your contact email or website
- **Build/Runtime**: Runtime only
- **Security**: Public information
- **Default**: `mailto:rob@elevatedroofingpartners.com`
- **Used in**: `send-push.js` function

---

### Claude AI API

**CLAUDE_API_KEY**
- **Value**: Anthropic Claude API key
- **Source**: Anthropic Console → API Keys
- **Build/Runtime**: Runtime only (used in Netlify Functions)
- **Security**: **SECRET** - Never expose in frontend. Costs money per API call.
- **Used in**: `claude-scan.js` and `parse-recipe.js` functions

---

## Setting Environment Variables in Netlify

1. Go to your Netlify site dashboard
2. Navigate to **Site settings → Environment variables**
3. Add each variable listed above
4. For build-time variables (those starting with `VITE_`), no special configuration needed
5. For runtime-only variables (secrets), ensure they're NOT prefixed with `VITE_`

### Build vs Runtime

- **Build time** (VITE_ prefix): Values are embedded into the JavaScript bundle during build. Anyone can see these in the browser.
- **Runtime only** (no VITE_ prefix): Only available to Netlify Functions. Never exposed to the browser.

---

## Security Checklist

- [ ] SUPABASE_SERVICE_ROLE_KEY has no VITE_ prefix
- [ ] VAPID_PRIVATE_KEY has no VITE_ prefix
- [ ] CLAUDE_API_KEY has no VITE_ prefix
- [ ] All secrets are set in Netlify dashboard, not committed to git
- [ ] .env.local is in .gitignore (local development only)

---

## Local Development

For local development, copy `.env.local.example` to `.env.local` (if example exists) or create `.env.local` with all the variables listed above. This file is gitignored and never committed.

Netlify CLI will automatically use `.env` or `.env.local` when running `netlify dev`.
