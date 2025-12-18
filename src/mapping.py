# src/mapping.py

"""
Geographic mapping utilities for visualizing risk zones and hazards.

This module provides functions for creating static maps with cartopy,
plotting risk zones, and visualizing climate data spatially.
"""

from __future__ import annotations

from typing import Optional, Tuple, Union

import cartopy.crs as ccrs
import cartopy.feature as cfeature
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import xarray as xr


def create_base_map(
    region: dict[str, Tuple[float, float]],
    projection: Union[str, ccrs.Projection] = "PlateCarree",
    figsize: Tuple[float, float] = (12, 8),
    resolution: str = "50m",
    ax: Optional[plt.Axes] = None,
) -> Tuple[plt.Figure, plt.Axes]:
    """
    Create a base map with coastlines, borders, and grid lines.

    Parameters
    ----------
    region : dict
        Dictionary with 'lat' and 'lon' keys, each containing (min, max) tuples.
        Example: {'lat': (45.0, 55.0), 'lon': (5.0, 15.0)}
    projection : str or ccrs.Projection, optional
        Map projection. Default 'PlateCarree'. Options: 'PlateCarree', 'Mercator', 'LambertConformal'
    figsize : tuple, optional
        Figure size (width, height) in inches. Default (12, 8)
    resolution : str, optional
        Coastline resolution: '10m', '50m', '110m'. Default '50m'
    ax : plt.Axes, optional
        Existing axes to use. If None, creates new figure and axes.

    Returns
    -------
    fig : plt.Figure
        Matplotlib figure
    ax : plt.Axes
        Cartopy axes with map features
    """
    lat_range = region["lat"]
    lon_range = region["lon"]

    # Set up projection
    if isinstance(projection, str):
        if projection == "PlateCarree":
            proj = ccrs.PlateCarree()
        elif projection == "Mercator":
            proj = ccrs.Mercator()
        elif projection == "LambertConformal":
            # Center on region
            center_lon = (lon_range[0] + lon_range[1]) / 2
            center_lat = (lat_range[0] + lat_range[1]) / 2
            proj = ccrs.LambertConformal(central_longitude=center_lon, central_latitude=center_lat)
        else:
            proj = ccrs.PlateCarree()
    else:
        proj = projection

    # Create figure and axes if not provided
    if ax is None:
        fig = plt.figure(figsize=figsize)
        ax = plt.axes(projection=proj)
    else:
        fig = ax.figure

    # Set map extent
    ax.set_extent([lon_range[0], lon_range[1], lat_range[0], lat_range[1]], crs=ccrs.PlateCarree())

    # Add map features
    ax.add_feature(cfeature.COASTLINE.with_scale(resolution), linewidth=0.5)
    ax.add_feature(cfeature.BORDERS.with_scale(resolution), linewidth=0.5, linestyle="--", alpha=0.5)
    ax.add_feature(cfeature.LAND, alpha=0.3, facecolor="lightgray")
    ax.add_feature(cfeature.OCEAN, alpha=0.3, facecolor="lightblue")

    # Add grid lines
    gl = ax.gridlines(
        crs=ccrs.PlateCarree(),
        draw_labels=True,
        linewidth=0.5,
        color="gray",
        alpha=0.5,
        linestyle="--",
    )
    gl.top_labels = False
    gl.right_labels = False

    return fig, ax


def plot_risk_zones(
    data: Union[xr.Dataset, xr.DataArray, pd.DataFrame],
    region: dict[str, Tuple[float, float]],
    variable: Optional[str] = None,
    colormap: str = "YlOrRd",
    levels: Optional[list] = None,
    ax: Optional[plt.Axes] = None,
    projection: str = "PlateCarree",
    title: Optional[str] = None,
    colorbar_label: Optional[str] = None,
) -> Tuple[plt.Figure, plt.Axes]:
    """
    Plot risk zones from spatial data.

    Parameters
    ----------
    data : xr.Dataset, xr.DataArray, or pd.DataFrame
        Spatial data with latitude and longitude dimensions/columns
    region : dict
        Dictionary with 'lat' and 'lon' keys
    variable : str, optional
        Variable name to plot (for xr.Dataset). If None, uses first data variable
    colormap : str, optional
        Matplotlib colormap name. Default 'YlOrRd'
    levels : list, optional
        Contour levels. If None, uses 10 evenly spaced levels
    ax : plt.Axes, optional
        Existing axes to use
    projection : str, optional
        Map projection. Default 'PlateCarree'
    title : str, optional
        Plot title
    colorbar_label : str, optional
        Colorbar label

    Returns
    -------
    fig : plt.Figure
        Matplotlib figure
    ax : plt.Axes
        Cartopy axes with risk zones plotted
    """
    # Create base map
    fig, ax = create_base_map(region, projection=projection, ax=ax)

    # Handle different data types
    if isinstance(data, pd.DataFrame):
        # DataFrame: assume columns include 'lat', 'lon', and data column
        if variable is None:
            # Find first numeric column that's not lat/lon
            numeric_cols = data.select_dtypes(include=[np.number]).columns
            variable = [col for col in numeric_cols if col not in ["lat", "lon", "latitude", "longitude"]][0]

        # Create pivot table for contour plot
        if "lat" in data.columns and "lon" in data.columns:
            pivot = data.pivot(index="lat", columns="lon", values=variable)
            lons = pivot.columns.values
            lats = pivot.index.values
            values = pivot.values
        else:
            raise ValueError("DataFrame must have 'lat' and 'lon' columns")

    elif isinstance(data, (xr.Dataset, xr.DataArray)):
        # xarray: extract data
        if isinstance(data, xr.Dataset):
            if variable is None:
                variable = list(data.data_vars)[0]
            data_array = data[variable]
        else:
            data_array = data

        # Get coordinates
        if "latitude" in data_array.coords:
            lats = data_array.latitude.values
            lons = data_array.longitude.values
        elif "lat" in data_array.coords:
            lats = data_array.lat.values
            lons = data_array.lon.values
        else:
            raise ValueError("xarray data must have 'latitude'/'longitude' or 'lat'/'lon' coordinates")

        values = data_array.values
        if values.ndim > 2:
            # If time dimension, take mean or last timestep
            values = values[-1] if values.ndim == 3 else values.mean(axis=0)

        # Create meshgrid
        lon_grid, lat_grid = np.meshgrid(lons, lats)
    else:
        raise TypeError(f"Unsupported data type: {type(data)}")

    # Set contour levels
    if levels is None:
        vmin = np.nanmin(values)
        vmax = np.nanmax(values)
        levels = np.linspace(vmin, vmax, 10)

    # Plot filled contours
    contour = ax.contourf(
        lon_grid,
        lat_grid,
        values,
        levels=levels,
        transform=ccrs.PlateCarree(),
        cmap=colormap,
        alpha=0.7,
    )

    # Add colorbar
    cbar = plt.colorbar(contour, ax=ax, orientation="horizontal", pad=0.05, aspect=40)
    if colorbar_label:
        cbar.set_label(colorbar_label, fontsize=10)

    if title:
        ax.set_title(title, fontsize=12, fontweight="bold")

    return fig, ax


def plot_hazard_intensity(
    data: Union[xr.Dataset, xr.DataArray, pd.DataFrame],
    region: dict[str, Tuple[float, float]],
    variable: Optional[str] = None,
    colormap: str = "YlOrRd",
    ax: Optional[plt.Axes] = None,
    projection: str = "PlateCarree",
    title: Optional[str] = None,
    colorbar_label: Optional[str] = None,
) -> Tuple[plt.Figure, plt.Axes]:
    """
    Plot hazard intensity with color-coded values.

    Alias for plot_risk_zones with default settings optimized for hazard visualization.
    """
    return plot_risk_zones(
        data=data,
        region=region,
        variable=variable,
        colormap=colormap,
        ax=ax,
        projection=projection,
        title=title,
        colorbar_label=colorbar_label,
    )


def add_event_markers(
    events: list[dict],
    ax: plt.Axes,
    marker: str = "o",
    color: str = "red",
    size: int = 100,
    edgecolor: str = "black",
    linewidth: float = 1.5,
    label: Optional[str] = None,
) -> plt.Axes:
    """
    Add event markers to a map.

    Parameters
    ----------
    events : list of dict
        List of event dictionaries. Each dict should have 'lat' and 'lon' keys.
        Optional keys: 'label', 'date', 'magnitude'
    ax : plt.Axes
        Cartopy axes to add markers to
    marker : str, optional
        Marker style. Default 'o' (circle)
    color : str, optional
        Marker color. Default 'red'
    size : int, optional
        Marker size. Default 100
    edgecolor : str, optional
        Marker edge color. Default 'black'
    linewidth : float, optional
        Marker edge linewidth. Default 1.5
    label : str, optional
        Label for legend

    Returns
    -------
    ax : plt.Axes
        Axes with markers added
    """
    for event in events:
        lat = event["lat"]
        lon = event["lon"]

        ax.plot(
            lon,
            lat,
            marker=marker,
            color=color,
            markersize=size,
            markeredgecolor=edgecolor,
            markeredgewidth=linewidth,
            transform=ccrs.PlateCarree(),
            label=label if label and events.index(event) == 0 else None,
        )

        # Add label if provided
        if "label" in event:
            ax.text(
                lon + 0.5,
                lat + 0.5,
                event["label"],
                transform=ccrs.PlateCarree(),
                fontsize=9,
                bbox=dict(boxstyle="round,pad=0.3", facecolor="white", alpha=0.7),
            )

    return ax


def plot_region_outline(
    region: dict[str, Tuple[float, float]],
    ax: plt.Axes,
    color: str = "red",
    linewidth: float = 2,
    linestyle: str = "--",
    alpha: float = 0.8,
    label: Optional[str] = None,
) -> plt.Axes:
    """
    Highlight a region with an outline rectangle.

    Parameters
    ----------
    region : dict
        Dictionary with 'lat' and 'lon' keys
    ax : plt.Axes
        Cartopy axes to add outline to
    color : str, optional
        Outline color. Default 'red'
    linewidth : float, optional
        Line width. Default 2
    linestyle : str, optional
        Line style. Default '--' (dashed)
    alpha : float, optional
        Transparency. Default 0.8
    label : str, optional
        Label for legend

    Returns
    -------
    ax : plt.Axes
        Axes with region outline added
    """
    lat_range = region["lat"]
    lon_range = region["lon"]

    # Create rectangle outline
    from matplotlib.patches import Rectangle

    rect = Rectangle(
        (lon_range[0], lat_range[0]),
        lon_range[1] - lon_range[0],
        lat_range[1] - lat_range[0],
        linewidth=linewidth,
        edgecolor=color,
        facecolor="none",
        linestyle=linestyle,
        alpha=alpha,
        transform=ccrs.PlateCarree(),
        label=label,
    )
    ax.add_patch(rect)

    return ax

