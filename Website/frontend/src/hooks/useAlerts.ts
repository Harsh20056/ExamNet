import { useState, useEffect, useCallback } from 'react';
import type { Alert } from '../types';
import { AlertsApi } from '../services/api';
import { getSocket } from '../services/socket';
import { mockAlerts } from '../mock/data';
import toast from 'react-hot-toast';

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active (unresolved) alerts count
  const activeCount = alerts.filter((a) => !a.resolved).length;

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await AlertsApi.getAll();
      setAlerts(data);
      setError(null);
    } catch (err: any) {
      console.warn('[useAlerts] Falling back to mock alerts:', err.message);
      setAlerts(mockAlerts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();

    // Listen for live anomaly alerts via socket
    const socket = getSocket();
    if (socket) {
      const handleNewAlert = (newAlert: Alert) => {
        setAlerts((prev) => [newAlert, ...prev]);

        // Pop real-time alert toast
        toast.error(`Anomaly Alert: ${newAlert.message}`, {
          duration: 6000,
          id: `toast-${newAlert.id}`,
        });
      };

      const handleAlertResolved = (resolvedId: string) => {
        setAlerts((prev) =>
          prev.map((a) => (a.id === resolvedId ? { ...a, resolved: true } : a))
        );
      };

      socket.on('new_alert', handleNewAlert);
      socket.on('marking_anomaly', handleNewAlert);
      socket.on('alert_resolved', handleAlertResolved);

      return () => {
        socket.off('new_alert', handleNewAlert);
        socket.off('marking_anomaly', handleNewAlert);
        socket.off('alert_resolved', handleAlertResolved);
      };
    }
  }, [fetchAlerts]);

  const resolveAlert = async (alertId: string, note: string) => {
    try {
      await AlertsApi.resolve(alertId, note);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, resolved: true } : a))
      );
      toast.success(`Alert ${alertId} resolved.`);
    } catch {
      // Offline fallback
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, resolved: true } : a))
      );
      toast.success(`Alert ${alertId} resolved locally.`);
    }
  };

  return {
    alerts,
    activeCount,
    loading,
    error,
    refresh: fetchAlerts,
    resolveAlert,
  };
}
