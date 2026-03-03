import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { loadSettings, saveSettings, getAllModels, fetchGroqModels } from '../utils/settings';
import { saveCharacterSettings } from '../utils/characterSettings';
import { debounce } from '../utils/debounce';

// Re-export for other components if they import from here (though they should update imports)
// To maintain backward compatibility while I update other files:
export { loadSettings, getModelConfig } from '../utils/settings';

export default function ModelSettings({ open, onClose, characterId, characterSettings, onCharacterSettingsChange }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(() => loadSettings(user?.uid));
  const [selectedModel, setSelectedModel] = useState(() => characterSettings?.model || settings.model);
  const characterMode = Boolean(characterId);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showPawanKey, setShowPawanKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showMistralKey, setShowMistralKey] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // Dynamic model list
  const [availableModels, setAvailableModels] = useState(() => getAllModels());

  const debouncedSave = useMemo(
    () => debounce((uid, next) => saveSettings(uid, next), 700),
    []
  );

  useEffect(() => {
    if (open && user) {
      const loaded = loadSettings(user.uid);
      setSettings(loaded);
      setSelectedModel(characterMode ? (characterSettings?.model || loaded.model) : loaded.model);
      setSaved(false);
      // Refresh available models from cache/defaults on open
      setAvailableModels(getAllModels());
    }
  }, [open, user]);

  useEffect(() => {
    if (!open || !user) return;
    debouncedSave(user.uid, characterMode ? ({ ...settings, model: loadSettings(user.uid).model }) : settings);
    return () => debouncedSave.cancel?.();
  }, [debouncedSave, open, settings, user]);
  
  // Fetch Groq models if key is present
  useEffect(() => {
    if (settings.groqApiKey && open) {
       // Debounce or just check if we already have many groq models?
       // For now, simple fetch.
       fetchGroqModels(settings.groqApiKey).then(models => {
         if (models && models.length > 0) {
           setAvailableModels(prev => {
             const nonGroq = prev.filter(m => m.provider !== 'groq');
             return [...nonGroq, ...models];
           });
         }
       });
    }
  }, [settings.groqApiKey, open]);

  if (!open) return null;

  const handleSave = async () => {
    if (!user) return;
    await saveSettings(user.uid, settings);
    setSaved(true);
    setTimeout(() => onClose(), 600);
  };

  const handleModelChange = async (modelId) => {
    setSelectedModel(modelId);
    if (!user) return;
    if (characterMode && characterId) {
      const next = { ...(characterSettings || {}), model: modelId };
      onCharacterSettingsChange?.(next);
      await saveCharacterSettings(user.uid, characterId, next);
      return;
    }
    setSettings(prev => ({ ...prev, model: modelId }));
  };

  const currentPricing = settings.pricingOverrides?.[selectedModel] || { input: '', output: '' };
  const updatePricing = (field, value) => {
    setSettings(prev => ({
      ...prev,
      pricingOverrides: {
        ...(prev.pricingOverrides || {}),
        [prev.model]: {
          ...(prev.pricingOverrides?.[prev.model] || {}),
          [field]: value === '' ? '' : Number(value)
        }
      }
    }));
  };

  const pawanModels = availableModels.filter(m => m.provider === 'pawan');
  const geminiModels = availableModels.filter(m => m.provider === 'gemini');
  const groqModels = availableModels.filter(m => m.provider === 'groq');
  const mistralModels = availableModels.filter(m => m.provider === 'mistral');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#12121a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <span className="material-icons-outlined text-violet-400">tune</span>
            <h2 className="text-lg font-semibold text-white">Model Settings</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
            <span className="material-icons-outlined text-gray-400">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* CosmosRP (Pawan) Models */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-medium text-gray-300">CosmosRP (Pawan)</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 font-medium">Free / Key Optional</span>
            </div>
            <div className="space-y-2">
              {pawanModels.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleModelChange(m.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                    selectedModel === m.id
                      ? 'border-violet-500/50 bg-violet-500/10'
                      : 'border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedModel === m.id ? 'border-violet-400' : 'border-gray-600'
                  }`}>
                    {selectedModel === m.id && <div className="w-2 h-2 rounded-full bg-violet-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200">{m.name}</span>
                      {m.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-medium">{m.badge}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Pawan API Key */}
            <div className="mt-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
                <span className="material-icons-outlined text-sm">vpn_key</span>
                Pawan API Key
                <span className="text-gray-500 italic">(optional - for higher limits)</span>
              </label>
              <div className="relative">
                <input
                  type={showPawanKey ? 'text' : 'password'}
                  value={settings.pawanApiKey || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, pawanApiKey: e.target.value }))}
                  placeholder="pk-..."
                  className="input-field text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPawanKey(!showPawanKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/5 rounded"
                >
                  <span className="material-icons-outlined text-gray-500 text-lg">
                    {showPawanKey ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-white/5" />
            <span className="text-xs text-gray-600">or</span>
            <div className="flex-1 border-t border-white/5" />
          </div>

          {/* Gemini Models */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-medium text-gray-300">Google Gemini</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium">API Key Required</span>
            </div>
            <div className="space-y-2">
              {geminiModels.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleModelChange(m.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                    selectedModel === m.id
                      ? 'border-violet-500/50 bg-violet-500/10'
                      : 'border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedModel === m.id ? 'border-violet-400' : 'border-gray-600'
                  }`}>
                    {selectedModel === m.id && <div className="w-2 h-2 rounded-full bg-violet-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200">{m.name}</span>
                      {m.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium">{m.badge}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Gemini API Key */}
            <div className="mt-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
                <span className="material-icons-outlined text-sm">vpn_key</span>
                Gemini API Key
                <span className="text-red-400/70">*required</span>
              </label>
              <div className="relative">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={settings.geminiApiKey}
                  onChange={(e) => setSettings(prev => ({ ...prev, geminiApiKey: e.target.value }))}
                  placeholder="AIza..."
                  className="input-field text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/5 rounded"
                >
                  <span className="material-icons-outlined text-gray-500 text-lg">
                    {showGeminiKey ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-white/5" />
            <span className="text-xs text-gray-600">or</span>
            <div className="flex-1 border-t border-white/5" />
          </div>

          {/* Groq Models */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-medium text-gray-300">Groq AI</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 font-medium">Free Tier / Fast</span>
            </div>
            <div className="space-y-2">
              {groqModels.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleModelChange(m.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                    selectedModel === m.id
                      ? 'border-violet-500/50 bg-violet-500/10'
                      : 'border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedModel === m.id ? 'border-violet-400' : 'border-gray-600'
                  }`}>
                    {selectedModel === m.id && <div className="w-2 h-2 rounded-full bg-violet-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200">{m.name}</span>
                      {m.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-medium">{m.badge}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Groq API Key */}
            <div className="mt-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
                <span className="material-icons-outlined text-sm">vpn_key</span>
                Groq API Key
                <span className="text-red-400/70">*required</span>
              </label>
              <div className="relative">
                <input
                  type={showGroqKey ? 'text' : 'password'}
                  value={settings.groqApiKey || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, groqApiKey: e.target.value }))}
                  placeholder="gsk_..."
                  className="input-field text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowGroqKey(!showGroqKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/5 rounded"
                >
                  <span className="material-icons-outlined text-gray-500 text-lg">
                    {showGroqKey ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-white/5" />
            <span className="text-xs text-gray-600">or</span>
            <div className="flex-1 border-t border-white/5" />
          </div>

          {/* Mistral Models */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-medium text-gray-300">Mistral AI</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 font-medium">Balanced / Efficient</span>
            </div>
            <div className="space-y-2">
              {mistralModels.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleModelChange(m.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                    selectedModel === m.id
                      ? 'border-violet-500/50 bg-violet-500/10'
                      : 'border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedModel === m.id ? 'border-violet-400' : 'border-gray-600'
                  }`}>
                    {selectedModel === m.id && <div className="w-2 h-2 rounded-full bg-violet-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200">{m.name}</span>
                      {m.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium">{m.badge}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Mistral API Key */}
            <div className="mt-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
                <span className="material-icons-outlined text-sm">vpn_key</span>
                Mistral API Key
                <span className="text-red-400/70">*required</span>
              </label>
              <div className="relative">
                <input
                  type={showMistralKey ? 'text' : 'password'}
                  value={settings.mistralApiKey || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, mistralApiKey: e.target.value }))}
                  placeholder="Key..."
                  className="input-field text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowMistralKey(!showMistralKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/5 rounded"
                >
                  <span className="material-icons-outlined text-gray-500 text-lg">
                    {showMistralKey ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Usage & Cost */}
          <div className="pt-2">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Usage & Cost (optional)</h3>
            <p className="text-[11px] text-gray-500 mb-3">
              Set per-1K token costs to show estimated spend in chats. Leave blank to show "N/A".
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Input $ / 1K</label>
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={currentPricing.input}
                  onChange={(e) => updatePricing('input', e.target.value)}
                  placeholder="e.g. 0.0005"
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Output $ / 1K</label>
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={currentPricing.output}
                  onChange={(e) => updatePricing('output', e.target.value)}
                  placeholder="e.g. 0.0015"
                  className="input-field text-sm"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
          <p className="text-[10px] text-gray-600">Settings saved to your account</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-sm py-2 px-4">Cancel</button>
            <button onClick={handleSave} className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5">
              {saved ? (
                <>
                  <span className="material-icons-outlined text-sm">check</span>
                  Saved
                </>
              ) : (
                <>
                  <span className="material-icons-outlined text-sm">save</span>
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
