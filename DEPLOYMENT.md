# Deployment Guide

This guide explains how to safely build and deploy the Quarto website to GitHub Pages.

## Prerequisites

1. **GitHub Pages must be configured**:
   - Go to your repository Settings → Pages
   - Under "Source", select **"Deploy from a branch"**
   - Branch: `gh-pages` / `root`
   - Save the settings

2. **Repository setup**:
   - Ensure you have push access to the repository
   - The `gh-pages` branch will contain the built site

## Local Development Workflow

### Step 1: Build Locally

Always test your changes locally before deploying:

```bash
# Activate conda environment
conda activate recurrent-analytics

# Build the site
quarto render

# Or use the convenience script
./dev.sh build
```

### Step 2: Preview Locally

Preview the built site to catch any issues:

```bash
# Option 1: Use Quarto preview
quarto preview

# Option 2: Use the convenience script
./dev.sh preview

# Option 3: Use Python server
python server.py
# Then open http://localhost:5000
```

### Step 3: Verify Build

Check that:
- ✅ All pages render correctly
- ✅ `_site/CNAME` file exists (for custom domain)
- ✅ All links work
- ✅ Images and assets load properly
- ✅ No console errors in browser

## Deployment Workflow

### Manual Deployment to GitHub Pages

The site is deployed by pushing the built `_site/` directory to the `gh-pages` branch:

```bash
# 1. Build the site (from dev branch)
conda activate recurrent-analytics
quarto render

# 2. Switch to gh-pages branch (or create it)
git checkout gh-pages || git checkout -b gh-pages

# 3. Copy built site contents to root
cp -r _site/* .

# 4. Ensure CNAME is present
if [ -f CNAME ]; then
  cp CNAME _site/CNAME 2>/dev/null || true
fi

# 5. Stage all changes
git add .

# 6. Commit (use descriptive message)
git commit -m "Deploy site - $(date +%Y-%m-%d)"

# 7. Push to gh-pages branch
git push origin gh-pages

# 8. Switch back to dev branch
git checkout dev
```

**What happens:**
1. Site is built locally using Quarto
2. Built files are copied to `gh-pages` branch
3. `CNAME` file is preserved for custom domain
4. Changes are pushed to GitHub
5. GitHub Pages serves the site from `gh-pages` branch
6. Site goes live (usually within 1-2 minutes)

**Monitor deployment:**
- Go to Settings → Pages in your GitHub repository
- Check "Latest deployment" status
- Wait for deployment to complete (usually 1-2 minutes)

## Important Notes

### CNAME File Preservation

The `CNAME` file must be present in both:
- Repository root (source)
- `_site/` directory (after build)

Quarto should automatically copy it during build, but verify:
```bash
ls -la _site/CNAME
```

### Branch Workflow

- **`dev` branch**: Contains source files (`.qmd`, config, etc.)
- **`gh-pages` branch**: Contains built site (`_site/` contents)

**Best practice:**
- Work on `dev` branch
- Only push built files to `gh-pages` branch
- Never commit source files to `gh-pages` branch

### Custom Domain

If you're using a custom domain:
- The `CNAME` file must exist in the repository root
- It should contain: `recurrentanalytics.com`
- DNS must be configured correctly (see GitHub Pages docs)
- GitHub Pages will automatically use it when serving from `gh-pages` branch

## Troubleshooting

### Build Fails Locally

1. **Check Python environment**:
   ```bash
   conda activate recurrent-analytics
   conda list
   ```

2. **Verify Quarto installation**:
   ```bash
   quarto check
   ```

3. **Common issues**:
   - Missing Python dependencies → Check `environment.yml` or `requirements.txt`
   - Python code errors → Test individual files: `quarto render path/to/file.qmd`
   - Import errors → Verify `src/__init__.py` exists

4. **Fix and rebuild**:
   - Fix the issue locally
   - Test with `quarto render`
   - Rebuild before deploying

### Site Not Updating

1. **Check deployment status**:
   - Go to Settings → Pages
   - Check "Latest deployment" status
   - Verify `gh-pages` branch has latest commit

2. **Verify files were pushed**:
   ```bash
   git checkout gh-pages
   ls -la index.html  # Should exist
   git checkout dev
   ```

3. **Clear browser cache**:
   - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
   - Or wait a few minutes for CDN to update

### CNAME File Missing

If your custom domain stops working:

1. **Verify CNAME exists**:
   ```bash
   ls -la CNAME
   cat CNAME
   ```

2. **Check in _site/**:
   ```bash
   ls -la _site/CNAME
   ```

3. **Manual fix** (if needed):
   ```bash
   # Ensure CNAME is in root
   echo "recurrentanalytics.com" > CNAME
   git add CNAME
   git commit -m "Restore CNAME file"
   git push origin dev
   
   # Rebuild and redeploy
   quarto render
   git checkout gh-pages
   cp -r _site/* .
   git add .
   git commit -m "Update CNAME in deployment"
   git push origin gh-pages
   git checkout dev
   ```

## Rollback

If you need to rollback to a previous version:

1. **Find the previous commit on gh-pages**:
   ```bash
   git checkout gh-pages
   git log --oneline
   ```

2. **Revert to previous commit**:
   ```bash
   git checkout <commit-hash>
   git push origin gh-pages --force
   ```

   **Warning**: Force pushing rewrites history. Only do this if necessary.

3. **Or revert specific files**:
   ```bash
   git checkout <commit-hash> -- path/to/file
   git commit -m "Revert file to previous version"
   git push origin gh-pages
   ```

## Best Practices

1. ✅ **Always test locally first** - Use `quarto render` and preview
2. ✅ **Commit frequently on dev** - Small commits are easier to debug
3. ✅ **Verify build before deploying** - Check `_site/` directory contents
4. ✅ **Keep CNAME in root** - Don't delete or modify unnecessarily
5. ✅ **Use meaningful commit messages** - Helps track changes
6. ✅ **Never commit source files to gh-pages** - Only built files
7. ✅ **Check deployment status** - Verify site updates after push

## Quick Reference

```bash
# Local development
conda activate recurrent-analytics
./dev.sh build      # Build site
./dev.sh preview    # Preview site

# Deploy
quarto render
git checkout gh-pages
cp -r _site/* .
git add .
git commit -m "Deploy site"
git push origin gh-pages
git checkout dev

# Check deployment
# → Go to Settings → Pages in GitHub
```
