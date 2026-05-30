import React, {
  createContext, useContext, useReducer,
  useEffect, useRef, useCallback, ReactNode,
} from 'react';
import { Alert } from 'react-native';
import { MqttService } from '../services/MqttService';
import { NotificationService } from '../services/NotificationService';
import { TOPICS, DEVICE_TOKEN } from '../config';

// ── Tipos ────────────────────────────────────────────────────

export interface GpsPosition {
  lat:      number;
  lon:      number;
  speed:    number;
  gps_fix:  boolean;
  timestamp: number;
}

export type RelayState = 'ON' | 'OFF' | 'UNKNOWN';

interface AppState {
  isAuthenticated: boolean;
  mqttConnected:   boolean;
  relayState:      RelayState;
  lastUpdate:      number | null;
  gps:             GpsPosition | null;
  alerts:          string[];
  isLoading:       boolean;
}

type Action =
  | { type: 'SET_AUTH';        payload: boolean }
  | { type: 'SET_MQTT';        payload: boolean }
  | { type: 'SET_RELAY';       payload: 'ON' | 'OFF' }
  | { type: 'SET_GPS';         payload: GpsPosition }
  | { type: 'ADD_ALERT';       payload: string }
  | { type: 'CLEAR_ALERTS' }
  | { type: 'SET_LOADING';     payload: boolean };

interface AppContextValue extends AppState {
  login:       () => void;
  logout:      () => void;
  sendCommand: (cmd: 'ON' | 'OFF' | 'STATUS') => Promise<boolean>;
  clearAlerts: () => void;
}

// ── Reducer ──────────────────────────────────────────────────

const initialState: AppState = {
  isAuthenticated: false,
  mqttConnected:   false,
  relayState:      'UNKNOWN',
  lastUpdate:      null,
  gps:             null,
  alerts:          [],
  isLoading:       false,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_AUTH':    return { ...state, isAuthenticated: action.payload };
    case 'SET_MQTT':    return { ...state, mqttConnected:   action.payload };
    case 'SET_RELAY':   return { ...state, relayState: action.payload, lastUpdate: Date.now() };
    case 'SET_GPS':     return { ...state, gps: action.payload };
    case 'ADD_ALERT':   return { ...state, alerts: [action.payload, ...state.alerts.slice(0, 9)] };
    case 'CLEAR_ALERTS': return { ...state, alerts: [] };
    case 'SET_LOADING': return { ...state, isLoading: action.payload };
    default:            return state;
  }
}

// ── Contexto ─────────────────────────────────────────────────

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe estar dentro de AppProvider');
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const mqttRef = useRef<MqttService | null>(null);

  // Conectar MQTT cuando el usuario se autentica
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const mqtt = new MqttService({
      onConnected:    () => dispatch({ type: 'SET_MQTT', payload: true }),
      onDisconnected: () => dispatch({ type: 'SET_MQTT', payload: false }),
      onStatus: (data) => {
        if (data.state === 'ON' || data.state === 'OFF') {
          dispatch({ type: 'SET_RELAY', payload: data.state });
        }
        if (data.lat !== undefined && data.lon !== undefined) {
          dispatch({
            type:    'SET_GPS',
            payload: {
              lat:       data.lat,
              lon:       data.lon,
              speed:     data.speed  ?? 0,
              gps_fix:   data.gps_fix ?? false,
              timestamp: Date.now(),
            },
          });
        }
      },
      onAlert: (data) => {
        const msg = `Alerta: ${data.alert} — ${new Date().toLocaleTimeString('es-AR')}`;
        dispatch({ type: 'ADD_ALERT', payload: msg });
        NotificationService.sendLocal('Alerta de seguridad', 'Tu moto fue encendida sin autorización');
      },
    });

    mqttRef.current = mqtt;
    mqtt.connect();

    return () => {
      mqtt.disconnect();
      mqttRef.current = null;
    };
  }, [state.isAuthenticated]);

  const login = useCallback(() => {
    dispatch({ type: 'SET_AUTH', payload: true });
  }, []);

  const logout = useCallback(() => {
    mqttRef.current?.disconnect();
    dispatch({ type: 'SET_AUTH',  payload: false });
    dispatch({ type: 'SET_MQTT',  payload: false });
  }, []);

  const sendCommand = useCallback(async (cmd: 'ON' | 'OFF' | 'STATUS'): Promise<boolean> => {
    if (!mqttRef.current?.isConnected) {
      Alert.alert('Sin conexión', 'Verificá que el ESP32 esté encendido y con señal 4G.');
      return false;
    }

    dispatch({ type: 'SET_LOADING', payload: true });

    const payload = JSON.stringify({ cmd, token: DEVICE_TOKEN });
    const ok = await mqttRef.current.publish(TOPICS.CMD, payload);

    dispatch({ type: 'SET_LOADING', payload: false });

    if (!ok) Alert.alert('Error', 'No se pudo enviar el comando. Intentá de nuevo.');
    return ok;
  }, []);

  const clearAlerts = useCallback(() => dispatch({ type: 'CLEAR_ALERTS' }), []);

  return (
    <AppContext.Provider value={{ ...state, login, logout, sendCommand, clearAlerts }}>
      {children}
    </AppContext.Provider>
  );
}
