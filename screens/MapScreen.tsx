/*
 * MapScreen.tsx
 * Pantalla de mapa con ubicación GPS en tiempo real
 * Requiere: react-native-maps, expo-location
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import type { RootStackParamList } from '../App';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Map'>;

const BG    = '#0D0D0D';
const CARD  = '#141414';
const AMBER = '#F59E0B';
const TEXT  = '#F5F5F5';
const MUTED = '#666';

// Cambiá a false si no configuraste la API key de Google Maps
const USE_GOOGLE_MAPS = false;

const MAX_TRAIL = 100;

export default function MapScreen() {
  const navigation = useNavigation<Nav>();
  const { gps, relayState } = useApp();
  const mapRef = useRef<MapView>(null);
  const [trail, setTrail] = useState<Array<{ lat: number; lon: number }>>([]);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');

  // Acumular rastro de posiciones
  useEffect(() => {
    if (!gps || !gps.gps_fix) return;
    setTrail(prev => {
      const next = [...prev, { lat: gps.lat, lon: gps.lon }];
      return next.slice(-MAX_TRAIL);
    });
  }, [gps]);

  // Centrar mapa cuando llega nueva posición
  useEffect(() => {
    if (!gps || !gps.gps_fix) return;
    mapRef.current?.animateToRegion({
      latitude:       gps.lat,
      longitude:      gps.lon,
      latitudeDelta:  0.005,
      longitudeDelta: 0.005,
    }, 500);
  }, [gps]);

  const noGps = !gps || !gps.gps_fix;

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Ubicación GPS</Text>
        <TouchableOpacity
          style={styles.mapTypeBtn}
          onPress={() => setMapType(t => t === 'standard' ? 'satellite' : 'standard')}
        >
          <Text style={styles.mapTypeText}>
            {mapType === 'standard' ? '🛰️' : '🗺️'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Mapa ── */}
      {noGps ? (
        <View style={styles.noGpsContainer}>
          <Text style={styles.noGpsIcon}>📡</Text>
          <Text style={styles.noGpsTitle}>Sin señal GPS</Text>
          <Text style={styles.noGpsText}>
            El dispositivo no tiene fix GPS todavía.{'\n'}
            Asegúrate de que esté al aire libre.
          </Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={USE_GOOGLE_MAPS ? PROVIDER_GOOGLE : undefined}
          mapType={mapType}
          initialRegion={{
            latitude:       gps!.lat,
            longitude:      gps!.lon,
            latitudeDelta:  0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={false}
          showsTraffic={false}
        >
          {/* Marcador de la moto */}
          <Marker
            coordinate={{ latitude: gps!.lat, longitude: gps!.lon }}
            title="Mi Moto"
            description={`Vel: ${gps!.speed.toFixed(0)} km/h`}
          >
            <View style={[styles.marker, { borderColor: relayState === 'ON' ? '#22C55E' : '#EF4444' }]}>
              <Text style={styles.markerIcon}>🏍️</Text>
            </View>
          </Marker>

          {/* Rastro de recorrido */}
          {trail.length > 1 && (
            <Polyline
              coordinates={trail.map(p => ({ latitude: p.lat, longitude: p.lon }))}
              strokeColor={AMBER}
              strokeWidth={2}
              lineDashPattern={[8, 4]}
            />
          )}
        </MapView>
      )}

      {/* ── Panel de datos ── */}
      <View style={styles.dataPanel}>
        <View style={styles.dataItem}>
          <Text style={styles.dataLabel}>LAT</Text>
          <Text style={styles.dataValue}>{gps ? gps.lat.toFixed(6) : '--'}</Text>
        </View>
        <View style={styles.dataSep} />
        <View style={styles.dataItem}>
          <Text style={styles.dataLabel}>LON</Text>
          <Text style={styles.dataValue}>{gps ? gps.lon.toFixed(6) : '--'}</Text>
        </View>
        <View style={styles.dataSep} />
        <View style={styles.dataItem}>
          <Text style={styles.dataLabel}>VEL</Text>
          <Text style={styles.dataValue}>{gps ? `${gps.speed.toFixed(0)} km/h` : '--'}</Text>
        </View>
        <View style={styles.dataSep} />
        <View style={styles.dataItem}>
          <Text style={styles.dataLabel}>PUNTOS</Text>
          <Text style={styles.dataValue}>{trail.length}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: BG,
  },
  backBtn:      { padding: 8 },
  backIcon:     { fontSize: 28, color: TEXT, lineHeight: 30 },
  title:        { fontSize: 18, fontWeight: '600', color: TEXT },
  mapTypeBtn:   { padding: 8 },
  mapTypeText:  { fontSize: 22 },

  map: { flex: 1 },

  noGpsContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  noGpsIcon:  { fontSize: 56 },
  noGpsTitle: { fontSize: 20, fontWeight: '600', color: TEXT },
  noGpsText:  { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 22 },

  marker: {
    backgroundColor: CARD, borderRadius: 20,
    borderWidth: 2, padding: 6,
  },
  markerIcon: { fontSize: 22 },

  dataPanel: {
    flexDirection: 'row', backgroundColor: CARD,
    paddingVertical: 14, paddingHorizontal: 8,
    borderTopWidth: 1, borderTopColor: '#1F1F1F',
  },
  dataItem:  { flex: 1, alignItems: 'center' },
  dataLabel: { fontSize: 10, color: MUTED, letterSpacing: 1, marginBottom: 4 },
  dataValue: { fontSize: 13, fontWeight: '600', color: TEXT },
  dataSep:   { width: 1, backgroundColor: '#1F1F1F' },
});
