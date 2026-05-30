# 🏍️ Moto Controller — Guía de Instalación Completa

Sistema de control y seguridad para motocicletas via 4G LTE.

---

## Arquitectura del sistema

```
┌─────────────────┐   MQTT/TLS    ┌─────────────────┐   4G LTE   ┌─────────────────────┐
│   App Móvil      │◄────────────►│  Broker MQTT    │◄──────────►│  ESP32 + SIMA7670SA │
│ (React Native)  │   WSS:8884    │  (HiveMQ Cloud) │  TCP:8883  │  + Relé + GPS       │
└─────────────────┘               └─────────────────┘            └─────────────────────┘
```

---

## 1. Hardware necesario

| Componente | Descripción |
|-----------|-------------|
| ESP32 DevKit | Microcontrolador principal |
| SIM A7670SA | Módulo 4G LTE + GPS integrado |
| Módulo relé 5V | Control del contacto de la moto |
| SIM card 4G | Con plan de datos (Claro/Movistar/Personal AR) |
| Resistencia 10kΩ | Pull-down para GPIO del relé |
| Fuente 12V→5V | Para alimentar desde batería de la moto |

### Esquema de conexiones

```
ESP32         SIMA7670SA
──────        ──────────
GPIO17 TX2 ──► RX
GPIO16 RX2 ◄── TX
GND        ── GND
5V         ── VCC

ESP32         RELÉ
──────        ────
GPIO4      ──► IN  (señal de control)
3.3V       ──► VCC
GND        ── GND

RELÉ          MOTO
────          ────
NO         ──► Cable contacto (+12V)
COM        ──► ECU / bobina de arranque
```

> ⚠️ **IMPORTANTE**: Usar un optoacoplador entre el GPIO del ESP32 y el relé para proteger el microcontrolador. Nunca conectar el relé directamente a circuitos de alta corriente de la moto.

---

## 2. Configurar el Broker MQTT

### Opción A: HiveMQ Cloud (Recomendado – gratuito)

1. Crear cuenta en https://www.hivemq.com/mqtt-cloud-broker/
2. Crear un cluster gratuito
3. Ir a **Access Management** → crear usuario `moto_device` y `moto_app`
4. Anotar el **hostname** del cluster (ej: `abc123.s1.eu.hivemq.cloud`)
5. Puerto MQTT TLS: **8883** | Puerto WebSocket TLS: **8884**

### Opción B: Mosquitto en servidor propio

```bash
# Instalar en Ubuntu/Debian
sudo apt install mosquitto mosquitto-clients

# Configuración básica con TLS
cat > /etc/mosquitto/conf.d/moto.conf << 'EOF'
listener 8883
cafile   /etc/mosquitto/certs/ca.crt
certfile /etc/mosquitto/certs/server.crt
keyfile  /etc/mosquitto/certs/server.key
require_certificate false
allow_anonymous false
password_file /etc/mosquitto/passwd
EOF

# Crear usuarios
sudo mosquitto_passwd -c /etc/mosquitto/passwd moto_device
sudo mosquitto_passwd    /etc/mosquitto/passwd moto_app
sudo systemctl restart mosquitto
```

---

## 3. Firmware ESP32

### Dependencias (Arduino IDE o PlatformIO)

```ini
; platformio.ini
[env:esp32dev]
platform  = espressif32
board     = esp32dev
framework = arduino
lib_deps  =
    bblanchon/ArduinoJson@^6.21.0
monitor_speed = 115200
```

### Pasos de instalación

1. Abrir `moto_controller.ino` en Arduino IDE o PlatformIO
2. Editar las constantes al inicio del archivo:
   ```cpp
   #define APN           "internet.movistar.ar"  // Tu APN
   #define MQTT_BROKER   "xxx.hivemq.cloud"       // Tu broker
   #define MQTT_PORT     8883
   #define MQTT_USER     "moto_device"
   #define MQTT_PASS     "TuPassword"
   #define DEVICE_TOKEN  "tok_abc123xyz"           // Token único, cámbialo
   ```
3. Seleccionar placa: **ESP32 Dev Module**
4. Flashear a 115200 baud
5. Monitorear Serial para verificar conexión:
   ```
   [MODEM] Iniciando...
   [MODEM] Red registrada
   [GPS] Encendiendo GPS...
   [MQTT] Conectado y suscrito
   === SISTEMA LISTO ===
   ```

### APNs por operadora (Argentina)

| Operadora | APN |
|-----------|-----|
| Movistar  | `internet.movistar.ar` |
| Claro     | `igprs.claro.com.ar` |
| Personal  | `gprs.personal.com` |

---

## 4. Aplicación móvil

### Requisitos

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Expo Go app en el celular (para testing)

### Instalación

```bash
# Crear proyecto Expo
npx create-expo-app MotoController --template blank-typescript
cd MotoController

# Copiar los archivos de la carpeta /app a tu proyecto

# Instalar dependencias
npx expo install expo-local-authentication
npx expo install expo-secure-store
npx expo install expo-notifications
npx expo install expo-device
npm install @react-navigation/native @react-navigation/stack
npx expo install react-native-screens react-native-safe-area-context
npm install react-native-maps
npm install mqtt
npm install @react-native-async-storage/async-storage
npm install @types/mqtt --save-dev
```

### Configurar credenciales MQTT en la app

Editar `services/MqttService.ts`:
```typescript
const MQTT_CONFIG = {
  brokerUrl: 'wss://TU-BROKER.hivemq.cloud:8884/mqtt',
  options: {
    username: 'moto_app',
    password: 'TuPasswordApp',
    // ...
  }
};
```

Editar `context/AppContext.tsx`:
```typescript
const DEVICE_TOKEN_VAL = 'tok_abc123xyz'; // Mismo que en el firmware
```

### Ejecutar

```bash
# Desarrollo
npx expo start

# Build para Android (APK)
npx expo build:android

# Build para iOS
npx expo build:ios
```

---

## 5. Topics MQTT y formato de mensajes

### App → ESP32 (Comandos)
**Topic**: `moto/001/cmd`
```json
{
  "cmd":   "ON",
  "token": "tok_abc123xyz"
}
```
Valores de `cmd`: `"ON"` | `"OFF"` | `"STATUS"`

### ESP32 → App (Estado)
**Topic**: `moto/001/status`
```json
{
  "state":    "ON",
  "lat":      -31.416872,
  "lon":      -64.183418,
  "speed":    45.2,
  "gps_fix":  true,
  "uptime_s": 3600,
  "device":   "ESP32_MOTO_001"
}
```

### ESP32 → App (Alerta)
**Topic**: `moto/001/alert`
```json
{
  "alert":  "UNAUTHORIZED_START",
  "lat":    -31.416872,
  "lon":    -64.183418,
  "device": "ESP32_MOTO_001"
}
```

---

## 6. Seguridad

### Medidas implementadas

- ✅ **TLS 1.2** en toda la comunicación MQTT
- ✅ **Token de dispositivo** en cada comando (evita comandos de terceros)
- ✅ **Autenticación biométrica** (Face ID / huella) en la app
- ✅ **PIN con hash** almacenado en SecureStore (encriptado en el dispositivo)
- ✅ **Bloqueo por intentos**: 5 intentos fallidos → bloqueo de 5 minutos
- ✅ **Relay fail-safe**: arranca apagado, necesita comando explícito para encender

### Mejoras recomendadas para producción

- [ ] Verificación de certificado CA del broker (no solo TLS)
- [ ] Rotación periódica del `DEVICE_TOKEN`
- [ ] JWT con expiración en lugar de token fijo
- [ ] VPN o broker privado en lugar de cloud compartido
- [ ] Registrar todos los comandos en un backend

---

## 7. Diagnóstico y troubleshooting

### El ESP32 no se conecta a la red

```cpp
// Verificar APN
AT+CGDCONT?              // Ver APN configurado
AT+CSQ                   // Señal (>10 es aceptable)
AT+CREG?                 // 0,1 = registrado en red home
AT+COPS?                 // Operadora conectada
```

### No hay fix GPS

- La antena GPS necesita **visión directa del cielo**
- El primer fix puede tardar 1-5 minutos (cold start)
- Verificar con: `AT+CGNSINF` → el segundo campo debe ser `1`

### La app no conecta al broker

1. Verificar que el puerto 8884 (WSS) esté abierto
2. HiveMQ Cloud: revisar credenciales en Access Management
3. Probar con MQTT Explorer: https://mqtt-explorer.com

---

## 8. Estructura del proyecto

```
moto-controller/
├── firmware/
│   └── moto_controller.ino       ← Firmware ESP32
└── app/
    ├── App.tsx                   ← Entrada principal
    ├── context/
    │   └── AppContext.tsx         ← Estado global
    ├── screens/
    │   ├── AuthScreen.tsx         ← PIN + biometría
    │   ├── HomeScreen.tsx         ← Control principal
    │   └── MapScreen.tsx          ← Mapa GPS
    └── services/
        ├── MqttService.ts         ← Cliente MQTT
        ├── AuthService.ts         ← Autenticación
        └── NotificationService.ts ← Notificaciones push
```

---

## Licencia

MIT – Uso libre, sin garantías para aplicaciones críticas de seguridad.
Siempre incluir un sistema mecánico de respaldo independiente del sistema electrónico.
