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

    const socket = getSocket();
    if (socket) {
      const handleTelemetry = (incoming: any) => {
        setStats((prev) => ({
          total: incoming.total ?? prev.total,
          pending: incoming.pending ?? incoming.sheetsUploaded ?? prev.pending,
          inProgress: incoming.inProgress ?? incoming.sheetsInProgress ?? prev.inProgress,
          flagged: incoming.flagged ?? incoming.sheetsFlagged ?? prev.flagged,
          final: incoming.final ?? incoming.sheetsEvaluated ?? prev.final,
        }));
      };

      socket.on('stats_update', handleTelemetry);
      socket.on('telemetry_tick', handleTelemetry);
      socket.on('dashboard_tick', handleTelemetry);

      return () => {
        socket.off('stats_update', handleTelemetry);
        socket.off('telemetry_tick', handleTelemetry);
        socket.off('dashboard_tick', handleTelemetry);
      };
    }
  }, [fetchStats]);

  return {
    stats,
    loading,
    refresh: fetchStats,
  };
}
