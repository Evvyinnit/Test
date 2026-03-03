import { getFirestoreServices } from './firebaseClient';

const BASE_CHARACTER_SETTINGS = {
  model: 'cosmosrp-2.5',
  temperature: null,
  maxTokens: 4096,
  topP: 0.9,
  topK: 40,
  repetitionPenalty: 1.1,
  safetyLevel: 'balanced',
};

function normalizeCharacterSettings(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  return {
    model: typeof data.model === 'string' && data.model ? data.model : BASE_CHARACTER_SETTINGS.model,
    temperature: data.temperature === null ? null : Number(data.temperature ?? BASE_CHARACTER_SETTINGS.temperature),
    maxTokens: Number(data.maxTokens ?? BASE_CHARACTER_SETTINGS.maxTokens),
    topP: Number(data.topP ?? BASE_CHARACTER_SETTINGS.topP),
    topK: Number(data.topK ?? BASE_CHARACTER_SETTINGS.topK),
    repetitionPenalty: Number(data.repetitionPenalty ?? BASE_CHARACTER_SETTINGS.repetitionPenalty),
    safetyLevel: typeof data.safetyLevel === 'string' ? data.safetyLevel : BASE_CHARACTER_SETTINGS.safetyLevel,
  };
}

function getStorageKey(uid, characterId) {
  return `nevy_ai_char_settings_${uid}_${characterId}`;
}

export function loadCharacterSettings(uid, characterId) {
  if (!uid || !characterId) return { ...BASE_CHARACTER_SETTINGS };
  try {
    const raw = localStorage.getItem(getStorageKey(uid, characterId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return normalizeCharacterSettings(parsed);
    }
  } catch {}
  return { ...BASE_CHARACTER_SETTINGS };
}

export async function saveCharacterSettings(uid, characterId, settings) {
  if (!uid || !characterId) return;
  const normalized = normalizeCharacterSettings(settings);
  localStorage.setItem(getStorageKey(uid, characterId), JSON.stringify(normalized));

  try {
    const { db, firestoreModule } = await getFirestoreServices();
    const { doc, setDoc, serverTimestamp } = firestoreModule;
    const settingsRef = doc(db, 'users', uid, 'private_data', 'character_settings', characterId);
    await setDoc(settingsRef, {
      ...normalized,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error saving character settings:', error);
  }
  return normalized;
}

export async function syncCharacterSettings(uid, characterId) {
  if (!uid || !characterId) return { ...BASE_CHARACTER_SETTINGS };
  try {
    const { db, firestoreModule } = await getFirestoreServices();
    const { doc, getDoc } = firestoreModule;
    const settingsRef = doc(db, 'users', uid, 'private_data', 'character_settings', characterId);
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      const remote = normalizeCharacterSettings(snap.data());
      delete remote.updatedAt;
      localStorage.setItem(getStorageKey(uid, characterId), JSON.stringify(remote));
      return remote;
    }
  } catch (error) {
    console.error('Error syncing character settings:', error);
  }
  return loadCharacterSettings(uid, characterId);
}

export function getDefaultCharacterSettings() {
  return { ...BASE_CHARACTER_SETTINGS };
}
