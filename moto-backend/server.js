const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

let motoState = {
  encendida: false,          // Estado solicitado desde la app
  releEstado: "UNKNOWN",     // Estado real informado por el ESP32
  lat: 0,
  lng: 0,
  ultimaActualizacion: new Date(),
  ultimaConexionESP32: null
};

// ─────────────────────────────────────────────
// Estado general del servidor
// ─────────────────────────────────────────────

app.get("/", (req, res) => {
  res.json({
    status: "OK",
    sistema: "MotoController Backend"
  });
});

// ─────────────────────────────────────────────
// Estado completo de la moto
// ─────────────────────────────────────────────

app.get("/moto/status", (req, res) => {
  res.json(motoState);
});

// ─────────────────────────────────────────────
// Comandos enviados desde la app
// ─────────────────────────────────────────────

app.post("/moto/start", (req, res) => {
  motoState.encendida = true;
  motoState.ultimaActualizacion = new Date();

  res.json({
    success: true,
    accion: "START",
    command: "ON"
  });
});

app.post("/moto/stop", (req, res) => {
  motoState.encendida = false;
  motoState.ultimaActualizacion = new Date();

  res.json({
    success: true,
    accion: "STOP",
    command: "OFF"
  });
});

// ─────────────────────────────────────────────
// El ESP32 consulta esta ruta
// ─────────────────────────────────────────────

app.get("/moto/command", (req, res) => {
  res.json({
    command: motoState.encendida ? "ON" : "OFF"
  });
});

// ─────────────────────────────────────────────
// El ESP32 confirma el estado físico del relé
// Body esperado:
// {
//   "relayState": "ON"
// }
// ─────────────────────────────────────────────

app.post("/moto/device-status", (req, res) => {
  const { relayState } = req.body;

  if (relayState !== "ON" && relayState !== "OFF") {
    return res.status(400).json({
      success: false,
      error: "relayState debe ser ON u OFF"
    });
  }

  motoState.releEstado = relayState;
  motoState.ultimaConexionESP32 = new Date();

  res.json({
    success: true,
    relayState: motoState.releEstado
  });
});

// ─────────────────────────────────────────────
// GPS, para la etapa siguiente
// ─────────────────────────────────────────────

app.post("/moto/gps", (req, res) => {
  const { lat, lng } = req.body;

  if (typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({
      success: false,
      error: "Latitud o longitud inválida"
    });
  }

  motoState.lat = lat;
  motoState.lng = lng;
  motoState.ultimaActualizacion = new Date();
  motoState.ultimaConexionESP32 = new Date();

  res.json({
    success: true
  });
});

// Render utiliza la variable PORT
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor iniciado en puerto ${PORT}`);
});