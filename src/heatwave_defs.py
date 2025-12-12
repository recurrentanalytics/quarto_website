# src/heatwave_defs.py

from __future__ import annotations

import pandas as pd


def restrict_common_period(
    prices: pd.DataFrame,
    weather: pd.DataFrame,
    datetime_col: str = "datetime_utc",
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Restrict both DataFrames to their common overlapping datetime period.

    Both inputs must have a datetime column (default: 'datetime_utc').
    Returns (prices_restricted, weather_restricted).
    """
    p = prices.copy()
    w = weather.copy()

    p[datetime_col] = pd.to_datetime(p[datetime_col], utc=True)
    w[datetime_col] = pd.to_datetime(w[datetime_col], utc=True)

    start = max(p[datetime_col].min(), w[datetime_col].min())
    end = min(p[datetime_col].max(), w[datetime_col].max())

    mask_p = (p[datetime_col] >= start) & (p[datetime_col] <= end)
    mask_w = (w[datetime_col] >= start) & (w[datetime_col] <= end)

    p = p.loc[mask_p].reset_index(drop=True)
    w = w.loc[mask_w].reset_index(drop=True)

    return p, w


def compute_daily_max_temp(weather_df: pd.DataFrame) -> pd.DataFrame:
    """
    From hourly weather (t2m_mean_c), compute daily max temperature.

    Input columns:
        - datetime_utc
        - t2m_mean_c

    Returns a DataFrame indexed by date (DatetimeIndex, tz-naive)
    with:
        - t2m_daily_max_c
    """
    df = weather_df.copy()
    df["datetime_utc"] = pd.to_datetime(df["datetime_utc"], utc=True)
    # derive calendar date without time, drop tz
    df["date"] = df["datetime_utc"].dt.normalize().dt.tz_localize(None)

    daily = (
        df.groupby("date")["t2m_mean_c"]
        .max()
        .to_frame(name="t2m_daily_max_c")
    )

    # index is datetime64[ns], tz-naive (good for daily ops)
    return daily


def flag_heatwaves(
    daily_df: pd.DataFrame,
    threshold: float = 30.0,
    min_duration: int = 3,
) -> pd.DataFrame:
    """
    Flag heatwave days.

    Heatwave definition:
      - daily max temperature >= threshold
      - part of a run of >= min_duration consecutive hot days

    Input: daily_df with index = date and column 't2m_daily_max_c'.
    Returns a DataFrame with additional columns:
      - is_hot
      - run_id
      - is_heatwave_day
    """
    df = daily_df.copy()
    df["is_hot"] = df["t2m_daily_max_c"] >= threshold

    # Identify runs of consecutive hot / non-hot days
    # When is_hot changes, group id increments
    group_id = (df["is_hot"] != df["is_hot"].shift()).cumsum()
    df["run_id"] = group_id.where(df["is_hot"])

    # Count run lengths per run_id
    run_lengths = df.groupby("run_id")["is_hot"].transform("size")
    df["is_heatwave_day"] = df["is_hot"] & (run_lengths >= min_duration)

    return df


def expand_heatwave_flag_to_hourly(
    weather_df: pd.DataFrame,
    daily_flags: pd.DataFrame,
) -> pd.DataFrame:
    """
    Join the daily 'is_heatwave_day' flag back onto the hourly weather dataframe.

    We use tz-naive dates on both sides for a clean merge.

    Input:
      - weather_df with columns ['datetime_utc', 't2m_mean_c']
      - daily_flags indexed by date with column 'is_heatwave_day'

    Output:
      - weather_df with new boolean column 'is_heatwave_day'
    """
    df = weather_df.copy()
    df["datetime_utc"] = pd.to_datetime(df["datetime_utc"], utc=True)

    # tz-naive date column (normalized to midnight, tz removed)
    df["date"] = df["datetime_utc"].dt.normalize().dt.tz_localize(None)

    # daily_flags index: ensure datetime tz-naive, name 'date'
    daily = daily_flags.copy()
    daily.index = pd.to_datetime(daily.index)
    if daily.index.tz is not None:
        daily.index = daily.index.tz_localize(None)
    daily.index.name = "date"

    # merge on tz-naive date
    df = df.merge(
        daily[["is_heatwave_day"]],
        on="date",
        how="left",
    )

    df["is_heatwave_day"] = df["is_heatwave_day"].fillna(False)
    df.drop(columns=["date"], inplace=True)
    return df


def merge_price_and_weather(
    prices: pd.DataFrame,
    weather: pd.DataFrame,
) -> pd.DataFrame:
    """
    Merge hourly prices and weather on datetime_utc, and add simple
    calendar features.

    Inputs:
      - prices: ['datetime_utc', 'price_eur_mwh', ...]
      - weather: ['datetime_utc', 't2m_mean_c', 'is_heatwave_day', ...]

    Output:
      - DataFrame with merged columns plus:
          hour, dow, month
    """
    p = prices.copy()
    w = weather.copy()

    p["datetime_utc"] = pd.to_datetime(p["datetime_utc"], utc=True)
    w["datetime_utc"] = pd.to_datetime(w["datetime_utc"], utc=True)

    df = pd.merge(
        p,
        w,
        on="datetime_utc",
        how="inner",
    )

    dt = df["datetime_utc"].dt
    df["hour"] = dt.hour
    df["dow"] = dt.dayofweek  # 0=Mon
    df["month"] = dt.month

    return df
