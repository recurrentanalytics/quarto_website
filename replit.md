# re:current analytics

## Overview
A Quarto-based static website for climate risk, models, and analytics. The site serves as a lab notebook with notes, projects, models, and reading materials.

## Project Structure
- `_site/` - Built static HTML output (served in production)
- `*.qmd` - Quarto markdown source files
- `notes/`, `models/`, `projects/`, `reading/` - Content sections
- `_quarto.yml` - Quarto configuration
- `styles.scss` - Custom styling with Quarto SCSS layer syntax
- `environment.yml` - Conda environment for local development (Python dependencies for notebooks)
- `server.py` - Simple Python HTTP server for serving static files

## Running the Site
The workflow "Serve Website" runs `python server.py` which serves the `_site` directory on port 5000.

## Building the Site
To rebuild after making changes to .qmd files:
```bash
quarto render
```

## Features
- **Manifesto Toggle**: Collapsible statement of intent on homepage (index.qmd)
- **Dark/Light Theme**: Toggle via theme switcher in navbar
- **RSS Feed**: Available at notes/index.xml

## Deployment
Configured for static deployment serving the `_site` directory.
