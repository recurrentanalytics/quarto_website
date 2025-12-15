# src/climate_extremes.py

"""
Climate Extremes Analysis Module

Provides functions for identifying, analyzing, and visualizing climate extremes
including heatwaves, cold snaps, droughts, and extreme precipitation events.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats
from scipy.cluster.hierarchy import linkage, fcluster
from sklearn.preprocessing import StandardScaler
from typing import Optional, Tuple, Dict, List


def generate_synthetic_climate_data(
    start_date: str = "2000-01-01",
    end_date: str = "2023-12-31",
    freq: str = "D",
    seed: int = 42,
) -> pd.DataFrame:
    """
    Generate realistic synthetic climate data for demonstration.
    
    Creates daily time series with:
    - Temperature (with seasonal patterns and trends)
    - Precipitation (with seasonal patterns)
    - Pressure (with correlations to temperature)
    - Realistic extreme events
    
    Parameters:
    -----------
    start_date : str
        Start date for the time series
    end_date : str
        End date for the time series
    freq : str
        Frequency ('D' for daily, 'H' for hourly)
    seed : int
        Random seed for reproducibility
    
    Returns:
    --------
    pd.DataFrame
        DataFrame with columns: datetime_utc, temperature_c, precipitation_mm, pressure_hpa
    """
    np.random.seed(seed)
    
    date_range = pd.date_range(start=start_date, end=end_date, freq=freq, tz="UTC")
    n = len(date_range)
    
    # Base temperature with seasonal cycle and warming trend
    days_since_start = np.arange(n)
    seasonal = 15 + 10 * np.sin(2 * np.pi * days_since_start / 365.25)
    trend = 0.02 * days_since_start / 365.25  # ~0.02°C per year warming
    noise = np.random.normal(0, 3, n)
    temperature = seasonal + trend + noise
    
    # Inject some extreme heat events
    extreme_indices = np.random.choice(n, size=int(n * 0.02), replace=False)
    for idx in extreme_indices:
        temperature[idx:idx+np.random.randint(3, 8)] += np.random.uniform(8, 15)
    
    # Inject some extreme cold events
    cold_indices = np.random.choice(n, size=int(n * 0.015), replace=False)
    for idx in cold_indices:
        temperature[idx:idx+np.random.randint(2, 6)] -= np.random.uniform(8, 15)
    
    # Precipitation (gamma distribution, seasonal)
    precip_base = np.random.gamma(2, 2, n)
    seasonal_precip = 1 + 0.5 * np.sin(2 * np.pi * days_since_start / 365.25 + np.pi)
    precipitation = precip_base * seasonal_precip
    
    # Inject extreme precipitation events
    extreme_precip_indices = np.random.choice(n, size=int(n * 0.01), replace=False)
    for idx in extreme_precip_indices:
        precipitation[idx] *= np.random.uniform(5, 15)
    
    # Pressure (correlated with temperature, inverse relationship)
    pressure_base = 1013.25
    pressure = pressure_base - 0.5 * (temperature - temperature.mean()) + np.random.normal(0, 5, n)
    
    df = pd.DataFrame({
        'datetime_utc': date_range,
        'temperature_c': temperature,
        'precipitation_mm': np.maximum(0, precipitation),
        'pressure_hpa': pressure,
    })
    
    return df


def identify_extremes(
    df: pd.DataFrame,
    variable: str = 'temperature_c',
    method: str = 'percentile',
    threshold: float = 95.0,
    min_duration: int = 1,
) -> pd.DataFrame:
    """
    Identify extreme events in a climate time series.
    
    Parameters:
    -----------
    df : pd.DataFrame
        DataFrame with datetime_utc and climate variables
    variable : str
        Variable to analyze (e.g., 'temperature_c', 'precipitation_mm')
    method : str
        Method: 'percentile', 'absolute', or 'anomaly'
    threshold : float
        Threshold percentile (for 'percentile') or absolute value (for 'absolute')
        or standard deviations (for 'anomaly')
    min_duration : int
        Minimum consecutive days to be considered an extreme event
    
    Returns:
    --------
    pd.DataFrame
        Original DataFrame with added columns:
        - is_extreme: boolean flag
        - extreme_intensity: magnitude of extreme
        - extreme_event_id: unique ID for each extreme event
    """
    df = df.copy()
    
    if method == 'percentile':
        threshold_value = np.percentile(df[variable], threshold)
        is_extreme = df[variable] >= threshold_value
    elif method == 'absolute':
        threshold_value = threshold
        is_extreme = df[variable] >= threshold_value
    elif method == 'anomaly':
        mean_val = df[variable].mean()
        std_val = df[variable].std()
        threshold_value = mean_val + threshold * std_val
        is_extreme = df[variable] >= threshold_value
    else:
        raise ValueError(f"Unknown method: {method}")
    
    df['is_extreme'] = is_extreme
    
    # Compute intensity (how far above threshold)
    df['extreme_intensity'] = np.where(
        is_extreme,
        df[variable] - threshold_value,
        0
    )
    
    # Identify consecutive extreme events
    df['extreme_event_id'] = 0
    event_id = 1
    in_event = False
    
    for i in range(len(df)):
        if df.iloc[i]['is_extreme']:
            if not in_event:
                in_event = True
                event_id += 1
            df.iloc[i, df.columns.get_loc('extreme_event_id')] = event_id
        else:
            in_event = False
    
    # Filter events by minimum duration
    event_durations = df.groupby('extreme_event_id')['is_extreme'].sum()
    valid_events = event_durations[event_durations >= min_duration].index
    
    df['is_extreme'] = df['extreme_event_id'].isin(valid_events) & df['is_extreme']
    df.loc[~df['is_extreme'], 'extreme_event_id'] = 0
    df.loc[~df['is_extreme'], 'extreme_intensity'] = 0
    
    return df


def compute_return_periods(
    df: pd.DataFrame,
    variable: str = 'temperature_c',
    method: str = 'block_maxima',
    block_size: str = '1Y',
) -> pd.DataFrame:
    """
    Compute return periods for extreme values using extreme value theory.
    
    Parameters:
    -----------
    df : pd.DataFrame
        DataFrame with datetime_utc and climate variables
    variable : str
        Variable to analyze
    method : str
        'block_maxima' (annual maxima) or 'peaks_over_threshold' (POT)
    block_size : str
        Block size for block maxima (e.g., '1Y' for annual)
    
    Returns:
    --------
    pd.DataFrame
        DataFrame with return periods and corresponding values
    """
    df = df.copy()
    df['datetime_utc'] = pd.to_datetime(df['datetime_utc'])
    df = df.set_index('datetime_utc')
    
    if method == 'block_maxima':
        # Annual maxima
        annual_max = df[variable].resample(block_size).max()
        
        # Fit Gumbel distribution (Type I extreme value)
        params = stats.gumbel_l.fit(annual_max)
        
        # Compute return periods (years)
        return_periods = np.array([2, 5, 10, 20, 50, 100, 200, 500])
        return_values = stats.gumbel_l.ppf(1 - 1/return_periods, *params)
        
        result = pd.DataFrame({
            'return_period_years': return_periods,
            'return_value': return_values,
            'variable': variable,
        })
        
    elif method == 'peaks_over_threshold':
        # Peaks Over Threshold (POT) method
        threshold = np.percentile(df[variable], 95)
        exceedances = df[df[variable] > threshold][variable] - threshold
        
        # Fit Generalized Pareto Distribution
        if len(exceedances) > 0:
            params = stats.genpareto.fit(exceedances)
            
            return_periods = np.array([2, 5, 10, 20, 50, 100, 200, 500])
            # POT return value formula
            return_values = threshold + stats.genpareto.ppf(
                1 - 1/(return_periods * len(exceedances) / len(df)),
                *params
            )
            
            result = pd.DataFrame({
                'return_period_years': return_periods,
                'return_value': return_values,
                'variable': variable,
            })
        else:
            result = pd.DataFrame({
                'return_period_years': return_periods,
                'return_value': np.nan,
                'variable': variable,
            })
    else:
        raise ValueError(f"Unknown method: {method}")
    
    return result


def analyze_correlations(
    df: pd.DataFrame,
    variables: Optional[List[str]] = None,
) -> pd.DataFrame:
    """
    Compute correlation matrix for climate variables.
    
    Parameters:
    -----------
    df : pd.DataFrame
        DataFrame with climate variables
    variables : list of str, optional
        Variables to include (default: all numeric columns except datetime)
    
    Returns:
    --------
    pd.DataFrame
        Correlation matrix
    """
    if variables is None:
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if 'datetime_utc' in df.columns:
            numeric_cols = [c for c in numeric_cols if c != 'datetime_utc']
        variables = numeric_cols
    
    corr_matrix = df[variables].corr()
    return corr_matrix


def cluster_extreme_events(
    df: pd.DataFrame,
    n_clusters: int = 5,
    variables: Optional[List[str]] = None,
) -> pd.DataFrame:
    """
    Cluster extreme events based on their characteristics.
    
    Parameters:
    -----------
    df : pd.DataFrame
        DataFrame with identified extreme events
    n_clusters : int
        Number of clusters
    variables : list of str, optional
        Variables to use for clustering
    
    Returns:
    --------
    pd.DataFrame
        Original DataFrame with added 'extreme_cluster' column
    """
    df = df.copy()
    
    if variables is None:
        variables = ['temperature_c', 'precipitation_mm', 'pressure_hpa']
        variables = [v for v in variables if v in df.columns]
    
    # Extract extreme events only
    extreme_df = df[df['is_extreme']].copy()
    
    if len(extreme_df) < n_clusters:
        df['extreme_cluster'] = 0
        return df
    
    # Prepare features for clustering
    features = extreme_df[variables].values
    scaler = StandardScaler()
    features_scaled = scaler.fit_transform(features)
    
    # Hierarchical clustering
    linkage_matrix = linkage(features_scaled, method='ward')
    clusters = fcluster(linkage_matrix, n_clusters, criterion='maxclust')
    
    # Map clusters back to full dataframe
    df['extreme_cluster'] = 0
    df.loc[extreme_df.index, 'extreme_cluster'] = clusters
    
    return df


def compute_extreme_statistics(
    df: pd.DataFrame,
    variable: str = 'temperature_c',
) -> Dict[str, float]:
    """
    Compute summary statistics for extreme events.
    
    Parameters:
    -----------
    df : pd.DataFrame
        DataFrame with identified extreme events
    variable : str
        Variable to analyze
    
    Returns:
    --------
    dict
        Dictionary with statistics
    """
    extreme_df = df[df['is_extreme']].copy()
    
    if len(extreme_df) == 0:
        return {
            'n_events': 0,
            'total_days': 0,
            'mean_intensity': 0,
            'max_intensity': 0,
            'mean_duration': 0,
        }
    
    event_stats = extreme_df.groupby('extreme_event_id').agg({
        variable: ['count', 'mean', 'max'],
        'extreme_intensity': 'mean',
    })
    
    return {
        'n_events': extreme_df['extreme_event_id'].nunique(),
        'total_days': len(extreme_df),
        'mean_intensity': extreme_df['extreme_intensity'].mean(),
        'max_intensity': extreme_df['extreme_intensity'].max(),
        'mean_duration': event_stats[(variable, 'count')].mean(),
        'max_value': extreme_df[variable].max(),
        'mean_value': extreme_df[variable].mean(),
    }

