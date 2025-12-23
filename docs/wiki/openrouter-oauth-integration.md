# OpenRouter OAuth Integration Guide

A complete guide to implementing PKCE OAuth authentication with OpenRouter in frontend-only applications.

## Table of Contents
1. [Overview](#overview)
2. [PKCE Flow Explained](#pkce-flow-explained)
3. [Implementation](#implementation)
4. [Code Walkthrough](#code-walkthrough)
5. [Testing & Debugging](#testing--debugging)
6. [Common Issues](#common-issues)

---

## Overview

### What is PKCE?

**PKCE** (Proof Key for Code Exchange) is an OAuth 2.0 extension designed for public clients that cannot securely store a client secret. Perfect for:
- Single Page Applications (SPAs)
- Frontend-only apps deployed to GitHub Pages
- Mobile applications
- Any app where code runs on the user's device

### Why OpenRouter Uses PKCE

OpenRouter's PKCE flow allows users to authenticate and authorize your app without:
- Pre-registering callback URLs
- Storing API keys in your source code
- Running a backend server
- Exposing secrets in browser code

### What You Get

After successful authentication:
- An API key unique to the user
- Stored securely in browser's `localStorage`
- Valid for making OpenRouter API calls
- No expiration (until user revokes or logs out)

---

## PKCE Flow Explained

### The Complete Flow

```
┌─────────────┐
│  Your App   │
└──────┬──────┘
       │
       │ 1. Generate code_verifier (random string)
       │ 2. Hash verifier → code_challenge
       │ 3. Store verifier in localStorage
       │
       ├─────────────────────────────────────────┐
       │                                         │
       │ 4. Redirect to OpenRouter with:        │
       │    - callback_url                       │
       │    - code_challenge                     │
       │    - code_challenge_method (S256)       │
       │                                         │
       ▼                                         │
┌─────────────────┐                             │
│   OpenRouter    │                             │
│   Auth Page     │                             │
└────────┬────────┘                             │
         │                                       │
         │ 5. User logs in & authorizes          │
         │                                       │
         ├───────────────────────────────────────┘
         │
         │ 6. Redirect back to your app with:
         │    callback_url?code=AUTH_CODE
         │
         ▼
┌─────────────┐
│  Your App   │
└──────┬──────┘
       │
       │ 7. Extract code from URL
       │ 8. Retrieve verifier from localStorage
       │ 9. POST to /api/v1/auth/keys:
       │    - code
       │    - code_verifier
       │    - code_challenge_method
       │
       ▼
┌─────────────────┐
│   OpenRouter    │
│   Token API     │
└────────┬────────┘
         │
         │ 10. Verify challenge matches
         │ 11. Return API key
         │
         ▼
┌─────────────┐
│  Your App   │
│             │
│ ✅ Authenticated!
└─────────────┘
```

### Security Model

**Why it's secure:**
1. **Code Verifier**: Random, unpredictable string generated on each login
2. **Code Challenge**: One-way hash (SHA-256) of the verifier
3. **Challenge Sent First**: Attacker sees hash, not original
4. **Verifier Sent Later**: Only your app has the original verifier
5. **Server Verification**: OpenRouter confirms hash(verifier) == challenge

**Protection against:**
- Interception attacks (verifier never transmitted during redirect)
- Code injection (challenge is cryptographically tied to verifier)
- Replay attacks (each flow uses unique verifier/challenge pair)

---

## Implementation

### File Structure

```
src/
├── auth.ts      # PKCE logic & localStorage management
├── main.ts      # Initialize auth on app load
└── ui.ts        # Show/hide login buttons
```

### Dependencies

Zero dependencies! Pure browser APIs:
- `crypto.getRandomValues()` - Generate random verifier
- `crypto.subtle.digest()` - SHA-256 hashing
- `localStorage` - Store verifier & API key
- `URLSearchParams` - Parse callback URL
- `fetch()` - Token exchange

---

## Code Walkthrough

### Step 1: Generate Random Verifier

```typescript
function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Example output: "a3f7b2c1d4e5f6a7b8c9d0e1f2a3b4c5..."
```

**Why 32 bytes?**
- Produces 64-character hex string
- PKCE spec recommends 43-128 characters
- 256 bits of entropy = cryptographically secure

---

### Step 2: Hash to Create Challenge

```typescript
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));

  // URL-safe base64 encoding
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
```

**Why S256 (SHA-256)?**
- One-way: Cannot derive verifier from challenge
- Standard: Widely supported hashing algorithm
- Fast: Efficient in browsers

---

### Step 3: Initiate Login Flow

```typescript
export async function initiateLogin(): Promise<void> {
  // Generate PKCE parameters
  const codeVerifier = generateRandomString(32);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store verifier for later
  localStorage.setItem('pkce_code_verifier', codeVerifier);

  // Build callback URL (where OpenRouter redirects back)
  const callbackUrl = window.location.origin + window.location.pathname;

  // Build authorization URL
  const authUrl = `https://openrouter.ai/auth?` +
    `callback_url=${encodeURIComponent(callbackUrl)}&` +
    `code_challenge=${codeChallenge}&` +
    `code_challenge_method=S256`;

  console.log('Redirecting to:', authUrl);

  // Redirect user to OpenRouter
  window.location.href = authUrl;
}
```

**Important:**
- `callbackUrl` must match exactly where OpenRouter redirects
- For GitHub Pages: `https://username.github.io/RepoName/`
- OpenRouter adds `?code=...` to this URL
- No need to pre-register callback URLs with OpenRouter!

---

### Step 4: Handle Callback

```typescript
export async function handleCallback(): Promise<boolean> {
  // Parse URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  if (!code) {
    return false;  // Not a callback, normal page load
  }

  // Retrieve stored verifier
  const codeVerifier = localStorage.getItem('pkce_code_verifier');

  if (!codeVerifier) {
    console.error('Code verifier not found');
    return false;
  }

  try {
    // Exchange code for API key
    const response = await fetch('https://openrouter.ai/api/v1/auth/keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        code_challenge_method: 'S256',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for API key');
    }

    const data = await response.json();

    if (data.key) {
      // Success! Store API key
      localStorage.setItem('openrouter_api_key', data.key);

      // Clean up verifier
      localStorage.removeItem('pkce_code_verifier');

      // Remove ?code= from URL
      window.history.replaceState({}, document.title, window.location.pathname);

      return true;
    }

    return false;
  } catch (error) {
    console.error('Error during token exchange:', error);
    localStorage.removeItem('pkce_code_verifier');
    return false;
  }
}
```

**Key Points:**
- Call this on every page load
- Returns `true` if successful authentication
- Cleans up URL to remove `?code=` parameter
- Stores API key in `localStorage` for future use

---

### Step 5: Use the API Key

```typescript
export function getStoredApiKey(): string | null {
  return localStorage.getItem('openrouter_api_key');
}

export function isAuthenticated(): boolean {
  return getStoredApiKey() !== null;
}

// Example API call
async function chatCompletion(messages) {
  const apiKey = getStoredApiKey();

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'YourAppName',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages,
    }),
  });

  return response.json();
}
```

---

### Step 6: Logout

```typescript
export function logout(): void {
  localStorage.removeItem('openrouter_api_key');
  window.location.reload();
}
```

---

## Testing & Debugging

### Local Development

```bash
# Start dev server
npm run dev

# Visit http://localhost:5173
# Click "Login with OpenRouter"
# Authorize the app
# Should redirect back to localhost
```

**Callback URL for local dev:**
```
http://localhost:5173/
```

### Production Testing

```bash
# Build and preview
npm run build
npm run preview

# Visit the preview URL
# Test full OAuth flow
```

**Callback URL for GitHub Pages:**
```
https://username.github.io/RepoName/
```

### Browser Console Debugging

Add logging to track the flow:

```typescript
export async function initiateLogin(): Promise<void> {
  const codeVerifier = generateRandomString(32);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  console.log('🔐 PKCE Flow Started');
  console.log('Verifier:', codeVerifier);
  console.log('Challenge:', codeChallenge);
  console.log('Callback URL:', callbackUrl);
  console.log('Auth URL:', authUrl);

  localStorage.setItem('pkce_code_verifier', codeVerifier);
  window.location.href = authUrl;
}

export async function handleCallback(): Promise<boolean> {
  const code = urlParams.get('code');

  console.log('🔄 Handling Callback');
  console.log('Code:', code);
  console.log('Verifier:', codeVerifier);

  // ... exchange code for key ...

  if (data.key) {
    console.log('✅ Authentication Successful');
    console.log('API Key:', data.key.substring(0, 20) + '...');
  }
}
```

---

## Common Issues

### ❌ Issue 1: "Code verifier not found"

**Symptom:** Error after redirect from OpenRouter

**Causes:**
1. `localStorage` disabled in browser
2. Cookies/storage cleared between redirect
3. Different origin (http vs https)
4. Incognito mode with storage disabled

**Solution:**
```typescript
// Check localStorage availability
try {
  localStorage.setItem('test', 'test');
  localStorage.removeItem('test');
} catch (e) {
  alert('localStorage not available. Please enable cookies.');
}
```

---

### ❌ Issue 2: Infinite Redirect Loop

**Symptom:** Constantly redirecting to OpenRouter

**Cause:** Not removing `?code=` from URL after processing

**Solution:**
```typescript
// After successful authentication
window.history.replaceState({}, document.title, window.location.pathname);
```

---

### ❌ Issue 3: "Invalid callback URL"

**Symptom:** OpenRouter shows error page

**Causes:**
1. Callback URL has typo
2. Missing protocol (https://)
3. Extra trailing characters

**Solution:**
```typescript
// Ensure clean callback URL
const callbackUrl = window.location.origin + window.location.pathname;
console.log('Callback URL:', callbackUrl);

// Should be exactly:
// http://localhost:5173/
// or
// https://username.github.io/RepoName/
```

---

### ❌ Issue 4: API Key Works Locally But Not on GitHub Pages

**Symptom:** 401 Unauthorized on production

**Cause:** Wrong `HTTP-Referer` header

**Solution:**
```typescript
headers: {
  'Authorization': `Bearer ${apiKey}`,
  'HTTP-Referer': window.location.origin,  // CRITICAL
  'X-Title': 'YourAppName',
}
```

The `HTTP-Referer` must match your deployed domain.

---

## Best Practices

### Security

1. **Never commit API keys** to source control
2. **Use HTTPS** in production (GitHub Pages provides this)
3. **Validate callback parameters** before processing
4. **Clear verifier** after successful exchange
5. **Implement logout** to clear stored keys

### User Experience

1. **Show loading state** during redirect
2. **Handle errors gracefully** with user-friendly messages
3. **Persist auth state** across page refreshes
4. **Auto-login on return** if key exists
5. **Add logout button** for user control

### Code Organization

```typescript
// auth.ts - All auth logic
export { initiateLogin, handleCallback, logout, isAuthenticated };

// main.ts - Initialize on load
async function initialize() {
  const authenticated = await handleCallback();

  if (authenticated || isAuthenticated()) {
    showAuthenticatedUI();
  } else {
    showLoginButton();
  }
}

// ui.ts - Visual state management
export function showAuthenticatedUI() {
  document.getElementById('loginBtn').classList.add('hidden');
  document.getElementById('logoutBtn').classList.remove('hidden');
}
```

---

## Complete Example

See **KavaChat** for a full working implementation:
- Repo: https://github.com/j-east/KavaChat
- Live: https://j-east.github.io/KavaChat/
- Files:
  - [`src/auth.ts`](https://github.com/j-east/KavaChat/blob/master/src/auth.ts) - PKCE implementation
  - [`src/main.ts`](https://github.com/j-east/KavaChat/blob/master/src/main.ts) - Initialization
  - [`src/chat.ts`](https://github.com/j-east/KavaChat/blob/master/src/chat.ts) - API usage

---

## Resources

- [OpenRouter OAuth Docs](https://openrouter.ai/docs/guides/overview/auth/oauth)
- [PKCE Specification (RFC 7636)](https://datatracker.ietf.org/doc/html/rfc7636)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

---

## Summary

PKCE OAuth with OpenRouter:
- ✅ No backend required
- ✅ No API key exposure
- ✅ No callback URL registration
- ✅ Works on GitHub Pages
- ✅ Secure for frontend-only apps
- ✅ Simple implementation (~100 lines)

Perfect for prototypes, demos, and production SPA deployments!
