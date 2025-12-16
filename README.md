# re:current_analytics

A Quarto-based static website for climate risk, models, and analytics. This site serves as a public lab notebook with notes, projects, models, and reading materials.

## Overview

This is a Quarto website project that combines:
- **Notes** - Lab journal entries and knowledge base articles
- **Projects** - Models, tools, demos, and packaged work
- **Reading** - Reading notes and literature reviews
- **Interactive Features** - Graph navigation, command palette, keyboard shortcuts

## Project Structure

```
quarto_website/
├── _quarto.yml          # Quarto configuration
├── _site/               # Built static HTML output (served in production)
├── models/              # Model/project files (.qmd)
├── notes/               # Lab journal entries
├── projects/            # Project listing page
├── reading/             # Reading notes
├── src/                 # Python modules for data processing
│   ├── __init__.py
│   ├── data_download.py    # OPSD data loading utilities
│   ├── heatwave_defs.py    # Heatwave flagging functions
│   └── climate_extremes.py  # Climate extremes analysis
├── data/
│   ├── raw/             # Raw data files (OPSD CSVs go here)
│   └── processed/       # Processed parquet files
├── assets/              # Static assets (favicon, logo)
├── styles.scss          # Custom styling
├── environment.yml      # Conda environment specification
└── server.py            # Simple HTTP server for local development
```

## Setup

### Prerequisites

- [Quarto](https://quarto.org/) installed
- [Conda](https://docs.conda.io/) or [Miniconda](https://docs.conda.io/en/latest/miniconda.html)

### Installation

1. **Clone the repository** (if applicable):
   ```bash
   git clone <repository-url>
   cd quarto_website
   ```

2. **Create the conda environment**:
   ```bash
   conda env create -f environment.yml
   conda activate recurrent-analytics
   ```

3. **Verify Quarto installation**:
   ```bash
   quarto --version
   ```

4. **Install Quarto** (if not already installed):
   - Follow instructions at https://quarto.org/docs/get-started/

## Development Workflow

### Local Development

1. **Activate the conda environment**:
   ```bash
   conda activate recurrent-analytics
   ```

2. **Render the site**:
   ```bash
   quarto render
   ```

3. **Preview locally**:
   ```bash
   # Option 1: Use Quarto's preview server
   quarto preview
   
   # Option 2: Use the included Python server
   python server.py
   # Then open http://localhost:5000
   ```

### Adding New Content

#### Adding a New Note

Create a new `.qmd` file in `notes/`:

```yaml
---
title: "Your Note Title"
date: YYYY-MM-DD
categories: [category1, category2]
---

Your content here...
```

#### Adding a New Model/Project

Create a new `.qmd` file in `models/`:

```yaml
---
title: "Your Project Title"
date: YYYY-MM-DD
categories: [category1, category2]
description: "Brief description for SEO and project listings"
execute:
  echo: true
  warning: false
  message: false
freeze: auto
---

Your analysis code here...
```

**Important**: 
- Use `from src.module_name import function_name` for imports (no `sys.path` hacks)
- Ensure `src/__init__.py` exists
- Set `freeze: auto` to cache execution results

### Code Execution

- Python code blocks execute using the conda environment's Python
- Execution settings are configured in `_quarto.yml` and individual file headers
- Use `freeze: auto` to cache results and speed up subsequent renders
- Code outputs (figures, tables) are automatically included in the rendered site

## Python Package Structure

The `src/` directory contains reusable Python modules:

- **`data_download.py`** - Functions for downloading and processing OPSD (Open Power System Data) datasets
- **`heatwave_defs.py`** - Heatwave identification and flagging functions
- **`climate_extremes.py`** - Climate extremes analysis functions (extreme value theory, clustering, etc.)

Import these modules in your `.qmd` files:
```python
from src.data_download import save_prices_from_opsd
from src.heatwave_defs import flag_heatwaves
from src.climate_extremes import generate_synthetic_climate_data
```

## Configuration

### Quarto Configuration (`_quarto.yml`)

- **Python path**: Configured to use the conda environment's Python
- **Execute directory**: Set to `project` (root directory)
- **Collections**: Notes and projects are configured as collections with feeds/listings
- **Custom JavaScript**: Includes graph navigation, command palette, keyboard shortcuts

### Styling (`styles.scss`)

Custom SCSS styles that layer on top of Bootstrap themes (Cosmo light, Cyborg dark).

## Deployment

### Local Development & Testing

1. **Build the site locally**:
   ```bash
   conda activate recurrent-analytics
   quarto render
   ```

2. **Preview locally**:
   ```bash
   # Option 1: Use Quarto's preview server
   quarto preview
   
   # Option 2: Use the included Python server
   python server.py
   # Then open http://localhost:5000
   ```

3. **Verify the build**:
   - Check that `_site/` directory contains all expected files
   - Verify `_site/CNAME` exists (for custom domain)
   - Test all pages and links locally

### GitHub Pages Deployment

The site is automatically deployed to GitHub Pages using GitHub Actions when you push to the `main` branch.

**Workflow:**
1. **Test locally first** (see above)
2. **Commit and push your changes**:
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin main
   ```
3. **GitHub Actions will automatically**:
   - Build the site using Quarto
   - Preserve the `CNAME` file for custom domain
   - Deploy to the `gh-pages` branch
   - Make the site live at your configured domain

**Manual deployment** (if needed):
- Go to Actions tab in GitHub
- Select "Deploy to GitHub Pages" workflow
- Click "Run workflow" → "Run workflow"

**Important Notes:**
- The `CNAME` file is automatically preserved during deployment
- The workflow uses GitHub Pages Actions (not the old `gh-pages` branch push method)
- Ensure GitHub Pages is enabled in your repository settings:
  - Settings → Pages → Source: "GitHub Actions"
- The site will be available at `https://recurrentanalytics.com` (or your configured domain)

### Other Deployment Options

- **Netlify**: Connect repository, set build command to `quarto render`, publish directory to `_site`
- **Vercel**: Similar to Netlify
- **Custom server**: Upload `_site/` contents to your web server

## Troubleshooting

### Import Errors

If you see import errors:
1. Ensure `src/__init__.py` exists
2. Don't use `sys.path` manipulation - imports should work directly
3. Verify you're in the conda environment: `conda activate recurrent-analytics`

### Rendering Errors

If rendering fails:
1. Check that all required Python packages are installed: `conda list`
2. Verify Quarto can find Python: `quarto check`
3. Try rendering individual files: `quarto render path/to/file.qmd`

### Port Already in Use

If port 5000 is in use:
```bash
# Find and kill the process
lsof -ti:5000 | xargs kill -9

# Or use a different port
quarto preview --port 8080
```

## License

[Add your license here]

## Contact

- **Email**: timm.walker@recurrentanalytics.com
- **GitHub**: [recurrentanalytics](https://github.com/recurrentanalytics)
- **Website**: https://recurrentanalytics.com

