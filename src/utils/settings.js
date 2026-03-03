import { getFirestoreServices } from './firebaseClient';

export const MODEL_OPTIONS = [
  {
    id: 'cosmosrp-2.5',
    name: 'CosmosRP v2.5',
    provider: 'pawan',
    badge: 'New',
    description: 'Excellent quality, optimized for roleplay. Vision capable.',
    requiresKey: false,
    tempMin: 0.6,
    tempMax: 1.0,
    tempDefault: 0.7,
    endpoint: 'https://api.pawan.krd/cosmosrp-2.5/v1/chat/completions',
  },
  {
    id: 'cosmosrp-2.1',
    name: 'CosmosRP v2.1',
    provider: 'pawan',
    badge: 'Popular',
    description: 'Great roleplay model with large context.',
    requiresKey: false,
    tempMin: 0.6,
    tempMax: 1.5,
    tempDefault: 1.2,
    endpoint: 'https://api.pawan.krd/cosmosrp-2.1/v1/chat/completions',
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini (Latest)',
    provider: 'gemini',
    badge: 'Latest',
    description: 'Google Gemini latest flash model',
    requiresKey: true,
    tempMin: 0,
    tempMax: 2.0,
    tempDefault: 0.9,
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B (Groq)',
    provider: 'groq',
    badge: 'Smart',
    description: 'High intelligence, large context.',
    requiresKey: true,
    tempMin: 0,
    tempMax: 2.0,
    tempDefault: 0.7,
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B (Groq)',
    provider: 'groq',
    badge: 'Fast',
    description: 'Extremely fast, good for general chat.',
    requiresKey: true,
    tempMin: 0,
    tempMax: 2.0,
    tempDefault: 0.7,
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  },
  {
    id: 'gemma2-9b-it',
    name: 'Gemma 2 9B (Groq)',
    provider: 'groq',
    badge: 'Balanced',
    description: 'Good balance of speed and quality.',
    requiresKey: true,
    tempMin: 0,
    tempMax: 2.0,
    tempDefault: 0.7,
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  },
  {
    id: 'mistral-tiny',
    name: 'Mistral Tiny',
    provider: 'mistral',
    badge: 'Efficient',
    description: 'Cost-effective, good performance.',
    requiresKey: true,
    tempMin: 0,
    tempMax: 2.0,
    tempDefault: 0.7,
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
  },
  {
    id: 'mistral-small-latest',
    name: 'Mistral Small',
    provider: 'mistral',
    badge: 'Balanced',
    description: 'Better reasoning than Tiny.',
    requiresKey: true,
    tempMin: 0,
    tempMax: 2.0,
    tempDefault: 0.7,
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
  },
];

const BASE_SETTINGS = {
  model: 'cosmosrp-2.5',
  geminiApiKey: '',
  pawanApiKey: '',
  groqApiKey: '',
  mistralApiKey: '',
  pricingOverrides: {},
};

function normalizeSettings(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  return {
    ...BASE_SETTINGS,
    model: data.model || BASE_SETTINGS.model,
    geminiApiKey: data.geminiApiKey || '',
    pawanApiKey: data.pawanApiKey || '',
    groqApiKey: data.groqApiKey || '',
    mistralApiKey: data.mistralApiKey || '',
    pricingOverrides: data.pricingOverrides && typeof data.pricingOverrides === 'object'
      ? data.pricingOverrides
      : {},
  };
}

export async function fetchGroqModels(apiKey) {
  if (!apiKey) return [];
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn('Failed to fetch Groq models', response.status);
      return [];
    }

    const data = await response.json();
    if (!data || !data.data || !Array.isArray(data.data)) return [];

    const models = data.data
      .filter(m => !m.id.includes('whisper')) // Exclude audio models
      .map(m => ({
        id: m.id,
        name: m.id, // Using ID as name to be safe
        provider: 'groq',
        badge: 'Groq',
        description: `Context: ${m.context_window || 'Unknown'}`,
        requiresKey: true,
        tempMin: 0,
        tempMax: 2.0,
        tempDefault: 0.7,
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      }));

    localStorage.setItem('nevy_ai_cached_groq_models', JSON.stringify(models));
    return models;
  } catch (error) {
    console.error('Error fetching Groq models:', error);
    return [];
  }
}

function getCachedModels() {
  try {
    const cached = localStorage.getItem('nevy_ai_cached_groq_models');
    if (cached) return JSON.parse(cached);
  } catch (e) {
    console.error('Error reading cached models', e);
  }
  return [];
}

export function getAllModels() {
  const cached = getCachedModels();
  const defaultNonGroq = MODEL_OPTIONS.filter(m => m.provider !== 'groq');
  const defaultGroq = MODEL_OPTIONS.filter(m => m.provider === 'groq');

  let effectiveGroq = defaultGroq;
  if (cached && cached.length > 0) {
    effectiveGroq = cached;
  }

  return [...defaultNonGroq, ...effectiveGroq];
}

export function getModelConfig(modelId) {
  const all = getAllModels();
  return all.find(m => m.id === modelId) || all[0];
}

function getStorageKey(uid) {
  return `nevy_ai_settings_${uid}`;
}

function getDirtyKey(uid) {
  return `nevy_ai_settings_${uid}_dirty`;
}

export function loadSettings(uid) {
  if (!uid) {
    return { ...BASE_SETTINGS };
  }

  try {
    const raw = localStorage.getItem(getStorageKey(uid));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return normalizeSettings(parsed);
    }
  } catch {}

  return { ...BASE_SETTINGS };
}

export async function saveSettings(uid, settings) {
  if (!uid) return;

  const normalized = normalizeSettings(settings);

  // Save to LocalStorage
  localStorage.setItem(getStorageKey(uid), JSON.stringify(normalized));

  // Save to Firestore
  try {
    const { db, firestoreModule } = await getFirestoreServices();
    const { doc, setDoc, serverTimestamp } = firestoreModule;
    const userSettingsRef = doc(db, 'users', uid, 'private_data', 'settings');
    await setDoc(userSettingsRef, {
      ...normalized,
      updatedAt: serverTimestamp()
    }, { merge: true });
    // Success -> Clear dirty flag
    localStorage.removeItem(getDirtyKey(uid));
  } catch (error) {
    console.error("Error saving settings to Firestore:", error);
    // Failure -> Set dirty flag
    localStorage.setItem(getDirtyKey(uid), 'true');
  }
}

/**
 * Synchronize settings from Firestore to LocalStorage on login/load.
 * If Firestore has data, it overwrites LocalStorage.
 * If Firestore is empty but LocalStorage has data, it syncs LocalStorage to Firestore.
 */
export async function syncSettings(uid) {
  if (!uid) return;

  try {
    const isDirty = localStorage.getItem(getDirtyKey(uid));
    const { db, firestoreModule } = await getFirestoreServices();
    const { doc, setDoc, getDoc, serverTimestamp } = firestoreModule;
    const userSettingsRef = doc(db, 'users', uid, 'private_data', 'settings');

    if (isDirty) {
      // Local has unsaved changes -> Push to Remote
      const local = loadSettings(uid);
      await setDoc(userSettingsRef, {
        ...normalizeSettings(local),
        updatedAt: serverTimestamp()
      }, { merge: true });
      localStorage.removeItem(getDirtyKey(uid));
      return local;
    }

    const snap = await getDoc(userSettingsRef);

    if (snap.exists()) {
      // Firestore has data -> Update LocalStorage
      const remoteSettings = snap.data();
      // Merge with default structure to ensure all fields exist
      const currentLocal = loadSettings(uid); // This handles defaults
      const merged = normalizeSettings({ ...currentLocal, ...remoteSettings });
      
      // Remove server timestamps or internal fields before saving to LS
      delete merged.updatedAt;

      localStorage.setItem(getStorageKey(uid), JSON.stringify(merged));
      return merged;
    } else {
      // Firestore empty -> Check LocalStorage
      const localRaw = localStorage.getItem(getStorageKey(uid));
      if (localRaw) {
        // We have local data but no remote -> Sync to Firestore
        const settings = JSON.parse(localRaw);
        await setDoc(userSettingsRef, {
          ...settings,
          updatedAt: serverTimestamp()
        });
      }
    }
  } catch (error) {
    console.error("Error syncing settings:", error);
  }
  return loadSettings(uid);
}
