# Git Repository Recovery Guide

**IMPORTANT**: The git repository has index corruption. Follow these steps carefully.

## Quick Diagnosis

Run this command to check the issue:
```bash
git status
```

If you see:
- "short read while indexing" errors
- Commands hanging for more than 30 seconds
- "Unable to create index.lock" errors

Then proceed with the recovery steps below.

## Recovery Options (Try in Order)

### Option 1: Simple Index Rebuild (5 minutes)

```bash
# 1. Remove corrupted index files
rm -f .git/index
rm -f .git/index.lock

# 2. Rebuild index from HEAD
git reset

# 3. Test if it worked
git status

# If successful, you should see modified files listed
```

### Option 2: Force Reset (10 minutes)

```bash
# 1. Kill any stuck git processes
pkill -f git

# 2. Remove all git locks and index
rm -f .git/index
rm -f .git/index.lock
rm -rf .git/objects.lock

# 3. Force reset to HEAD
git reset --hard origin/main

# 4. Re-apply changes from backup
# See backup_changes.sh script
```

### Option 3: Fresh Clone Method (RECOMMENDED - 15 minutes)

This is the most reliable method:

```bash
# 1. Go to parent directory
cd ..

# 2. Clone fresh repository
git clone [YOUR_REPO_URL] clif_web_markdown_fresh

# 3. Copy the changed files
cp clif_web_markdown/src/pages/data-dictionary/data-dictionary-1.0.0.astro clif_web_markdown_fresh/src/pages/data-dictionary/
cp clif_web_markdown/src/pages/data-dictionary/data-dictionary-2.0.0.astro clif_web_markdown_fresh/src/pages/data-dictionary/
cp clif_web_markdown/src/pages/data-dictionary/data-dictionary-2.1.0.astro clif_web_markdown_fresh/src/pages/data-dictionary/
cp clif_web_markdown/CLAUDE.md clif_web_markdown_fresh/
cp clif_web_markdown/HANDOVER.md clif_web_markdown_fresh/
cp clif_web_markdown/CHANGES_SUMMARY.md clif_web_markdown_fresh/
cp clif_web_markdown/GIT_RECOVERY.md clif_web_markdown_fresh/
cp clif_web_markdown/backup_changes.sh clif_web_markdown_fresh/

# 4. Move to fresh directory
cd clif_web_markdown_fresh

# 5. Stage and commit
git add -A
git status  # Verify files are staged
git commit -m "feat: Enhance data dictionary with color coding and fix underscore display

- Fix underscore escaping in variable names
- Add comprehensive color scheme for field types
- Add sidebar navigation to all versions
- Remove [Anchor] text from headings
- Create handover documentation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Files That Need to Be Committed

The following files contain changes:

1. **src/pages/data-dictionary/data-dictionary-2.0.0.astro**
   - Lines 176-197: Fixed underscore escaping
   - Lines 152-266: Added color scheme function
   - Lines 269-283: Added sidebar configuration

2. **src/pages/data-dictionary/data-dictionary-1.0.0.astro**
   - Lines 147-246: Added sidebar navigation
   - Lines 21-78: Removed [Anchor] text

3. **src/pages/data-dictionary/data-dictionary-2.1.0.astro**
   - Lines 164-311: Added sidebar with Beta/Concept sections
   - Lines 21-78: Removed [Anchor] text

4. **CLAUDE.md**
   - Lines 106-108: Added recent enhancements
   - Lines 146-162: Added known issues section

5. **New Files Created**:
   - HANDOVER.md
   - CHANGES_SUMMARY.md
   - GIT_RECOVERY.md
   - backup_changes.sh (to be created)

## Verification Steps

After recovery, verify the changes:

```bash
# 1. Check git status
git status

# 2. View the changes
git diff --cached

# 3. Test the website
npm install  # If needed
npm run dev

# 4. Navigate to http://localhost:4321/data-dictionary/data-dictionary-2.0.0
# Verify:
# - Variable names show without backslashes (e.g., location_category)
# - Fields are color-coded
# - Sidebar navigation works
```

## Troubleshooting

### If git commands still timeout:
- Your repository might be on a slow network drive (Dropbox/iCloud)
- Try: `git config core.preloadindex false`
- Or move the repository to local disk first

### If files appear corrupted:
- Use the backup files: `*.backup_original`
- Or download from the last known good commit

### If npm install fails:
- Delete node_modules: `rm -rf node_modules`
- Clear npm cache: `npm cache clean --force`
- Try again: `npm install`

## Need Help?

Check these files for more information:
- HANDOVER.md - Complete project handover guide
- CHANGES_SUMMARY.md - Detailed list of all changes
- CLAUDE.md - Project documentation and known issues