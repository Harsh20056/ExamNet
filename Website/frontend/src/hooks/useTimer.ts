import { useState, useEffect, useRef } from 'react';

export interface UseTimerReturn {
  seconds: number;
  formattedTime: string;
  isPaused: boolean;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

export function useTimer(initialSeconds = 0): UseTimerReturn {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPaused(true);
      } else {
        setIsPaused(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!isPaused) {
      intervalRef.current = window.setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPaused]);

  const pause = () => setIsPaused(true);
  const resume = () => setIsPaused(false);
  const reset = () => {
    setSeconds(0);
    setIsPaused(false);
  };

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const formattedTime = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return {
    seconds,
    formattedTime,
    isPaused,
    pause,
    resume,
    reset,
  };
}
