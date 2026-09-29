import { useState, useEffect, useCallback } from 'react';
import type { Sheet } from '../types';
import { SheetsApi } from '../services/api';
import { getSocket } from '../services/socket';
import { mockSheets } from '../mock/data';

export function useSheets() {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSheets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await SheetsApi.getAll();
      setSheets(data);
      setError(null);
    } catch (err: any) {
      console.warn('[useSheets] Network unreachable, falling back to mockSheets:', err.message);
      setSheets(mockSheets);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSheets();

    // Listen for socket events updating sheets
    const socket = getSocket();
    if (socket) {
      const handleSheetUpdated = (updated: Sheet) => {
        setSheets((prev) =>
          prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
        );
      };

      const handleSheetAdded = (newSheet: Sheet) => {
        setSheets((prev) => [newSheet, ...prev]);
      };

      socket.on('sheet_updated', handleSheetUpdated);
      socket.on('sheet_added', handleSheetAdded);

      return () => {
        socket.off('sheet_updated', handleSheetUpdated);
        socket.off('sheet_added', handleSheetAdded);
      };
    }
  }, [fetchSheets]);

  return {
    sheets,
    loading,
    error,
    refresh: fetchSheets,
  };
}
