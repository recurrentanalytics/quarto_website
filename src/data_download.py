# src/data_download.py

import os
import pandas as pd
import numpy as np


def load_opsd_prices_de_lu(
    path: str = "data/raw/time_series_60min_singleindex.csv",
    start: str | None = None,
    end: str | None = None,
) -> pd.DataFrame:
    """
    Load DE-LU day-ahead prices from OPSD, return:
    datetime_utc (tz-aware)
    price_eur_mwh
    """
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"File not found at {path}. Download from:"
            " https://data.open-power-system-data.org/time_series/latest/"
        )

    usecols = ["utc_timestamp", "DE_LU_price_day_ahead"]
    df = pd.read_csv(path, usecols=usecols)

    # parse timestamps
    df["datetime_utc"] = pd.to_datetime(df["utc_timestamp"], utc=True)
    df = df.rename(columns={"DE_LU_price_day_ahead": "price_eur_mwh"})
    df = df[["datetime_utc", "price_eur_mwh"]].sort_values("datetime_utc")

    # optional time windowing
    if start:
        df = df[df["datetime_utc"] >= pd.Timestamp(start, tz="UTC")]
    if end:
        df = df[df["datetime_utc"] < pd.Timestamp(end,   tz="UTC")]

    df = df.reset_index(drop=True)
    return df


def save_prices_from_opsd(
    start: str = "2015-01-01",
    end:   str = "2020-07-01",
    raw_path:   str = "data/raw/prices_de_lu_from_opsd.parquet",
    clean_path: str = "data/processed/prices_de_lu_clean.parquet",
) -> None:

    os.makedirs(os.path.dirname(raw_path), exist_ok=True)
    os.makedirs(os.path.dirname(clean_path), exist_ok=True)

    df = load_opsd_prices_de_lu(start=start, end=end)

    # save raw
    df.to_parquet(raw_path, index=False)

    # enforce regular hourly UTC index for clean output
    df_clean = df.set_index("datetime_utc").sort_index()
    full_index = pd.date_range(
        start=df_clean.index.min(),
        end=df_clean.index.max(),
        freq="H",
        tz="UTC",
    )
    df_clean = df_clean.reindex(full_index)
    df_clean.index.name = "datetime_utc"
    df_clean.reset_index().to_parquet(clean_path, index=False)


def load_opsd_weather_de(
    path: str = "data/raw/weather_data.csv",
    start: str | None = None,
    end: str | None = None,
) -> pd.DataFrame:
    """
    Load DE temperature from OPSD weather_data.csv.

    Returns a DataFrame with:
        datetime_utc (tz-aware)
        t2m_mean_c   (°C, country-aggregated)
    """
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Weather file not found at {path}. Download from:\n"
            "https://data.open-power-system-data.org/weather_data/2020-09-16/"
        )

    usecols = ["utc_timestamp", "DE_temperature"]
    df = pd.read_csv(path, usecols=usecols)

    # Parse timestamp (already UTC in the file)
    df["datetime_utc"] = pd.to_datetime(df["utc_timestamp"], utc=True)

    df = df.rename(columns={"DE_temperature": "t2m_mean_c"})
    df = df[["datetime_utc", "t2m_mean_c"]].sort_values("datetime_utc")

    # Optional time window
    if start is not None:
        df = df[df["datetime_utc"] >= pd.Timestamp(start, tz="UTC")]
    if end is not None:
        df = df[df["datetime_utc"] < pd.Timestamp(end, tz="UTC")]

    df = df.reset_index(drop=True)
    return df


def save_weather_de_from_opsd(
    start: str = "2015-01-01",
    end:   str = "2020-01-01",  # weather_data goes up to 2019
    raw_path:   str = "data/raw/weather_de_from_opsd.parquet",
    clean_path: str = "data/processed/weather_de_agg.parquet",
) -> None:
    """
    Load DE weather from OPSD, clip period, and save raw + clean versions.
    """
    os.makedirs(os.path.dirname(raw_path), exist_ok=True)
    os.makedirs(os.path.dirname(clean_path), exist_ok=True)

    df = load_opsd_weather_de(start=start, end=end)

    # Raw dump
    df.to_parquet(raw_path, index=False)

    # Enforce regular hourly UTC index
    df_clean = df.set_index("datetime_utc").sort_index()
    full_index = pd.date_range(
        start=df_clean.index.min(),
        end=df_clean.index.max(),
        freq="H",
        tz="UTC",
    )
    df_clean = df_clean.reindex(full_index)
    df_clean.index.name = "datetime_utc"
    df_clean = df_clean.reset_index()

    df_clean.to_parquet(clean_path, index=False)


def generate_synthetic_prices(
    start: str = "2015-01-01",
    end: str = "2020-07-01",
    seed: int = 42,
) -> pd.DataFrame:
    """
    Generate synthetic DE-LU day-ahead electricity prices.
    
    Creates realistic hourly price patterns with:
    - Daily cycles (higher during day)
    - Weekly patterns (lower on weekends)
    - Seasonal variation
    - Some volatility
    
    Returns DataFrame with columns: datetime_utc, price_eur_mwh
    """
    np.random.seed(seed)
    
    # Create hourly UTC index
    date_range = pd.date_range(
        start=pd.Timestamp(start, tz="UTC"),
        end=pd.Timestamp(end, tz="UTC"),
        freq="H",
        tz="UTC",
    )
    
    n = len(date_range)
    
    # Base price level (EUR/MWh)
    base_price = 40.0
    
    # Daily cycle: higher during day (8-20h), lower at night
    hour_of_day = date_range.hour
    daily_cycle = np.where(
        (hour_of_day >= 8) & (hour_of_day <= 20),
        1.3,  # 30% higher during day
        0.85  # 15% lower at night
    )
    
    # Weekly pattern: lower on weekends
    day_of_week = date_range.dayofweek
    weekly_pattern = np.where(
        (day_of_week == 5) | (day_of_week == 6),  # Sat, Sun
        0.9,  # 10% lower
        1.0
    )
    
    # Seasonal pattern: higher in winter (heating demand)
    month = date_range.month
    seasonal = np.where(
        (month >= 11) | (month <= 2),  # Nov-Feb
        1.15,  # 15% higher in winter
        np.where(
            (month >= 6) & (month <= 8),  # Jun-Aug (summer)
            1.05,  # 5% higher in summer (cooling)
            1.0
        )
    )
    
    # Random volatility
    volatility = np.random.normal(0, 0.15, n)
    
    # Combine all effects
    prices = base_price * daily_cycle * weekly_pattern * seasonal * (1 + volatility)
    
    # Ensure prices are positive and reasonable (20-120 EUR/MWh)
    prices = np.clip(prices, 20, 120)
    
    # Add some spikes (extreme events)
    spike_prob = 0.01  # 1% chance per hour
    spikes = np.random.binomial(1, spike_prob, n)
    prices = np.where(spikes, prices * np.random.uniform(1.5, 3.0, n), prices)
    prices = np.clip(prices, 20, 200)
    
    df = pd.DataFrame({
        "datetime_utc": date_range,
        "price_eur_mwh": prices,
    })
    
    return df


def generate_synthetic_weather(
    start: str = "2015-01-01",
    end: str = "2020-01-01",
    seed: int = 42,
) -> pd.DataFrame:
    """
    Generate synthetic German temperature data.
    
    Creates realistic hourly temperature patterns with:
    - Seasonal cycles (warm summer, cold winter)
    - Daily cycles (warmer during day)
    - Some heatwaves in summer
    - Realistic variability
    
    Returns DataFrame with columns: datetime_utc, t2m_mean_c
    """
    np.random.seed(seed)
    
    # Create hourly UTC index
    date_range = pd.date_range(
        start=pd.Timestamp(start, tz="UTC"),
        end=pd.Timestamp(end, tz="UTC"),
        freq="H",
        tz="UTC",
    )
    
    n = len(date_range)
    
    # Day of year for seasonal cycle
    day_of_year = date_range.dayofyear
    seasonal_base = 10.0 + 10.0 * np.sin(2 * np.pi * (day_of_year - 80) / 365.25)
    
    # Daily cycle: warmer during day (peak around 2-3 PM)
    hour_of_day = date_range.hour
    daily_cycle = 5.0 * np.sin(2 * np.pi * (hour_of_day - 6) / 24)
    
    # Random weather variability
    weather_noise = np.random.normal(0, 3.0, n)
    
    # Add some heatwaves in summer (June-August)
    month = date_range.month
    is_summer = (month >= 6) & (month <= 8)
    heatwave_prob = np.where(is_summer, 0.02, 0.0)  # 2% chance in summer
    heatwaves = np.random.binomial(1, heatwave_prob, n)
    heatwave_boost = np.where(heatwaves, np.random.uniform(5, 15, n), 0)
    
    # Combine all effects
    temperature = seasonal_base + daily_cycle + weather_noise + heatwave_boost
    
    # Ensure realistic range (-10 to 40°C)
    temperature = np.clip(temperature, -10, 40)
    
    df = pd.DataFrame({
        "datetime_utc": date_range,
        "t2m_mean_c": temperature,
    })
    
    return df
