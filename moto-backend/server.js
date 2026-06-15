const express = require("express");
const cors = require("cors");
const mqtt = require("mqtt");

const app = express();

app.use(cors());
app.use(express.json());

// ==================================================
// MQTT
// ==================================================

const MQTT_BROKER = "mqtt://broker.hivemq.com:1883";

// Tópico largo para reducir el riesgo de coincidencias
const MQTT_TOPIC = "francomelisah/moto/001/cmd-7f2a9c";

const mqttClient = mqtt.connect(MQTT_BROKER, {
  clientId: `render-moto-${Math.random().toString(16).slice(2, 10)}`,
  reconnectPeriod: 5000,
  connectTimeout: 30000,
  clean: true,
});

mqttClient.on("connect", () => {
  console.log("MQTT CONECTADO");
  console.log("Topico:", MQTT_TOPIC);
});

mqttClient.on("reconnect", () => {
  console.log("Reconectando MQTT...");
});

mqttClient.on("error", (error) => {
  console.error("ERROR MQTT:", error.message);
});

// ==================================================
// ESTADO
// ==================================================

let motoState = {
  encendida: false,
  releEstado: "UNKNOWN",
  mqttConectado: false,
  lat: 0,
  lng: 0,
  ultimaActualizacion: new Date(),
  ultimaConexionESP32: null,
};

mqttClient.on("connect", () => {
  motoState.mqttConectado = true;
});

mqttClient.on("close", () => {
  motoState.mqttConectado = false;
});

// ==================================================
// PUBLICAR COMANDO MQTT
// ==================================================

function publicarComando(command, callback) {
  if (!mqttClient.connected) {
    return callback(new Error("MQTT no está conectado"));
  }

  mqttClient.publish(
    MQTT_TOPIC,
    command,
    {
      qos: 1,
      retain: true,
    },
    callback
  );
}

// ==================================================
// RUTAS
// ==================================================

app.get("/", (req, res) => {
  res.json({
    status: "OK",
    sistema: "MotoController Backend",
    mqtt: mqttClient.connected,
  });
});

app.get("/moto/status", (req, res) => {
  res.json(motoState);
});

app.get("/moto/command", (req, res) => {
  res.json({
    command: motoState.encendida ? "ON" : "OFF",
  });
});

// ==================================================
// ENCENDER
// ==================================================

app.post("/moto/start", (req, res) => {
  publicarComando("ON", (error) => {
    if (error) {
      console.error("No se pudo publicar ON:", error.message);

      return res.status(503).json({
        success: false,
        error: "MQTT no disponible",
      });
    }

    motoState.encendida = true;
    motoState.ultimaActualizacion = new Date();

    console.log("Comando MQTT publicado: ON");

    res.json({
      success: true,
      accion: "START",
      command: "ON",
    });
  });
});

// ==================================================
// APAGAR
// ==================================================

app.post("/moto/stop", (req, res) => {
  publicarComando("OFF", (error) => {
    if (error) {
      console.error("No se pudo publicar OFF:", error.message);

      return res.status(503).json({
        success: false,
        error: "MQTT no disponible",
      });
    }

    motoState.encendida = false;
    motoState.ultimaActualizacion = new Date();

    console.log("Comando MQTT publicado: OFF");

    res.json({
      success: true,
      accion: "STOP",
      command: "OFF",
    });
  });
});

// ==================================================
// CONFIRMACIÓN DEL ESP32
// ==================================================

app.post("/moto/device-status", (req, res) => {
  const { relayState } = req.body;

  if (relayState !== "ON" && relayState !== "OFF") {
    return res.status(400).json({
      success: false,
      error: "relayState debe ser ON u OFF",
    });
  }

  motoState.releEstado = relayState;
  motoState.ultimaConexionESP32 = new Date();

  res.json({
    success: true,
    relayState,
  });
});

// ==================================================
// GPS — PARA LA SIGUIENTE ETAPA
// ==================================================

app.post("/moto/gps", (req, res) => {
  const { lat, lng } = req.body;

  if (typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({
      success: false,
      error: "Latitud o longitud inválida",
    });
  }

  motoState.lat = lat;
  motoState.lng = lng;
  motoState.ultimaActualizacion = new Date();
  motoState.ultimaConexionESP32 = new Date();

  res.json({
    success: true,
  });
});

// ==================================================
// SERVIDOR
// ==================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor iniciado en puerto ${PORT}`);
});