import { useEffect, useState } from 'react';

export default function BotMenu({
  open,
  onClose,
  character,
  modelConfig,
  settings,
  defaultSettings,
  onSave,
  onReset,
  onDeleteConversation
}) {
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    if (open) {
      setLocalSettings(settings);
    }
  }, [open, settings]);

  if (!open) return null;

  const effectiveTemp = localSettings.temperature != null
    ? localSettings.temperature
    : (modelConfig?.tempDefault || 0.7);

  const updateSetting = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    if (onReset) {
      const reset = onReset();
      if (reset) setLocalSettings(reset);
      return;
    }
    setLocalSettings(defaultSettings);
  };

  const handleSave = () => {
    onSave?.(localSettings);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#12121a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="material-icons-outlined text-violet-400">smart_toy</span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white truncate">Bot Menu</h2>
              <p className="text-xs text-gray-500 truncate">{character?.name || 'Character'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
            <span className="material-icons-outlined text-gray-400">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Bot Actions</h3>
            <button
              onClick={onDeleteConversation}
              className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15 transition-colors"
            >
              <span className="material-icons-outlined text-base">delete_sweep</span>
              Delete Conversation
            </button>
          </div>

          <div className="pt-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-300">Generation Settings</h3>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Reset to defaults
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="flex items-center justify-between text-xs text-gray-400 mb-2">
                  <span>Temperature</span>
                  <span className="text-gray-300 font-mono">{Number(effectiveTemp).toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min={modelConfig?.tempMin ?? 0}
                  max={modelConfig?.tempMax ?? 2}
                  step="0.05"
                  value={effectiveTemp}
                  onChange={(e) => updateSetting('temperature', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-violet-500"
                />
                <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
              </div>

              <div>
                <label className="flex items-center justify-between text-xs text-gray-400 mb-2">
                  <span>Max New Tokens</span>
                  <span className="text-gray-300 font-mono">{localSettings.maxTokens}</span>
                </label>
                <input
                  type="range"
                  min="128"
                  max="8192"
                  step="128"
                  value={localSettings.maxTokens}
                  onChange={(e) => updateSetting('maxTokens', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-violet-500"
                />
                <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                  <span>Short</span>
                  <span>Long</span>
                </div>
              </div>

              <div>
                <label className="flex items-center justify-between text-xs text-gray-400 mb-2">
                  <span>Top P</span>
                  <span className="text-gray-300 font-mono">{localSettings.topP}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={localSettings.topP}
                  onChange={(e) => updateSetting('topP', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-violet-500"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-xs text-gray-400 mb-2">
                  <span>Top K</span>
                  <span className="text-gray-300 font-mono">{localSettings.topK}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={localSettings.topK}
                  onChange={(e) => updateSetting('topK', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-violet-500"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-xs text-gray-400 mb-2">
                  <span>Repetition Penalty</span>
                  <span className="text-gray-300 font-mono">{localSettings.repetitionPenalty}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="2"
                  step="0.01"
                  value={localSettings.repetitionPenalty}
                  onChange={(e) => updateSetting('repetitionPenalty', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-violet-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
          <p className="text-[10px] text-gray-600">Saved per character</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-sm py-2 px-4">Close</button>
            <button onClick={handleSave} className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5">
              <span className="material-icons-outlined text-sm">save</span>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
