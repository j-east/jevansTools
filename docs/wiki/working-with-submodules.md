# Working with Git Submodules

A practical guide to managing multiple independent projects within jevansTools using Git submodules.

## Table of Contents
1. [What Are Submodules?](#what-are-submodules)
2. [Project Structure](#project-structure)
3. [Cloning jevansTools](#cloning-jevanstools)
4. [Working with Submodules](#working-with-submodules)
5. [Common Workflows](#common-workflows)
6. [Troubleshooting](#troubleshooting)

---

## What Are Submodules?

Git submodules allow you to keep a Git repository as a subdirectory of another Git repository. This lets us:

- ✅ Maintain separate GitHub Pages deployments for each project
- ✅ Keep independent development histories
- ✅ Centralize documentation in jevansTools
- ✅ Track specific commits of each subproject
- ✅ Work on projects independently

### Our Submodules

| Submodule | Repository | GitHub Pages |
|-----------|------------|--------------|
| `KavaChat` | [j-east/KavaChat](https://github.com/j-east/KavaChat) | [Live Demo](https://j-east.github.io/KavaChat/) |
| `depthmap-to-stl-2` | [j-east/depthmap-to-stl-2](https://github.com/j-east/depthmap-to-stl-2) | [Live Demo](https://j-east.github.io/depthmap-to-stl-2/) |
| `roo-sniffer` | Local only (not a submodule) | N/A |

---

## Project Structure

```
jevansTools/                    # Parent repository
├── .gitmodules                 # Submodule configuration
├── docs/
│   └── wiki/                   # Centralized documentation
├── KavaChat/                   # Submodule → j-east/KavaChat
│   ├── .git/                   # Points to KavaChat repo
│   └── ...                     # Independent project files
├── depthmap-to-stl-2/          # Submodule → j-east/depthmap-to-stl-2
│   ├── .git/                   # Points to depthmap repo
│   └── ...                     # Independent project files
└── roo-sniffer/                # Regular directory (not a submodule)
```

### What Gets Tracked Where?

**jevansTools tracks:**
- `.gitmodules` file (submodule configuration)
- Specific commit hash for each submodule
- Shared documentation in `docs/wiki/`

**Each submodule tracks:**
- Its own source code
- Its own commit history
- Its own GitHub Pages deployment

---

## Cloning jevansTools

### First Time Clone

When cloning jevansTools, submodules are **empty by default**. You need to initialize them:

```bash
# Clone the main repository
git clone https://github.com/j-east/jevansTools.git
cd jevansTools

# Initialize and clone all submodules
git submodule update --init --recursive
```

### One-Line Clone (Recommended)

```bash
# Clone with submodules in one command
git clone --recurse-submodules https://github.com/j-east/jevansTools.git
```

### After Cloning

Verify submodules are loaded:

```bash
ls -la KavaChat/        # Should show project files
ls -la depthmap-to-stl-2/  # Should show project files

# Check submodule status
git submodule status
```

Expected output:
```
 d14bdcc... KavaChat (heads/master)
 abc1234... depthmap-to-stl-2 (heads/main)
```

---

## Working with Submodules

### Making Changes to a Submodule

Submodules are independent Git repositories. Work on them like normal repos:

```bash
# Navigate to the submodule
cd KavaChat

# Check what repo you're in
git remote -v
# origin  https://github.com/j-east/KavaChat.git

# Make changes
vim src/main.ts

# Commit as usual
git add .
git commit -m "Update feature"
git push origin master

# Return to parent repo
cd ..
```

### Updating Parent Repo After Submodule Changes

After pushing changes to a submodule, update the parent repo to track the new commit:

```bash
# Parent repo now sees submodule has new commits
git status
# modified:   KavaChat (new commits)

# Stage the submodule update
git add KavaChat

# Commit the new submodule reference
git commit -m "Update KavaChat to latest version"
git push
```

---

## Common Workflows

### Workflow 1: Update KavaChat

```bash
# Step 1: Work on KavaChat
cd KavaChat
git pull origin master          # Get latest
# ... make changes ...
git add .
git commit -m "Add new feature"
git push origin master

# Step 2: Update jevansTools reference
cd ..
git add KavaChat
git commit -m "Update KavaChat submodule"
git push
```

### Workflow 2: Pull Latest Changes

```bash
# Pull jevansTools changes
git pull

# Update all submodules to tracked commits
git submodule update --recursive

# Or update submodules to their latest remote commits
git submodule update --remote --recursive
```

### Workflow 3: Add a New Submodule

```bash
# Add new project as submodule
git submodule add https://github.com/j-east/new-project.git new-project

# Commit the addition
git commit -m "Add new-project as submodule"
git push
```

### Workflow 4: Remove a Submodule

```bash
# Remove from .gitmodules and staging
git submodule deinit -f depthmap-to-stl-2
git rm -f depthmap-to-stl-2

# Commit the removal
git commit -m "Remove depthmap-to-stl-2 submodule"
git push

# Clean up .git/modules (optional)
rm -rf .git/modules/depthmap-to-stl-2
```

---

## Troubleshooting

### ❌ Submodule Directory is Empty

**Symptom:**
```bash
ls KavaChat/
# (empty)
```

**Solution:**
```bash
git submodule update --init --recursive
```

---

### ❌ "fatal: not a git repository"

**Symptom:** Error when trying to commit in submodule directory

**Cause:** Submodules not initialized

**Solution:**
```bash
cd ..  # Go to parent repo
git submodule update --init --recursive
cd KavaChat  # Try again
```

---

### ❌ Submodule Shows "Modified" But No Changes

**Symptom:**
```bash
git status
# modified:   KavaChat (modified content)

cd KavaChat
git status
# nothing to commit, working tree clean
```

**Cause:** Parent repo tracking different commit than submodule HEAD

**Solution:**
```bash
# See what commit parent expects
cd ..
git diff KavaChat

# Update to expected commit
cd KavaChat
git checkout <expected-commit-hash>

# Or update parent to track current commit
cd ..
git add KavaChat
git commit -m "Update KavaChat reference"
```

---

### ❌ Can't Push to Submodule

**Symptom:**
```bash
cd KavaChat
git push
# ERROR: Permission denied
```

**Cause:** HTTPS URL requires authentication each time

**Solution:** Use SSH URLs instead:

```bash
# In parent repo, update submodule URL
git config -f .gitmodules submodule.KavaChat.url git@github.com:j-east/KavaChat.git
git submodule sync

# Verify
cat .gitmodules
# url = git@github.com:j-east/KavaChat.git
```

---

### ❌ Detached HEAD in Submodule

**Symptom:**
```bash
cd KavaChat
git status
# HEAD detached at d14bdcc
```

**Cause:** Submodules default to specific commits, not branches

**Solution:**
```bash
# Check out the branch
git checkout master

# Or set submodule to track branch
cd ..
git config -f .gitmodules submodule.KavaChat.branch master
git submodule update --remote
```

---

## Best Practices

### 1. Always Update Parent After Submodule Changes

```bash
# After pushing to KavaChat
cd ..
git add KavaChat
git commit -m "Update KavaChat to v1.2.3"
```

### 2. Use Meaningful Submodule Commit Messages

```bash
# ❌ Bad
git commit -m "Update submodule"

# ✅ Good
git commit -m "Update KavaChat: Add dark mode feature"
```

### 3. Pull Submodules Regularly

```bash
# Update all submodules to latest
git submodule update --remote --recursive

# Commit the updates
git add .
git commit -m "Update all submodules to latest"
```

### 4. Document Submodule Purposes

Keep this wiki updated with:
- What each submodule is for
- Links to live demos
- Deployment status

---

## GitHub Pages Deployment

Each submodule can have its own GitHub Actions workflow for deployment:

### KavaChat
- **Repo:** https://github.com/j-east/KavaChat
- **Workflow:** `.github/workflows/deploy.yml`
- **Deploys to:** https://j-east.github.io/KavaChat/
- **On push to:** `master` branch

### depthmap-to-stl-2
- **Repo:** https://github.com/j-east/depthmap-to-stl-2
- **Workflow:** `.github/workflows/deploy.yml`
- **Deploys to:** https://j-east.github.io/depthmap-to-stl-2/
- **On push to:** `main` branch

**Key Point:** Changes to submodules trigger their own deployments. The parent repo (jevansTools) doesn't deploy submodule code.

---

## Quick Reference

### Initialization
```bash
# First time setup
git clone --recurse-submodules https://github.com/j-east/jevansTools.git

# If already cloned
git submodule update --init --recursive
```

### Status
```bash
# Check submodule status
git submodule status

# Check which commit parent tracks
git ls-tree HEAD KavaChat
```

### Updates
```bash
# Pull latest from submodules
git submodule update --remote

# Update to tracked commits
git submodule update
```

### Working in Submodules
```bash
cd KavaChat              # Enter submodule
git checkout master      # Switch to branch
git pull                 # Get latest
# ... make changes ...
git push                 # Push changes

cd ..                    # Return to parent
git add KavaChat         # Track new commit
git commit -m "Update"   # Commit reference
git push                 # Push parent
```

---

## Additional Resources

- [Git Submodules Documentation](https://git-scm.com/book/en/v2/Git-Tools-Submodules)
- [GitHub Submodules Guide](https://github.blog/2016-02-01-working-with-submodules/)
- [Deploying to GitHub Pages](./deploying-to-github-pages.md)

---

## Summary

Submodules give us the best of both worlds:
- ✅ Independent repositories with their own history
- ✅ Separate GitHub Pages deployments
- ✅ Centralized documentation and organization
- ✅ Version control for which commit of each project we're using

Perfect for maintaining a cohesive toolkit while keeping projects modular!
