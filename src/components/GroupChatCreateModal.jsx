import { useEffect, useMemo, useState } from 'react';
import { getFirestoreServices } from '../utils/firebaseClient';
import { useAuth } from '../contexts/AuthContext';

export default function GroupChatCreateModal({ open, onClose, seedCharacterId, onCreated }) {
  const { user } = useAuth();
  const userId = user?.uid;
  const [loading, setLoading] = useState(false);
  const [bots, setBots] = useState([]);
  const [queryText, setQueryText] = useState('');
  const [selected, setSelected] = useState(() => new Set(seedCharacterId ? [seedCharacterId] : []));

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(seedCharacterId ? [seedCharacterId] : []));
    setQueryText('');
  }, [open, seedCharacterId]);

  useEffect(() => {
    if (!open) return;
    let alive = true;

    (async () => {
      try {
        const { db, firestoreModule } = await getFirestoreServices();
        const { collection, query, orderBy, limit, getDocs } = firestoreModule;

        // Load a reasonable slice for selection. (Avoid loading everything.)
        const q = query(collection(db, 'characters'), orderBy('createdAt', 'desc'), limit(80));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (alive) setBots(list);
      } catch (e) {
        console.error('Failed to load bots for group creation', e);
      }
    })();

    return () => { alive = false; };
  }, [open]);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return bots;
    return bots.filter(b => (b.name || '').toLowerCase().includes(q));
  }, [bots, queryText]);

  if (!open) return null;

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!userId) return;
    const botIds = Array.from(selected);
    if (botIds.length < 2) {
      alert('Select at least 2 bots for a group chat.');
      return;
    }
    setLoading(true);
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { collection, addDoc, serverTimestamp } = firestoreModule;

      const docRef = await addDoc(collection(db, 'group_chats'), {
        ownerId: userId,
        botIds,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        title: 'Group Chat',
      });

      onCreated?.(docRef.id);
      onClose?.();
    } catch (e) {
      console.error('Failed to create group chat', e);
      alert('Failed to create group chat.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 bg-[#0f0f17] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="text-white font-semibold">Create Group Chat</div>
            <div className="text-xs text-gray-500 mt-0.5">Pick multiple bots. Each bot keeps its own model settings.</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5">
            <span className="material-icons-outlined text-gray-300">close</span>
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2">
            <span className="material-icons-outlined text-gray-400">search</span>
            <input
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Search bots..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/40"
            />
            <div className="text-xs text-gray-500">{selected.size} selected</div>
          </div>

          <div className="mt-4 max-h-[55vh] overflow-y-auto overscroll-contain pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filtered.map(bot => (
                <button
                  key={bot.id}
                  onClick={() => toggle(bot.id)}
                  className={`p-3 rounded-2xl border transition-colors text-left ${
                    selected.has(bot.id) ? 'border-violet-500 bg-violet-500/10' : 'border-white/10 bg-white/5 hover:bg-white/7'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={bot.avatarUrl || bot.imageUrl || '/default-avatar.png'}
                      alt={bot.name}
                      className="w-10 h-10 rounded-xl object-cover border border-white/10"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{bot.name || 'Unnamed Bot'}</div>
                      <div className="text-xs text-gray-500 truncate">{bot.creatorName || 'Bot'}</div>
                    </div>
                    <span className={`ml-auto material-icons-outlined ${selected.has(bot.id) ? 'text-violet-300' : 'text-gray-600'}`}>
                      {selected.has(bot.id) ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white">
              Cancel
            </button>
            <button
              disabled={loading}
              onClick={handleCreate}
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-sm font-semibold text-white"
            >
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
