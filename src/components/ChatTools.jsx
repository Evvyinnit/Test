import { useEffect, useState } from 'react';

const TABS = [
  { id: 'memory', label: 'Memory' },
  { id: 'controls', label: 'Controls' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'system', label: 'System' },
  { id: 'branches', label: 'Branches' },
  { id: 'export', label: 'Export' },
];

export default function ChatTools({
  open,
  onClose,
  systemPrompt,
  onSystemPromptChange,
  personaMode,
  personaOptions,
  onPersonaChange,
  summary,
  summaryUpdatedAt,
  autoSummarize,
  onToggleAutoSummarize,
  onSummarize,
  creativity,
  onCreativityChange,
  safetyLevel,
  onSafetyLevelChange,
  chatMemories,
  longMemories,
  onAddChatMemory,
  onUpdateChatMemory,
  onDeleteChatMemory,
  onPromoteChatMemory,
  onAddLongMemory,
  onUpdateLongMemory,
  onDeleteLongMemory,
  promptLibrary,
  onAddPrompt,
  onUpdatePrompt,
  onDeletePrompt,
  onInsertPrompt,
  branches,
  activeBranchId,
  onSwitchBranch,
  onCreateBranchFromLatest,
  onRenameBranch,
  onDeleteBranch,
  onExport,
}) {
  const [tab, setTab] = useState('memory');
  const [newChatMemory, setNewChatMemory] = useState('');
  const [newLongMemory, setNewLongMemory] = useState('');
  const [editingMemoryId, setEditingMemoryId] = useState(null);
  const [editingMemoryText, setEditingMemoryText] = useState('');
  const [editingLongId, setEditingLongId] = useState(null);
  const [editingLongText, setEditingLongText] = useState('');
  const [newPromptTitle, setNewPromptTitle] = useState('');
  const [newPromptContent, setNewPromptContent] = useState('');
  const [editingPromptId, setEditingPromptId] = useState(null);
  const [editingPromptTitle, setEditingPromptTitle] = useState('');
  const [editingPromptContent, setEditingPromptContent] = useState('');

  useEffect(() => {
    if (open) {
      setTab('memory');
      setEditingMemoryId(null);
      setEditingLongId(null);
      setEditingPromptId(null);
    }
  }, [open]);

  if (!open) return null;

  const startEditMemory = (item) => {
    setEditingMemoryId(item.id);
    setEditingMemoryText(item.text);
  };

  const startEditLong = (item) => {
    setEditingLongId(item.id);
    setEditingLongText(item.text);
  };

  const startEditPrompt = (item) => {
    setEditingPromptId(item.id);
    setEditingPromptTitle(item.title || '');
    setEditingPromptContent(item.content || '');
  };

  const handleAddChatMemory = () => {
    const text = newChatMemory.trim();
    if (!text) return;
    onAddChatMemory?.(text);
    setNewChatMemory('');
  };

  const handleAddLongMemory = () => {
    const text = newLongMemory.trim();
    if (!text) return;
    onAddLongMemory?.(text);
    setNewLongMemory('');
  };

  const handleAddPrompt = () => {
    const title = newPromptTitle.trim();
    const content = newPromptContent.trim();
    if (!title || !content) return;
    onAddPrompt?.({ title, content });
    setNewPromptTitle('');
    setNewPromptContent('');
  };

  const handleCreativityChange = (value) => {
    const next = Number(value);
    if (Number.isNaN(next)) return;
    onCreativityChange?.(next);
  };

  const handleSafetyLevelChange = (value) => {
    onSafetyLevelChange?.(value);
  };

  const renderMemoryTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-2">Per-Chat Memory</h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newChatMemory}
            onChange={(e) => setNewChatMemory(e.target.value)}
            placeholder="Remember this for the current chat..."
            className="flex-1 input-field text-sm"
          />
          <button onClick={handleAddChatMemory} className="btn-primary text-sm px-4">Add</button>
        </div>
        <div className="space-y-2">
          {chatMemories.length === 0 ? (
            <p className="text-xs text-gray-500">No per-chat memories yet.</p>
          ) : (
            chatMemories.map((item) => (
              <div key={item.id} className="bg-white/5 border border-white/10 rounded-xl p-3">
                {editingMemoryId === item.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingMemoryText}
                      onChange={(e) => setEditingMemoryText(e.target.value)}
                      rows={2}
                      className="w-full input-field text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { onUpdateChatMemory?.(item.id, editingMemoryText.trim()); setEditingMemoryId(null); }}
                        className="btn-primary text-xs px-3"
                      >
                        Save
                      </button>
                      <button onClick={() => setEditingMemoryId(null)} className="btn-secondary text-xs px-3">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-200 whitespace-pre-wrap">{item.text}</p>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => startEditMemory(item)} className="text-xs text-gray-400 hover:text-gray-200">Edit</button>
                      <button onClick={() => onDeleteChatMemory?.(item.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                      <button onClick={() => onPromoteChatMemory?.(item)} className="text-xs text-blue-400 hover:text-blue-300">Promote to long-term</button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-2">Long-Term Memory</h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newLongMemory}
            onChange={(e) => setNewLongMemory(e.target.value)}
            placeholder="Remember across all chats..."
            className="flex-1 input-field text-sm"
          />
          <button onClick={handleAddLongMemory} className="btn-primary text-sm px-4">Add</button>
        </div>
        <div className="space-y-2">
          {longMemories.length === 0 ? (
            <p className="text-xs text-gray-500">No long-term memories yet.</p>
          ) : (
            longMemories.map((item) => (
              <div key={item.id} className="bg-white/5 border border-white/10 rounded-xl p-3">
                {editingLongId === item.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingLongText}
                      onChange={(e) => setEditingLongText(e.target.value)}
                      rows={2}
                      className="w-full input-field text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { onUpdateLongMemory?.(item.id, editingLongText.trim()); setEditingLongId(null); }}
                        className="btn-primary text-xs px-3"
                      >
                        Save
                      </button>
                      <button onClick={() => setEditingLongId(null)} className="btn-secondary text-xs px-3">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-200 whitespace-pre-wrap">{item.text}</p>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => startEditLong(item)} className="text-xs text-gray-400 hover:text-gray-200">Edit</button>
                      <button onClick={() => onDeleteLongMemory?.(item.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderPromptsTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-2">Add Prompt</h3>
        <div className="space-y-2">
          <input
            type="text"
            value={newPromptTitle}
            onChange={(e) => setNewPromptTitle(e.target.value)}
            placeholder="Prompt name"
            className="input-field text-sm"
          />
          <textarea
            value={newPromptContent}
            onChange={(e) => setNewPromptContent(e.target.value)}
            placeholder="Prompt content..."
            rows={3}
            className="input-field text-sm"
          />
          <button onClick={handleAddPrompt} className="btn-primary text-sm px-4">Save Prompt</button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-2">Saved Prompts</h3>
        <div className="space-y-2">
          {promptLibrary.length === 0 ? (
            <p className="text-xs text-gray-500">No saved prompts yet.</p>
          ) : (
            promptLibrary.map((item) => (
              <div key={item.id} className="bg-white/5 border border-white/10 rounded-xl p-3">
                {editingPromptId === item.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editingPromptTitle}
                      onChange={(e) => setEditingPromptTitle(e.target.value)}
                      className="input-field text-sm"
                    />
                    <textarea
                      value={editingPromptContent}
                      onChange={(e) => setEditingPromptContent(e.target.value)}
                      rows={3}
                      className="input-field text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { onUpdatePrompt?.(item.id, editingPromptTitle.trim(), editingPromptContent.trim()); setEditingPromptId(null); }}
                        className="btn-primary text-xs px-3"
                      >
                        Save
                      </button>
                      <button onClick={() => setEditingPromptId(null)} className="btn-secondary text-xs px-3">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-200 font-medium">{item.title}</p>
                    <p className="text-xs text-gray-400 whitespace-pre-wrap mt-1">{item.content}</p>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => onInsertPrompt?.(item)} className="text-xs text-blue-400 hover:text-blue-300">Insert</button>
                      <button onClick={() => startEditPrompt(item)} className="text-xs text-gray-400 hover:text-gray-200">Edit</button>
                      <button onClick={() => onDeletePrompt?.(item.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderControlsTab = () => (
    <div className="space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium text-gray-200">Creativity</h3>
            <p className="text-xs text-gray-500">Higher values make replies more varied and imaginative.</p>
          </div>
          <span className="text-xs text-gray-400">{creativity?.toFixed?.(2) ?? 'Default'}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1.5"
          step="0.05"
          value={creativity ?? 0.7}
          onChange={(e) => handleCreativityChange(e.target.value)}
          className="w-full"
          style={{ '--range-progress': `${((creativity ?? 0.7) / 1.5) * 100}%` }}
        />
        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
          <span>Safe</span>
          <span>Balanced</span>
          <span>Bold</span>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium text-gray-200">Safety Filter</h3>
            <p className="text-xs text-gray-500">Control how strictly responses avoid sensitive content.</p>
          </div>
          <span className="text-xs text-gray-400 capitalize">{safetyLevel || 'balanced'}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['relaxed', 'balanced', 'strict'].map(level => (
            <button
              key={level}
              onClick={() => handleSafetyLevelChange(level)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                safetyLevel === level
                  ? 'border-violet-500/60 bg-violet-500/15 text-violet-300'
                  : 'border-white/10 bg-white/5 text-gray-400 hover:text-gray-200 hover:border-white/20'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-500 mt-2">
          Safety applies as guidance to the system prompt and may vary by model.
        </p>
      </div>
    </div>
  );

  const renderSystemTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-2">Per-Chat System Prompt</h3>
        <textarea
          value={systemPrompt}
          onChange={(e) => onSystemPromptChange?.(e.target.value)}
          rows={4}
          placeholder="Add rules or personality for this session..."
          className="input-field text-sm"
        />
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-2">Personality / Mode</h3>
        <select
          value={personaMode}
          onChange={(e) => onPersonaChange?.(e.target.value)}
          className="input-field text-sm"
        >
          {personaOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
        {personaOptions.find(opt => opt.id === personaMode)?.description && (
          <p className="text-xs text-gray-500 mt-1">
            {personaOptions.find(opt => opt.id === personaMode).description}
          </p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-2">Conversation Summary</h3>
        {summary ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-gray-300 whitespace-pre-wrap">
            {summary}
          </div>
        ) : (
          <p className="text-xs text-gray-500">No summary yet.</p>
        )}
        <div className="flex items-center gap-3 mt-2">
          <button onClick={onSummarize} className="btn-primary text-xs px-3">Summarize Now</button>
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={autoSummarize}
              onChange={(e) => onToggleAutoSummarize?.(e.target.checked)}
              className="accent-violet-500"
            />
            Auto summarize long chats
          </label>
        </div>
        {summaryUpdatedAt && (
          <p className="text-[10px] text-gray-500 mt-2">Last updated: {summaryUpdatedAt}</p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-2">Commands</h3>
        <p className="text-xs text-gray-500">/summarize, /reset, /persona &lt;name&gt;, /system &lt;text&gt;, /remember &lt;text&gt;, /export &lt;txt|md|json&gt;</p>
      </div>
    </div>
  );

  const renderBranchesTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">Branches</h3>
        <button onClick={onCreateBranchFromLatest} className="btn-primary text-xs px-3">New Branch</button>
      </div>
      <div className="space-y-2">
        {branches.length === 0 ? (
          <p className="text-xs text-gray-500">No branches yet. Create one to explore alternatives.</p>
        ) : (
          branches.map((branch) => (
            <div key={branch.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-3">
              <div>
                <p className="text-sm text-gray-200">{branch.name}</p>
                <p className="text-[10px] text-gray-500">{branch.messageCount || 0} messages</p>
              </div>
              <div className="flex gap-2">
                {activeBranchId !== branch.id && (
                  <button onClick={() => onSwitchBranch?.(branch.id)} className="text-xs text-blue-400 hover:text-blue-300">Switch</button>
                )}
                {branch.id !== 'main' && (
                  <>
                    <button onClick={() => onRenameBranch?.(branch)} className="text-xs text-gray-400 hover:text-gray-200">Rename</button>
                    <button onClick={() => onDeleteBranch?.(branch.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderExportTab = () => (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-300">Export Chat</h3>
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => onExport?.('txt')} className="btn-secondary text-sm px-4">TXT</button>
        <button onClick={() => onExport?.('md')} className="btn-secondary text-sm px-4">Markdown</button>
        <button onClick={() => onExport?.('json')} className="btn-secondary text-sm px-4">JSON</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#12121a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <span className="material-icons-outlined text-violet-400">auto_awesome</span>
            <h2 className="text-lg font-semibold text-white">Chat Tools</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
            <span className="material-icons-outlined text-gray-400">close</span>
          </button>
        </div>

        <div className="flex gap-2 px-6 py-3 border-b border-white/5 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                tab === t.id
                  ? 'bg-violet-500/20 text-violet-200'
                  : 'bg-white/5 text-gray-400 hover:text-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'memory' && renderMemoryTab()}
          {tab === 'controls' && renderControlsTab()}
          {tab === 'prompts' && renderPromptsTab()}
          {tab === 'system' && renderSystemTab()}
          {tab === 'branches' && renderBranchesTab()}
          {tab === 'export' && renderExportTab()}
        </div>

        <div className="px-6 py-4 border-t border-white/5 flex justify-end">
          <button onClick={onClose} className="btn-secondary text-sm px-4">Close</button>
        </div>
      </div>
    </div>
  );
}
