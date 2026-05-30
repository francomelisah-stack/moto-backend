import React, { useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, ActivityIndicator,
  SafeAreaView, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import type { RootStackParamList } from '../App';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const BG     = '#0D0D0D';
const CARD   = '#141414';
const BORDER = '#1E1E1E';
const GREEN  = '#22C55E';
const RED    = '#EF4444';
const AMBER  = '#F59E0B';
const TEXT   = '#F5F5F5';
const MUTED  = '#555';

function timeAgo(ts: number | null): string {
  if (!ts) return '—';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `hace ${s}s`;
  if (s < 3600) return `hace ${Math.round(s / 60)}min`;
  return `hace ${Math.round(s / 3600)}h`;
}

// ── Indicador de conexión ────────────────────────────────────

function ConnBadge({ connected }: { connected: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (connected) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.6, duration: 800, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1.0, duration: 800, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulse.setValue(1);
    }
  }, [connected, pulse]);

  const color = connected ? GREEN : RED;

  return (
    <View style={styles.badgeRow}>
      <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[
          styles.pulseDot,
          { backgroundColor: color, transform: [{ scale: pulse }], opacity: 0.35 },
        ]} />
        <View style={[styles.coreDot, { backgroundColor: color }]} />
      </View>
      <Text style={[styles.badgeText, { color }]}>
        {connected ? 'CONECTADO' : 'SIN CONEXIÓN'}
      </Text>
    </View>
  );
}

// ── Botón de control principal ───────────────────────────────

function CtrlBtn({
  label, color, onPress, loading,
}: {
  label: string; color: string; onPress: () => void; loading: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn  = () => Animated.spring(scale, { toValue: 0.93, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1.00, useNativeDriver: true }).start();

  return (
    <Animated.View style={[styles.ctrlWrap, { transform: [{ scale }] }]}>
      <TouchableOpacity
        style={[styles.ctrlBtn, { borderColor: color }]}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={1}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color={color} size="large" />
          : <Text style={[styles.ctrlLabel, { color }]}>{label}</Text>
        }
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Tarjeta GPS ──────────────────────────────────────────────

function GpsCard({ onPress }: { onPress: () => void }) {
  const { gps } = useApp();

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Ubicación GPS</Text>
        <Text style={[styles.gpsFix, { color: gps?.gps_fix ? GREEN : AMBER }]}>
          {gps?.gps_fix ? '● FIX' : '○ SIN FIX'}
        </Text>
      </View>
      {gps ? (
        <View style={styles.gpsGrid}>
          <View style={styles.gpsCell}>
            <Text style={styles.gpsLbl}>LAT</Text>
            <Text style={styles.gpsVal}>{gps.lat.toFixed(5)}</Text>
          </View>
          <View style={styles.gpsCell}>
            <Text style={styles.gpsLbl}>LON</Text>
            <Text style={styles.gpsVal}>{gps.lon.toFixed(5)}</Text>
          </View>
          <View style={styles.gpsCell}>
            <Text style={styles.gpsLbl}>VEL</Text>
            <Text style={styles.gpsVal}>{Math.round(gps.speed)} km/h</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.gpsWaiting}>Esperando señal GPS...</Text>
      )}
      <Text style={styles.mapHint}>Ver en mapa →</Text>
    </TouchableOpacity>
  );
}

// ── Pantalla principal ───────────────────────────────────────

export default function HomeScreen() {
  const nav = useNavigation<Nav>();
  const {
    relayState, mqttConnected, lastUpdate,
    alerts, isLoading, sendCommand, logout,
  } = useApp();

  const isOn = relayState === 'ON';
  const stateColor = isOn ? GREEN : RED;

  const handleOn = useCallback(() => {
    Alert.alert(
      'Confirmar encendido',
      '¿Querés encender el contacto de la moto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Encender', onPress: () => sendCommand('ON') },
      ],
    );
  }, [sendCommand]);

  const handleOff = useCallback(() => {
    sendCommand('OFF');
  }, [sendCommand]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>MotoController</Text>
            <Text style={styles.headerSub}>Sistema de seguridad</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn} accessibilityLabel="Cerrar sesión">
            <Text style={styles.logoutTxt}>Salir</Text>
          </TouchableOpacity>
        </View>

        <ConnBadge connected={mqttConnected} />

        {/* Panel de estado */}
        <View style={[styles.statusPanel, { borderColor: stateColor }]}>
          <Text style={styles.statusLbl}>ESTADO DEL CONTACTO</Text>
          <Text style={[styles.statusVal, { color: stateColor }]}>
            {relayState === 'UNKNOWN' ? '—' : relayState}
          </Text>
          <View style={[styles.statusDot, { backgroundColor: stateColor }]} />
          <Text style={styles.statusTime}>{timeAgo(lastUpdate)}</Text>
        </View>

        {/* Botones ON / OFF */}
        <View style={styles.ctrlRow}>
          <CtrlBtn label="ENCENDER" color={GREEN}  onPress={handleOn}  loading={isLoading && !isOn}  />
          <CtrlBtn label="APAGAR"   color={RED}    onPress={handleOff} loading={isLoading &&  isOn}  />
        </View>

        {/* Actualizar */}
        <TouchableOpacity
          style={[styles.refreshBtn, !mqttConnected && { opacity: 0.4 }]}
          onPress={() => sendCommand('STATUS')}
          disabled={!mqttConnected}
        >
          <Text style={styles.refreshTxt}>↻  Actualizar estado</Text>
        </TouchableOpacity>

        {/* GPS */}
        <GpsCard onPress={() => nav.navigate('Map')} />

        {/* Alertas */}
        {alerts.length > 0 && (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, { color: RED }]}>Alertas de seguridad</Text>
            {alerts.slice(0, 5).map((a, i) => (
              <View key={i} style={styles.alertRow}>
                <View style={styles.alertDot} />
                <Text style={styles.alertTxt}>{a}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Info dispositivo */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dispositivo</Text>
          {[
            ['ID',         'ESP32_MOTO_001'],
            ['Protocolo',  'MQTT / TLS 1.2'],
            ['Red',        '4G LTE'],
          ].map(([k, v]) => (
            <View key={k} style={styles.infoRow}>
              <Text style={styles.infoKey}>{k}</Text>
              <Text style={styles.infoVal}>{v}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  scroll: { padding: 18, paddingBottom: 40, gap: 14 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TEXT },
  headerSub:   { fontSize: 12, color: MUTED, marginTop: 2 },
  logoutBtn:   { padding: 8 },
  logoutTxt:   { fontSize: 13, color: MUTED },

  badgeRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pulseDot:  { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  coreDot:   { width: 8, height: 8, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  statusPanel: {
    alignItems: 'center', padding: 24,
    backgroundColor: CARD, borderRadius: 18, borderWidth: 1.5,
  },
  statusLbl:  { fontSize: 11, color: MUTED, letterSpacing: 2 },
  statusVal:  { fontSize: 54, fontWeight: '800', letterSpacing: 4, marginVertical: 6 },
  statusDot:  { width: 10, height: 10, borderRadius: 5 },
  statusTime: { fontSize: 11, color: MUTED, marginTop: 6 },

  ctrlRow:  { flexDirection: 'row', gap: 14 },
  ctrlWrap: { flex: 1 },
  ctrlBtn: {
    backgroundColor: CARD, borderRadius: 18, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 32, minHeight: 120,
  },
  ctrlLabel: { fontSize: 16, fontWeight: '700', letterSpacing: 1.5 },

  refreshBtn: {
    alignItems: 'center', padding: 12,
    backgroundColor: CARD, borderRadius: 10,
    borderWidth: 1, borderColor: BORDER,
  },
  refreshTxt: { color: MUTED, fontSize: 13 },

  card: {
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER, padding: 14,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle:  { fontSize: 14, fontWeight: '600', color: TEXT, marginBottom: 10 },
  gpsFix:     { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  gpsGrid:    { flexDirection: 'row', gap: 8 },
  gpsCell:    { flex: 1, backgroundColor: '#1E1E1E', borderRadius: 8, padding: 8 },
  gpsLbl:     { fontSize: 9, color: MUTED, letterSpacing: 1, marginBottom: 3 },
  gpsVal:     { fontSize: 12, fontWeight: '600', color: TEXT },
  gpsWaiting: { fontSize: 13, color: MUTED },
  mapHint:    { fontSize: 11, color: AMBER, textAlign: 'right', marginTop: 10 },

  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, borderTopWidth: 1, borderTopColor: BORDER },
  alertDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: RED },
  alertTxt: { fontSize: 12, color: '#EF9090', flex: 1 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: BORDER },
  infoKey: { fontSize: 12, color: MUTED },
  infoVal: { fontSize: 12, color: TEXT, fontWeight: '500' },
});
