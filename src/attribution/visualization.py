# src/attribution/visualization.py

"""
Visualization functions for rainfall/flood attribution analysis.
"""

from __future__ import annotations

from typing import Optional, Tuple, Union

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import xarray as xr

from .event_definitions import RainfallEventDefinition


def plot_precipitation_timeseries(
    data: pd.DataFrame,
    event_definition: RainfallEventDefinition,
    baseline_period: Optional[Tuple[str, str]] = None,
    recent_period: Optional[Tuple[str, str]] = None,
    ax: Optional[plt.Axes] = None,
) -> plt.Axes:
    """
    Plot precipitation time series with event highlighted.

    Parameters
    ----------
    data : pd.DataFrame
        Daily precipitation data with 'date' and 'precipitation_mm'
    event_definition : RainfallEventDefinition
        Event definition to highlight
    baseline_period : tuple, optional
        (start, end) dates for baseline period (for shading)
    recent_period : tuple, optional
        (start, end) dates for recent period (for shading)
    ax : plt.Axes, optional
        Matplotlib axes to plot on

    Returns
    -------
    plt.Axes
    """
    if ax is None:
        fig, ax = plt.subplots(figsize=(12, 5))

    # Plot time series
    ax.plot(data["date"], data["precipitation_mm"], alpha=0.6, linewidth=0.8, label="Daily precipitation")

    # Shade baseline and recent periods
    if baseline_period:
        start, end = baseline_period
        ax.axvspan(
            pd.Timestamp(start),
            pd.Timestamp(end),
            alpha=0.1,
            color="blue",
            label="Baseline period",
        )

    if recent_period:
        start, end = recent_period
        ax.axvspan(
            pd.Timestamp(start),
            pd.Timestamp(end),
            alpha=0.1,
            color="red",
            label="Recent period",
        )

    # Highlight event period
    event_start, event_end = event_definition.date_range
    ax.axvspan(
        pd.Timestamp(event_start),
        pd.Timestamp(event_end),
        alpha=0.2,
        color="orange",
        label="Event period",
    )

    # Mark event threshold
    ax.axhline(
        event_definition.threshold,
        color="red",
        linestyle="--",
        alpha=0.7,
        label=f"Event threshold ({event_definition.threshold} mm)",
    )

    ax.set_xlabel("Date")
    ax.set_ylabel("Precipitation (mm)")
    ax.set_title("Precipitation Time Series with Event Highlighted")
    ax.legend(loc="upper left", fontsize=9)
    ax.grid(alpha=0.3)

    return ax


def plot_distribution_comparison(
    historical_data: pd.Series | np.ndarray,
    recent_data: pd.Series | np.ndarray,
    event_threshold: float,
    ax: Optional[plt.Axes] = None,
) -> plt.Axes:
    """
    Plot overlapping distributions for historical and recent periods.

    Parameters
    ----------
    historical_data : pd.Series or np.ndarray
        Baseline period data
    recent_data : pd.Series or np.ndarray
        Recent period data
    event_threshold : float
        Event threshold to mark
    ax : plt.Axes, optional
        Matplotlib axes to plot on

    Returns
    -------
    plt.Axes
    """
    if ax is None:
        fig, ax = plt.subplots(figsize=(10, 6))

    # Create histogram
    bins = np.linspace(0, max(historical_data.max(), recent_data.max()), 50)
    ax.hist(
        historical_data,
        bins=bins,
        alpha=0.6,
        density=True,
        label="Historical period",
        color="blue",
    )
    ax.hist(
        recent_data,
        bins=bins,
        alpha=0.6,
        density=True,
        label="Recent period",
        color="red",
    )

    # Mark event threshold
    ax.axvline(
        event_threshold,
        color="orange",
        linestyle="--",
        linewidth=2,
        label=f"Event threshold ({event_threshold} mm)",
    )

    ax.set_xlabel("Precipitation (mm)")
    ax.set_ylabel("Density")
    ax.set_title("Distribution Comparison: Historical vs Recent Period")
    ax.legend()
    ax.grid(alpha=0.3)

    return ax


def plot_attribution_results(
    far: float,
    pr: float,
    confidence_intervals: Optional[dict] = None,
    ax: Optional[plt.Axes] = None,
) -> plt.Axes:
    """
    Create summary visualization of attribution results.

    Parameters
    ----------
    far : float
        Fraction of Attributable Risk
    pr : float
        Probability Ratio
    confidence_intervals : dict, optional
        Dictionary with keys: 'far_ci_lower', 'far_ci_upper', 'pr_ci_lower', 'pr_ci_upper'
    ax : plt.Axes, optional
        Matplotlib axes to plot on

    Returns
    -------
    plt.Axes
    """
    if ax is None:
        fig, ax = plt.subplots(figsize=(10, 6))

    metrics = ["FAR", "PR"]
    values = [far, pr]

    # Calculate error bars if confidence intervals provided
    if confidence_intervals:
        far_err_lower = far - confidence_intervals.get("far_ci_lower", far)
        far_err_upper = confidence_intervals.get("far_ci_upper", far) - far
        pr_err_lower = pr - confidence_intervals.get("pr_ci_lower", pr)
        pr_err_upper = confidence_intervals.get("pr_ci_upper", pr) - pr
        errors = [[far_err_lower, pr_err_lower], [far_err_upper, pr_err_upper]]
    else:
        errors = None

    bars = ax.bar(metrics, values, alpha=0.7, color=["blue", "green"], capsize=5, yerr=errors)

    # Add value labels on bars
    for i, (bar, val) in enumerate(zip(bars, values)):
        height = bar.get_height()
        ax.text(
            bar.get_x() + bar.get_width() / 2.0,
            height,
            f"{val:.2f}",
            ha="center",
            va="bottom",
            fontweight="bold",
        )

    # Add reference lines
    ax.axhline(0, color="black", linewidth=0.8)
    ax.axhline(1, color="gray", linestyle="--", alpha=0.5, label="No change (PR=1)")

    ax.set_ylabel("Attribution Metric Value")
    ax.set_title("Attribution Results: FAR and PR")
    ax.legend()
    ax.grid(alpha=0.3, axis="y")

    return ax


def plot_cumulative_rainfall(
    data: pd.DataFrame,
    event_definition: RainfallEventDefinition,
    ax: Optional[plt.Axes] = None,
) -> plt.Axes:
    """
    Plot cumulative rainfall over the event period.

    Parameters
    ----------
    data : pd.DataFrame
        Daily precipitation data
    event_definition : RainfallEventDefinition
        Event definition
    ax : plt.Axes, optional
        Matplotlib axes to plot on

    Returns
    -------
    plt.Axes
    """
    if ax is None:
        fig, ax = plt.subplots(figsize=(10, 5))

    # Filter to event period
    event_start, event_end = event_definition.date_range
    event_data = data[
        (data["date"] >= pd.Timestamp(event_start)) & (data["date"] <= pd.Timestamp(event_end))
    ].copy()

    # Calculate cumulative sum
    event_data = event_data.sort_values("date")
    event_data["cumulative_mm"] = event_data["precipitation_mm"].cumsum()

    # Plot daily rainfall
    ax.bar(event_data["date"], event_data["precipitation_mm"], alpha=0.6, label="Daily rainfall", color="lightblue")

    # Plot cumulative line
    ax2 = ax.twinx()
    ax2.plot(
        event_data["date"],
        event_data["cumulative_mm"],
        color="darkblue",
        linewidth=2,
        marker="o",
        label="Cumulative rainfall",
    )

    # Mark threshold
    ax2.axhline(
        event_definition.threshold,
        color="red",
        linestyle="--",
        linewidth=2,
        label=f"Threshold ({event_definition.threshold} mm)",
    )

    ax.set_xlabel("Date")
    ax.set_ylabel("Daily Precipitation (mm)", color="lightblue")
    ax2.set_ylabel("Cumulative Precipitation (mm)", color="darkblue")
    ax.set_title(f"Cumulative Rainfall: {event_start} to {event_end}")
    ax.tick_params(axis="y", labelcolor="lightblue")
    ax2.tick_params(axis="y", labelcolor="darkblue")
    ax.grid(alpha=0.3)

    # Combine legends
    lines1, labels1 = ax.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax.legend(lines1 + lines2, labels1 + labels2, loc="upper left")

    return ax


def plot_spatial_attribution(
    data: Union[xr.Dataset, xr.DataArray],
    region: dict[str, Tuple[float, float]],
    far_values: Optional[Union[xr.DataArray, np.ndarray]] = None,
    pr_values: Optional[Union[xr.DataArray, np.ndarray]] = None,
    metric: str = "FAR",
    ax: Optional[plt.Axes] = None,
    projection: str = "PlateCarree",
    title: Optional[str] = None,
) -> Tuple[plt.Figure, plt.Axes]:
    """
    Map attribution results (FAR/PR) across spatial regions.

    Parameters
    ----------
    data : xr.Dataset or xr.DataArray
        Spatial data with latitude and longitude dimensions
    region : dict
        Dictionary with 'lat' and 'lon' keys
    far_values : xr.DataArray or np.ndarray, optional
        FAR values for each spatial location. If None, tries to extract from data
    pr_values : xr.DataArray or np.ndarray, optional
        PR values for each spatial location. If None, tries to extract from data
    metric : str, optional
        Which metric to plot: 'FAR' or 'PR'. Default 'FAR'
    ax : plt.Axes, optional
        Existing axes to use
    projection : str, optional
        Map projection. Default 'PlateCarree'
    title : str, optional
        Plot title

    Returns
    -------
    fig : plt.Figure
        Matplotlib figure
    ax : plt.Axes
        Cartopy axes with attribution results mapped
    """
    from ..mapping import plot_risk_zones

    # Determine which values to plot
    if metric == "FAR":
        if far_values is None:
            if isinstance(data, xr.Dataset) and "far" in data.data_vars:
                values = data["far"]
            else:
                raise ValueError("FAR values not found in data and far_values not provided")
        else:
            values = far_values
        colormap = "Reds"
        label = "Fraction of Attributable Risk (FAR)"
    elif metric == "PR":
        if pr_values is None:
            if isinstance(data, xr.Dataset) and "pr" in data.data_vars:
                values = data["pr"]
            else:
                raise ValueError("PR values not found in data and pr_values not provided")
        else:
            values = pr_values
        colormap = "YlOrRd"
        label = "Probability Ratio (PR)"
    else:
        raise ValueError(f"Unknown metric: {metric}. Use 'FAR' or 'PR'")

    # Use mapping module to create the plot
    fig, ax = plot_risk_zones(
        data=values if isinstance(values, (xr.Dataset, xr.DataArray)) else data,
        region=region,
        colormap=colormap,
        ax=ax,
        projection=projection,
        title=title or f"Spatial Attribution: {metric}",
        colorbar_label=label,
    )

    return fig, ax


def plot_event_spatial_distribution(
    event_data: Union[xr.Dataset, xr.DataArray],
    region: dict[str, Tuple[float, float]],
    event_definition: Optional[RainfallEventDefinition] = None,
    variable: str = "total_precipitation",
    ax: Optional[plt.Axes] = None,
    projection: str = "PlateCarree",
    title: Optional[str] = None,
    colormap: str = "Blues",
) -> Tuple[plt.Figure, plt.Axes]:
    """
    Show spatial distribution of an event (e.g., precipitation during flood event).

    Parameters
    ----------
    event_data : xr.Dataset or xr.DataArray
        Spatial data for the event period with latitude and longitude dimensions
    region : dict
        Dictionary with 'lat' and 'lon' keys
    event_definition : RainfallEventDefinition, optional
        Event definition to highlight on map
    variable : str, optional
        Variable name to plot (for xr.Dataset). Default 'total_precipitation'
    ax : plt.Axes, optional
        Existing axes to use
    projection : str, optional
        Map projection. Default 'PlateCarree'
    title : str, optional
        Plot title
    colormap : str, optional
        Colormap for precipitation. Default 'Blues'

    Returns
    -------
    fig : plt.Figure
        Matplotlib figure
    ax : plt.Axes
        Cartopy axes with event spatial distribution
    """
    from ..mapping import create_base_map, plot_risk_zones, plot_region_outline, add_event_markers

    # Create map with event data
    fig, ax = plot_risk_zones(
        data=event_data,
        region=region,
        variable=variable,
        colormap=colormap,
        ax=ax,
        projection=projection,
        title=title or "Event Spatial Distribution",
        colorbar_label="Precipitation (mm)",
    )

    # Highlight event region if provided
    if event_definition:
        plot_region_outline(event_definition.region, ax, color="red", linewidth=2, label="Event region")

        # Add event marker at center of region
        center_lat = (event_definition.region["lat"][0] + event_definition.region["lat"][1]) / 2
        center_lon = (event_definition.region["lon"][0] + event_definition.region["lon"][1]) / 2
        add_event_markers(
            [{"lat": center_lat, "lon": center_lon, "label": "Event"}],
            ax,
            color="red",
            size=150,
        )

    return fig, ax

