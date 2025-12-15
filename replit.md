# re:current_analytics

## Overview
A Quarto-based static website for climate risk, models, and analytics. The site serves as a lab notebook with notes, projects, models, and reading materials.

## Project Structure
- `_site/` - Built static HTML output (served in production)
- `*.qmd` - Quarto markdown source files
- `notes/`, `models/`, `projects/`, `reading/` - Content sections
- `src/` - Python modules for data processing
  - `data_download.py` - OPSD data loading utilities
  - `heatwave_defs.py` - Heatwave flagging functions
- `data/raw/` - Raw data files (OPSD CSVs go here)
- `data/processed/` - Processed parquet files
- `_quarto.yml` - Quarto configuration
- `styles.scss` - Custom styling with Quarto SCSS layer syntax
- `assets/` - Favicon and other static assets
- `404.qmd` - Custom 404 error page
- `environment.yml` - Conda environment for local development
- `server.py` - Simple Python HTTP server for serving static files

## Running the Site
The workflow "Serve Website" runs `python server.py` which serves the `_site` directory on port 5000.

## Building the Site
To rebuild after making changes to .qmd files:
```bash
quarto render
```

## Features
- **Yin-Yang Manifesto**: Collapsible box on homepage with ☯ toggle
  - Dark box in light mode, light box in dark mode (yin-yang aesthetic)
  - Theme-aware: Light mode defaults to Manifesto, dark mode to Anti-Manifesto
- **Dark/Light Theme**: Toggle via theme switcher in navbar
- **RSS Feed**: Available at notes/index.xml
- **Reading Progress Bar**: Thin line at top showing scroll position
- **Reading Time**: "X min read" displayed on article pages
- **Last Modified Dates**: Notes show when they were last updated
- **Custom 404 Page**: Minimal "Lost in the noise" error page
- **Keyboard Shortcuts**: / (search), j/k (navigate), ? (show hints), Cmd+K (palette)
- **Command Palette**: Press Cmd+K (or Ctrl+K) for quick-jump to any page
- **Print Stylesheet**: Clean formatting when printing (hides nav, shows URLs)
- **Series Navigation**: Multi-part notes show "Part X of Y" with prev/next links
- **Backlinks**: Notes can show which other notes link to them

## Sample Content
- `notes/risk-series-1.qmd` through `risk-series-3.qmd` - 3-part series demonstrating series navigation and backlinks

## Heatwave Analysis Page
- `models/heatwave-prices-de-lu.qmd` - DE-LU electricity prices during heatwaves
- Requires OPSD CSV files in `data/raw/`:
  - `time_series_60min_singleindex.csv` from [OPSD Time Series](https://data.open-power-system-data.org/time_series/)
  - `weather_data.csv` from [OPSD Weather](https://data.open-power-system-data.org/weather_data/)
- Run the pipeline locally to generate `data/processed/*.parquet` files

## Deployment
Configured for static deployment serving the `_site` directory.
