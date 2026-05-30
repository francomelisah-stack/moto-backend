import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Vibration, Animated, SafeAreaView,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { AuthService } from '../services/AuthService';

const PIN_LENGTH = 6;
const BG         = '#0D0D0D';
const CARD       = '#1A1A1A';
const AMBER      = '#F59E0B';
const RED        = '#EF4444';
const MUTED      = '#555';
const TEXT       = '#F5F5F5';

// ── Punto del PIN ────────────────────────────────────────────

function PinDot({ filled, error }: { filled: boolean; error: boolean }) {
  return (
    <View style={[
      styles.dot,
      filled && { backgroundColor: AMBER, borderColor: AMBER },
      error  && { borderColor: RED },
    ]} />
  );
}

// ── Botón del teclado ────────────────────────────────────────

function KeyBtn({ label, sub, onPress }: { label: string; sub?: string; onPress: () => void }) {
  // useRef para que el Animated.Value no se recree en cada render
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn  = () => Animated.spring(scale, { toValue: 0.88, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();

  if (!label) return <View style={styles.keyBtn} />;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={styles.keyBtn}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={1}
      >
        <Text style={styles.keyMain}>{label}</Text>
        {sub ? <Text style={styles.keySub}>{sub}</Text> : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Pantalla ─────────────────────────────────────────────────

type Step = 'enter' | 'create' | 'confirm';

export default function AuthScreen() {
  const { login } = useApp();

  const [pin,        setPin]        = useState('');
  const [step,       setStep]       = useState<Step>('enter');
  const [firstPin,   setFirstPin]   = useState('');
  const [error,      setError]      = useState('');
  const [bioLabel,   setBioLabel]   = useState('');
  const [isFirstRun, setIsFirstRun] = useState(false);

  // Ref para la animación de shake (no debe recrearse en cada render)
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Inicialización: detectar si es primer uso y si hay biometría
  useEffect(() => {
    let mounted = true;
    (async () => {
      const pinSet     = await AuthService.hasPin();
      const bioAvail   = await AuthService.isBiometricAvailable();

      if (!mounted) return;

      if (!pinSet) {
        setIsFirstRun(true);
        setStep('create');
      }

      if (pinSet && bioAvail) {
        const label = await AuthService.getBiometricLabel();
        setBioLabel(label);
        tryBiometric();
      }
    })();
    return () => { mounted = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shake = useCallback(() => {
    Vibration.vibrate(300);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   0, duration: 55, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const tryBiometric = useCallback(async () => {
    const ok = await AuthService.authenticateBiometric();
    if (ok) login();
  }, [login]);

  const handleKey = useCallback(async (key: string) => {
    if (key === 'DEL') {
      setPin(p => p.slice(0, -1));
      setError('');
      return;
    }

    const newPin = pin + key;
    setPin(newPin);
    if (newPin.length < PIN_LENGTH) return;

    // PIN completo — procesar según el paso actual
    if (isFirstRun) {
      if (step === 'create') {
        setFirstPin(newPin);
        setPin('');
        setStep('confirm');
        return;
      }
      // Paso confirmar
      if (newPin === firstPin) {
        await AuthService.setPin(newPin);
        login();
      } else {
        shake();
        setError('Los PIN no coinciden. Intentá de nuevo.');
        setPin('');
        setFirstPin('');
        setStep('create');
      }
    } else {
      const result = await AuthService.verifyPin(newPin);
      if (result.success) {
        login();
      } else {
        shake();
        setError(result.message);
        setPin('');
      }
    }
  }, [pin, isFirstRun, step, firstPin, login, shake]);

  const subtitle = isFirstRun
    ? step === 'create'   ? `Crear PIN de acceso (${PIN_LENGTH} dígitos)`
                          : 'Confirmar PIN'
    : `Ingresá tu PIN`;

  const KEYS = [
    ['1','','2','ABC','3','DEF'],
    ['4','GHI','5','JKL','6','MNO'],
    ['7','PQRS','8','TUV','9','WXYZ'],
    ['','','0','+','DEL',''],
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>MO</Text>
          </View>
          <Text style={styles.appName}>MOTOCONTROLLER</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {/* Puntos PIN */}
        <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <PinDot key={i} filled={i < pin.length} error={!!error} />
          ))}
        </Animated.View>
        <Text style={styles.errorText}>{error || ' '}</Text>

        {/* Teclado */}
        <View style={styles.keypad}>
          {KEYS.map((row, ri) => (
            <View key={ri} style={styles.keyRow}>
              {[0, 1, 2].map((ci) => {
                const label = row[ci * 2];
                const sub   = row[ci * 2 + 1];
                return (
                  <KeyBtn
                    key={ci}
                    label={label}
                    sub={sub || undefined}
                    onPress={() => label === 'DEL' ? handleKey('DEL') : label ? handleKey(label) : undefined}
                  />
                );
              })}
            </View>
          ))}
        </View>

        {/* Botón biometría */}
        {bioLabel ? (
          <TouchableOpacity style={styles.bioBtn} onPress={tryBiometric}>
            <Text style={styles.bioText}>Usar {bioLabel}</Text>
          </TouchableOpacity>
        ) : null}

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: BG },
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'space-evenly',
    paddingHorizontal: 24, paddingVertical: 32,
  },
  logoWrap:   { alignItems: 'center', gap: 8 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: CARD, borderWidth: 2, borderColor: AMBER,
    alignItems: 'center', justifyContent: 'center',
  },
  logoText:   { fontSize: 20, fontWeight: '700', color: AMBER, letterSpacing: 2 },
  appName:    { fontSize: 19, fontWeight: '700', color: TEXT, letterSpacing: 3 },
  subtitle:   { fontSize: 13, color: MUTED, marginTop: 2 },
  dotsRow:    { flexDirection: 'row', gap: 16 },
  dot: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 1.5, borderColor: '#333', backgroundColor: 'transparent',
  },
  errorText:  { fontSize: 12, color: RED, height: 18, textAlign: 'center' },
  keypad:     { width: '100%', maxWidth: 296, gap: 12 },
  keyRow:     { flexDirection: 'row', justifyContent: 'space-between' },
  keyBtn: {
    width: 88, height: 64,
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: '#252525',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  keyMain:    { fontSize: 24, fontWeight: '400', color: TEXT },
  keySub:     { fontSize: 9, color: MUTED, letterSpacing: 2 },
  bioBtn: {
    padding: 12, paddingHorizontal: 24,
    borderRadius: 12, backgroundColor: CARD,
    borderWidth: 1, borderColor: '#252525',
  },
  bioText: { color: MUTED, fontSize: 14 },
});
