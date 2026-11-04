/**
 * Passive Connectivity Manager
 *
 * Implements passive connectivity detection based on browser network events
 * and actual HTTP request outcomes (success vs network error), with ZERO polling
 * and ZERO background timers that wake the main thread.
 */

type NetworkStatusListener = (isOnline: boolean) => void;

class PassiveConnectivityManager {
  private _isOnline: boolean;
  private listeners: Set<NetworkStatusListener> = new Set();

  constructor() {
    this._isOnline = typeof window !== 'undefined' ? window.navigator.onLine : true;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnlineEvent);
      window.addEventListener('offline', this.handleOfflineEvent);
    }
  }

  public isOnline(): boolean {
    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      this._isOnline = false;
      return false;
    }
    return this._isOnline;
  }

  public subscribe(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);
    // Notify immediately with current status
    listener(this._isOnline);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Called by API interceptor on successful response
   */
  public recordRequestSuccess(): void {
    if (!this._isOnline) {
      this._isOnline = true;
      this.notifyListeners();
    }
  }

  /**
   * Called by API interceptor on request error
   */
  public recordRequestFailure(error: any): void {
    // Network errors (no response from server, DNS failure, offline)
    if (!error.response && (error.code === 'ERR_NETWORK' || !window.navigator.onLine)) {
      if (this._isOnline) {
        this._isOnline = false;
        this.notifyListeners();
      }
    }
  }

  private handleOnlineEvent = (): void => {
    if (!this._isOnline) {
      this._isOnline = true;
      this.notifyListeners();
    }
  };

  private handleOfflineEvent = (): void => {
    if (this._isOnline) {
      this._isOnline = false;
      this.notifyListeners();
    }
  };

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this._isOnline);
      } catch (err) {
        console.warn('NetworkStatusListener error:', err);
      }
    }
  }
}

export const connectivity = new PassiveConnectivityManager();

import { useState, useEffect } from 'react';

/**
 * React hook for passive connectivity observation
 */
export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() => connectivity.isOnline());

  useEffect(() => {
    return connectivity.subscribe(status => {
      setIsOnline(status);
    });
  }, []);

  return isOnline;
}

