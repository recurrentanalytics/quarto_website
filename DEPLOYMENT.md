# Deployment Guide

This guide explains how to safely build and deploy the Quarto website to GitHub Pages.

## Prerequisites

1. **GitHub Pages must be configured**:
   - Go to your repository Settings → Pages
   - Under "Source", select **"GitHub Actions"** (not "Deploy from a branch")
   - Save the settings

2. **Repository permissions**:
   - The GitHub Actions workflow needs write permissions to deploy
   - These are automatically granted when you enable GitHub Actions

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

### Automatic Deployment (Recommended)

The site automatically deploys when you push to the `main` branch:

```bash
# Make your changes, then:
git add .
git commit -m "Your commit message"
git push origin main
```

**What happens:**
1. GitHub Actions workflow triggers automatically
2. Site is built using Quarto
3. `CNAME` file is preserved
4. Site is deployed to GitHub Pages
5. Site goes live (usually within 1-2 minutes)

**Monitor deployment:**
- Go to the "Actions" tab in your GitHub repository
- Watch the workflow run in real-time
- Check for any errors

### Manual Deployment

If you need to manually trigger deployment:

1. Go to your repository on GitHub
2. Click the "Actions" tab
3. Select "Deploy to GitHub Pages" workflow
4. Click "Run workflow" → "Run workflow"
5. Select the branch (usually `main`)
6. Click "Run workflow"

## Important Notes

### CNAME File Preservation

The workflow automatically ensures the `CNAME` file is present in `_site/`:
- If `CNAME` exists in the root, it's copied to `_site/`
- This preserves your custom domain (recurrentanalytics.com)

### Branch Name

The workflow is configured for the `main` branch. If your default branch is different:
1. Edit `.github/workflows/deploy.yml`
2. Change `branches: - main` to your branch name (e.g., `master`)

### Custom Domain

If you're using a custom domain:
- The `CNAME` file must exist in the repository root
- GitHub Pages will automatically use it
- DNS must be configured correctly (see GitHub Pages docs)

## Troubleshooting

### Build Fails in GitHub Actions

1. **Check the Actions log**:
   - Go to Actions tab → Click on failed workflow
   - Expand the failed step to see error details

2. **Common issues**:
   - Missing Python dependencies → Check `requirements.txt`
   - Quarto version issues → Workflow uses latest Quarto
   - Python code errors → Test locally first

3. **Fix and retry**:
   - Fix the issue locally
   - Test with `quarto render`
   - Commit and push again

### Site Not Updating

1. **Check deployment status**:
   - Go to Settings → Pages
   - Check "Latest deployment" status

2. **Verify workflow ran**:
   - Go to Actions tab
   - Ensure workflow completed successfully

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

2. **Check deployment**:
   - Go to Actions → Latest workflow run
   - Check "Verify CNAME file exists" step

3. **Manual fix** (if needed):
   ```bash
   # Ensure CNAME is in root
   echo "recurrentanalytics.com" > CNAME
   git add CNAME
   git commit -m "Restore CNAME file"
   git push
   ```

## Rollback

If you need to rollback to a previous version:

1. **Find the previous commit**:
   ```bash
   git log --oneline
   ```

2. **Revert or checkout**:
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

   Or:
   ```bash
   git checkout <commit-hash> -- .
   git commit -m "Rollback to previous version"
   git push origin main
   ```

## Best Practices

1. ✅ **Always test locally first** - Use `quarto render` and preview
2. ✅ **Commit frequently** - Small commits are easier to debug
3. ✅ **Check Actions tab** - Monitor deployments for issues
4. ✅ **Keep CNAME in root** - Don't delete or modify unnecessarily
5. ✅ **Use meaningful commit messages** - Helps track changes

## Quick Reference

```bash
# Local development
conda activate recurrent-analytics
./dev.sh build      # Build site
./dev.sh preview    # Preview site

# Deploy
git add .
git commit -m "Update site"
git push origin main

# Check deployment
# → Go to GitHub Actions tab
```

