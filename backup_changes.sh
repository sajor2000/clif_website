#!/bin/bash

# CLIF Website - Backup Changed Files Script
# Created: July 18, 2025
# Purpose: Backup all modified files for easy restoration

echo "==================================="
echo "CLIF Website Change Backup Script"
echo "==================================="

# Create backup directory with timestamp
BACKUP_DIR="clif_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "Creating backup in: $BACKUP_DIR"

# Create subdirectories
mkdir -p "$BACKUP_DIR/src/pages/data-dictionary"
mkdir -p "$BACKUP_DIR/documentation"

# Copy modified Astro files
echo "Backing up data dictionary files..."
cp src/pages/data-dictionary/data-dictionary-1.0.0.astro "$BACKUP_DIR/src/pages/data-dictionary/" 2>/dev/null || echo "Warning: Could not copy data-dictionary-1.0.0.astro"
cp src/pages/data-dictionary/data-dictionary-2.0.0.astro "$BACKUP_DIR/src/pages/data-dictionary/" 2>/dev/null || echo "Warning: Could not copy data-dictionary-2.0.0.astro"
cp src/pages/data-dictionary/data-dictionary-2.1.0.astro "$BACKUP_DIR/src/pages/data-dictionary/" 2>/dev/null || echo "Warning: Could not copy data-dictionary-2.1.0.astro"

# Copy documentation files
echo "Backing up documentation..."
cp CLAUDE.md "$BACKUP_DIR/documentation/" 2>/dev/null || echo "Warning: Could not copy CLAUDE.md"
cp HANDOVER.md "$BACKUP_DIR/documentation/" 2>/dev/null || echo "Warning: Could not copy HANDOVER.md"
cp CHANGES_SUMMARY.md "$BACKUP_DIR/documentation/" 2>/dev/null || echo "Warning: Could not copy CHANGES_SUMMARY.md"
cp GIT_RECOVERY.md "$BACKUP_DIR/documentation/" 2>/dev/null || echo "Warning: Could not copy GIT_RECOVERY.md"
cp QUICK_START.md "$BACKUP_DIR/documentation/" 2>/dev/null || echo "Note: QUICK_START.md not found (might not be created yet)"

# Copy this script too
cp backup_changes.sh "$BACKUP_DIR/" 2>/dev/null

# Create manifest file
echo "Creating manifest..."
cat > "$BACKUP_DIR/MANIFEST.txt" << 'EOF'
CLIF Website Backup Manifest
============================

This backup contains all files modified on July 18, 2025 to:
1. Fix underscore display issues in data dictionary
2. Add color coding for field types
3. Add sidebar navigation
4. Remove [Anchor] text from headings

Modified Files:
--------------
src/pages/data-dictionary/data-dictionary-1.0.0.astro
src/pages/data-dictionary/data-dictionary-2.0.0.astro
src/pages/data-dictionary/data-dictionary-2.1.0.astro
CLAUDE.md
HANDOVER.md
CHANGES_SUMMARY.md
GIT_RECOVERY.md
QUICK_START.md (if exists)

To restore these files to a fresh clone:
---------------------------------------
1. Clone fresh repository
2. Run: ./restore_from_backup.sh [backup_directory]

Or manually copy each file to its location in the fresh clone.
EOF

# Create restore script
echo "Creating restore script..."
cat > "$BACKUP_DIR/restore_from_backup.sh" << 'EOF'
#!/bin/bash

# Restore script for CLIF website changes

if [ -z "$1" ]; then
    echo "Usage: ./restore_from_backup.sh [target_directory]"
    echo "Example: ./restore_from_backup.sh ../clif_web_markdown_fresh"
    exit 1
fi

TARGET_DIR="$1"

if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: Target directory does not exist: $TARGET_DIR"
    exit 1
fi

echo "Restoring files to: $TARGET_DIR"

# Create directories if needed
mkdir -p "$TARGET_DIR/src/pages/data-dictionary"

# Copy files
cp -v src/pages/data-dictionary/*.astro "$TARGET_DIR/src/pages/data-dictionary/"
cp -v documentation/*.md "$TARGET_DIR/"

echo "Restoration complete!"
echo "Next steps:"
echo "1. cd $TARGET_DIR"
echo "2. git add -A"
echo "3. git commit -m 'feat: Enhance data dictionary with color coding'"
EOF

chmod +x "$BACKUP_DIR/restore_from_backup.sh"

# Create tarball
echo "Creating compressed archive..."
tar -czf "${BACKUP_DIR}.tar.gz" "$BACKUP_DIR"

# Summary
echo ""
echo "==================================="
echo "Backup Complete!"
echo "==================================="
echo "Backup directory: $BACKUP_DIR"
echo "Compressed archive: ${BACKUP_DIR}.tar.gz"
echo ""
echo "Files backed up:"
ls -la "$BACKUP_DIR/src/pages/data-dictionary/"
ls -la "$BACKUP_DIR/documentation/"
echo ""
echo "To restore to a fresh clone:"
echo "1. Extract: tar -xzf ${BACKUP_DIR}.tar.gz"
echo "2. cd $BACKUP_DIR"
echo "3. ./restore_from_backup.sh [path_to_fresh_clone]"
echo "===================================="