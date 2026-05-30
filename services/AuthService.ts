import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const PIN_HASH_KEY  = 'moto_pin_hash';
const ATTEMPTS_KEY  = 'moto_attempts';
const LOCKOUT_KEY   = 'moto_lock_until';

const PIN_LENGTH    = 6;
const MAX_ATTEMPTS  = 5;
const LOCKOUT_MS    = 5 * 60 * 1000; // 5 minutos

function hashPin(pin: string): string {
  // Hash djb2 — suficiente para PIN local
  let h = 5381;
  for (let i = 0; i < pin.length; i++) {
    h = ((h << 5) + h) ^ pin.charCodeAt(i);
    h = h >>> 0; // unsigned 32-bit
  }
  return h.toString(16);
}

export class AuthService {

  static async isBiometricAvailable(): Promise<boolean> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    return LocalAuthentication.isEnrolledAsync();
  }

  static async getBiometricLabel(): Promise<string> {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT))        return 'Huella digital';
    return 'Biometría';
  }

  static async authenticateBiometric(): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:         'Identificate para controlar la moto',
        cancelLabel:           'Usar PIN',
        disableDeviceFallback: false,
      });
      return result.success;
    } catch {
      return false;
    }
  }

  static async hasPin(): Promise<boolean> {
    const stored = await SecureStore.getItemAsync(PIN_HASH_KEY);
    return stored !== null;
  }

  static async setPin(pin: string): Promise<void> {
    if (pin.length !== PIN_LENGTH) throw new Error(`El PIN debe tener ${PIN_LENGTH} dígitos`);
    await SecureStore.setItemAsync(PIN_HASH_KEY, hashPin(pin));
    await SecureStore.setItemAsync(ATTEMPTS_KEY, '0');
  }

  static async verifyPin(pin: string): Promise<{ success: boolean; message: string }> {
    // Chequear bloqueo temporal
    const lockUntilStr = await SecureStore.getItemAsync(LOCKOUT_KEY);
    if (lockUntilStr) {
      const lockUntil = parseInt(lockUntilStr, 10);
      if (Date.now() < lockUntil) {
        const mins = Math.ceil((lockUntil - Date.now()) / 60_000);
        return { success: false, message: `Bloqueado por ${mins} min` };
      }
      await SecureStore.deleteItemAsync(LOCKOUT_KEY);
      await SecureStore.setItemAsync(ATTEMPTS_KEY, '0');
    }

    const stored = await SecureStore.getItemAsync(PIN_HASH_KEY);
    if (!stored) return { success: false, message: 'PIN no configurado' };

    if (hashPin(pin) !== stored) {
      const attemptsStr = await SecureStore.getItemAsync(ATTEMPTS_KEY) ?? '0';
      const attempts    = parseInt(attemptsStr, 10) + 1;
      await SecureStore.setItemAsync(ATTEMPTS_KEY, String(attempts));

      if (attempts >= MAX_ATTEMPTS) {
        await SecureStore.setItemAsync(LOCKOUT_KEY, String(Date.now() + LOCKOUT_MS));
        await SecureStore.setItemAsync(ATTEMPTS_KEY, '0');
        return { success: false, message: 'Demasiados intentos. Bloqueado 5 min' };
      }
      return { success: false, message: `PIN incorrecto (${MAX_ATTEMPTS - attempts} restantes)` };
    }

    await SecureStore.setItemAsync(ATTEMPTS_KEY, '0');
    return { success: true, message: 'OK' };
  }
}
