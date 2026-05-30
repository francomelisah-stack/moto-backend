import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import {
  BROKER_WSS_URL, MQTT_USERNAME, MQTT_PASSWORD,
  MQTT_CLIENT_ID, TOPICS,
} from '../config';

export interface StatusPayload {
  state:     'ON' | 'OFF';
  lat?:      number;
  lon?:      number;
  speed?:    number;
  gps_fix?:  boolean;
  uptime_s?: number;
  device?:   string;
}

export interface AlertPayload {
  alert:   string;
  lat?:    number;
  lon?:    number;
  device?: string;
}

export interface MqttCallbacks {
  onConnected:    () => void;
  onDisconnected: () => void;
  onStatus:       (data: StatusPayload) => void;
  onAlert:        (data: AlertPayload)  => void;
}

export class MqttService {
  private client:    MqttClient | null = null;
  private callbacks: MqttCallbacks;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(callbacks: MqttCallbacks) {
    this.callbacks = callbacks;
  }

  connect(): void {
    const options: IClientOptions = {
      clientId:        MQTT_CLIENT_ID,
      username:        MQTT_USERNAME,
      password:        MQTT_PASSWORD,
      clean:           true,
      reconnectPeriod: 0,          // manejamos reconexión manual
      connectTimeout:  12_000,
      keepalive:       60,
      protocolVersion: 4,          // MQTT v3.1.1 — máxima compatibilidad
    };

    try {
      this.client = mqtt.connect(BROKER_WSS_URL, options);
    } catch (e) {
      console.error('[MQTT] Error al crear cliente:', e);
      this.scheduleReconnect();
      return;
    }

    this.client.on('connect', () => {
      console.log('[MQTT] Conectado');
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.subscribe();
      this.callbacks.onConnected();
    });

    this.client.on('error', (err) => {
      console.error('[MQTT] Error:', err.message);
    });

    this.client.on('close', () => {
      console.log('[MQTT] Conexión cerrada');
      this.callbacks.onDisconnected();
      this.scheduleReconnect();
    });

    this.client.on('offline', () => {
      console.log('[MQTT] Sin red');
      this.callbacks.onDisconnected();
    });

    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message.toString());
    });
  }

  private subscribe(): void {
    if (!this.client?.connected) return;
    [TOPICS.STATUS, TOPICS.ALERT].forEach((topic) => {
      this.client!.subscribe(topic, { qos: 1 }, (err) => {
        if (err) console.error(`[MQTT] Error suscripción ${topic}:`, err.message);
        else     console.log(`[MQTT] Suscrito a ${topic}`);
      });
    });
  }

  private handleMessage(topic: string, raw: string): void {
    console.log(`[MQTT] Mensaje [${topic}]: ${raw}`);
    try {
      const data = JSON.parse(raw);
      if (topic === TOPICS.STATUS) this.callbacks.onStatus(data as StatusPayload);
      if (topic === TOPICS.ALERT)  this.callbacks.onAlert(data  as AlertPayload);
    } catch {
      console.error('[MQTT] JSON inválido:', raw);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log('[MQTT] Reconectando...');
      this.client?.end(true);
      this.client = null;
      this.connect();
    }, 8_000);
  }

  publish(topic: string, payload: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.client?.connected) { resolve(false); return; }
      this.client.publish(topic, payload, { qos: 1, retain: false }, (err) => {
        if (err) { console.error('[MQTT] Error publicando:', err.message); resolve(false); }
        else     { console.log(`[MQTT] Publicado en ${topic}`); resolve(true); }
      });
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.client?.end(true);
    this.client = null;
  }

  get isConnected(): boolean {
    return this.client?.connected ?? false;
  }
}
