import { io, Socket } from 'socket.io-client';
import { getAuthToken } from './api';
import type { Role } from '../types';

let socketInstance: Socket | null = null;
let currentJoinedRole: Role = null;

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

/**
 * Initializes and connects socket singleton once after login.
 * Sends Firebase ID token in the handshake auth object and joins room by role.
 */
export async function initializeSocket(role: Role): Promise<Socket | null> {
  // If already connected with the same role, return existing instance
  if (socketInstance && socketInstance.connected && currentJoinedRole === role) {
    return socketInstance;
  }

  // Disconnect any existing connection if role changed
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  const token = await getAuthToken();

  try {
    socketInstance = io(BACKEND_URL, {
      auth: {
        token: token || 'mock-token',
        role: role || 'guest',
      },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      autoConnect: true,
    });

    currentJoinedRole = role;

    socketInstance.on('connect', () => {
      console.log(`[SOCKET] Connected to telemetry daemon (ID: ${socketInstance?.id})`);
      if (role) {
        socketInstance?.emit('join_room', { role, timestamp: new Date().toISOString() });
        console.log(`[SOCKET] Joined room: role_${role}`);
      }
    });

    socketInstance.on('connect_error', (err) => {
      console.warn('[SOCKET] Realtime socket connection failed (operating in offline fallback mode):', err.message);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[SOCKET] Disconnected:', reason);
    });

    return socketInstance;
  } catch (err) {
    console.warn('[SOCKET] Could not initialize socket instance:', err);
    return null;
  }
}

/**
 * Returns the current active socket instance if established
 */
export function getSocket(): Socket | null {
  return socketInstance;
}

/**
 * Disconnects and cleans up socket upon user logout
 */
export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    currentJoinedRole = null;
    console.log('[SOCKET] Socket instance disconnected and destroyed.');
  }
}
