# Deploying Frontend Apps to GitHub Pages

A comprehensive guide based on building and deploying KavaChat - a TypeScript + Vite application with OpenRouter OAuth integration.

## Table of Contents
1. [Project Setup](#project-setup)
2. [Vite Configuration](#vite-configuration)
3. [GitHub Actions Workflow](#github-actions-workflow)
4. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
5. [Verification Checklist](#verification-checklist)

---

## Project Setup

### Repository Structure
For a clean deployment, create a dedicated repository for your frontend app:

```bash
# Create your project directory
mkdir MyApp
cd MyApp

# Initialize git
git init

# Create basic structure
mkdir src
mkdir .github/workflows
```

### Essential Files
- `package.json` - Dependencies and build scripts
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Vite build configuration
- `.gitignore` - Must include `node_modules` and `dist`
- `.github/workflows/deploy.yml` - GitHub Actions workflow

---

## Vite Configuration

The most critical aspect of GitHub Pages deployment is the **base path**.

### Understanding Base Paths

GitHub Pages serves your site at different URLs depending on the repo type:

| Repo Type | URL Pattern | Base Path |
|-----------|-------------|-----------|
| User/Org site | `username.github.io` | `/` |
| Project site | `username.github.io/repo-name` | `/repo-name/` |

### vite.config.ts

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  // CRITICAL: Must match your GitHub Pages URL structure
  base: '/KavaChat/',  // For project repos
  // base: '/',        // For username.github.io repos

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
```

### What Happens During Build

When you run `npm run build`, Vite:
1. Compiles TypeScript to JavaScript
2. Bundles all modules
3. Generates `dist/index.html` with correct asset paths
4. Creates hashed asset files in `dist/assets/`

**Example built `index.html`:**
```html
<!-- With base: '/KavaChat/' -->
<script type="module" src="/KavaChat/assets/index-abc123.js"></script>

<!-- With base: '/' -->
<script type="module" src="/assets/index-abc123.js"></script>
```

---

## GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - master  # or main

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Build
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### Key Points

1. **Two Jobs**: `build` and `deploy` run sequentially
2. **Permissions**: Required for GitHub Pages deployment
3. **Artifact Upload**: Only the `dist` folder is deployed
4. **Node Version**: Pin to specific version for reproducibility

---

## Common Pitfalls & Solutions

### ❌ Problem 1: 404 on JavaScript Files

**Symptom:**
```
GET https://user.github.io/assets/index-abc123.js
404 (Not Found)
```

**Cause:** Wrong base path in `vite.config.ts`

**Solution:**
```typescript
// ❌ Wrong for project repos
base: '/',

// ✅ Correct
base: '/YourRepoName/',
```

---

### ❌ Problem 2: Blank Page / No Console Errors

**Symptom:** Page loads but nothing renders

**Possible Causes:**
1. JavaScript not loading (check Network tab)
2. Build failed silently (check Actions logs)
3. Old build cached (hard refresh: Cmd+Shift+R)

**Solution:**
```bash
# Locally verify build works
npm run build
npm run preview  # Test the production build

# Check what's in dist/
ls -la dist/
cat dist/index.html | grep script
```

---

### ❌ Problem 3: GitHub Actions Builds But Old Code Deploys

**Symptom:** New commits don't show up on live site

**Cause:** GitHub Pages cache or wrong artifact uploaded

**Solution:**
1. Wait 2-3 minutes for cache to clear
2. Verify workflow completed: `https://github.com/user/repo/actions`
3. Check the artifact contains new code
4. Try hard refresh in browser

---

### ❌ Problem 4: TypeScript Errors in Build

**Symptom:**
```
error TS6133: 'variable' is declared but its value is never read.
```

**Solution:**
```typescript
// Remove unused variables
// const unused = 123;  ❌

// Or disable strict checks (not recommended)
// tsconfig.json
{
  "compilerOptions": {
    "noUnusedLocals": false,
    "noUnusedParameters": false
  }
}
```

---

## Verification Checklist

Before pushing to GitHub:

- [ ] `npm run build` succeeds locally
- [ ] `npm run preview` shows working app
- [ ] `vite.config.ts` has correct `base` path
- [ ] `.gitignore` includes `dist/` and `node_modules/`
- [ ] Workflow file is in `.github/workflows/`
- [ ] `package.json` has `build` script

After pushing:

- [ ] Actions workflow runs successfully
- [ ] Green checkmark on latest commit
- [ ] Settings > Pages shows "GitHub Actions" source
- [ ] Site loads at `https://username.github.io/repo-name/`
- [ ] No 404 errors in browser console
- [ ] Hard refresh (Cmd+Shift+R) shows latest changes

---

## Quick Reference

### Build & Deploy Flow
```
Local Changes
    ↓
git push
    ↓
GitHub Actions triggered
    ↓
npm install
    ↓
npm run build (creates dist/)
    ↓
Upload dist/ as artifact
    ↓
Deploy to GitHub Pages
    ↓
Live at username.github.io/repo
```

### Useful Commands
```bash
# Local development
npm run dev

# Test production build locally
npm run build
npm run preview

# Force rebuild & deploy
git commit --allow-empty -m "Trigger rebuild"
git push
```

### Debugging URLs
- Actions logs: `https://github.com/USER/REPO/actions`
- Pages settings: `https://github.com/USER/REPO/settings/pages`
- Live site: `https://USER.github.io/REPO/`

---

## Example: KavaChat Deployment

**Repository:** `https://github.com/j-east/KavaChat`
**Live Site:** `https://j-east.github.io/KavaChat/`

**Key Configuration:**
- Base path: `/KavaChat/`
- Build command: `tsc && vite build`
- Output directory: `dist`
- Node version: 20

**Deployment Time:** ~1-2 minutes per push

---

## Next Steps

Once deployment works:
1. Set up custom domain (optional)
2. Add build status badge to README
3. Configure deployment branch protection
4. Set up preview deployments for PRs

See [OpenRouter OAuth Integration](./openrouter-oauth-integration.md) for authentication setup.
