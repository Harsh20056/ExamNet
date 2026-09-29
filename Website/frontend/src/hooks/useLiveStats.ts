import { useState, useEffect, useCallback } from 'react';
import { StatsApi } from '../services/api';
import { getSocket } from '../services/socket';

export interface LiveStatsData {
  total: number;
  pending: number;
  inProgress: number;
  flagged: number;
  final: number;
}

export function useLiveStats() {
  const [stats, setStats] = useState<LiveStatsData>({
    total: 1450,
    pending: 380,
    inProgress: 520,
    flagged: 42,
    final: 508,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await StatsApi.getLiveStats();
      setStats(data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    // Listen for socket telemetry broadcast
    const socket = getSocket();
    if (socket) {
      const handleTelemetry = (incoming: Partial<LiveStatsData>) => {
        setStats((prev) => ({ ...prev, ...incoming }));
      };

      socket.on('stats_update', handleTelemetry);
      socket.on('telemetry_tick', handleTelemetry);

      return () => {
        socket.off('stats_update', handleTelemetry);
        socket.off('telemetry_tick', handleTelemetry);
      };
    }
  }, [fetchStats]);

  return {
    stats,
    loading,
    refresh: fetchStats,
  };
}
