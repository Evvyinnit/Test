import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../contexts/AuthContext';
import { getFirestoreServices } from '../utils/firebaseClient';
import { loadSettings } from '../utils/settings';
import { loadCharacterSettings, syncCharacterSettings } from '../utils/characterSettings';
import { requestCompletion } from '../utils/llmCompletion';
import BurgerSettingsMenu from '../components/BurgerSettingsMenu';
import ModelSettings from '../components/ModelSettings';

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function GroupChat() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.uid;

  const [group, setGroup] = useState(null);
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [authorNote, setAuthorNote] = useState('');
  const [showAuthorNote, setShowAuthorNote] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showPinned, setShowPinned] = useState(true);
  const \[sending, setSending\] = useState\(false\);

  const [botEditingId, setBotEditingId] = useState(null);
  const [botEditValue, setBotEditValue] = useState('');


  const [burgerOpen, setBurgerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [activeBotForSettings, setActiveBotForSettings] = useState(null);
  const [activeBotSettings, setActiveBotSettings] = useState(null);

  const listRef = useRef(null);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };


  const lastBotMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m && m.role === 'bot' && !m.pending) return m;
    }
    return null;
  }, [messages]);

  const startEditLastBot = () => {
    if (!lastBotMessage) return;
    setBotEditingId(lastBotMessage.id);
    setBotEditValue(lastBotMessage.content || '');
  };

  const cancelEditBot = () => {
    setBotEditingId(null);
    setBotEditValue('');
  };

  const saveEditBot = async () => {
    if (!botEditingId) return;
    const nextText = botEditValue.trim();
    setMessages(prev => prev.map(m => m.id === botEditingId ? ({ ...m, content: nextText || m.content, edited: true }) : m));
    try {
      await updateMessageDoc(botEditingId, { content: nextText, edited: true });
    } catch (e) {
      console.error(e);
    }
    cancelEditBot();
  };

  const regenerateLastBot = async () => {
    if (!lastBotMessage || sending) return;
    const botId = lastBotMessage.botId;
    if (!botId) return;
    const bot = botById.get(botId);
    if (!bot) return;
    const idx = messages.findIndex(m => m.id === lastBotMessage.id);
    const context = idx >= 0 ? messages.slice(0, idx) : messages;
    setSending(true);
    try {
      const botSettings = loadCharacterSettings(userId, bot.id);
      const apiMessages = buildApiMessagesForBot(bot, context);
      const { content } = await requestCompletion({ apiMessages, settings, characterSettings: botSettings, stream: false });
      const finalText = content || '(no response)';
      setMessages(prev => prev.map(m => m.id === lastBotMessage.id ? ({ ...m, content: finalText, pending: false }) : m));
      await updateMessageDoc(lastBotMessage.id, { content: finalText });
      setTimeout(scrollToBottom, 50);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { id: makeId(), role: 'system', content: `Error: ${e.message || 'Failed to regenerate.'}` }]);
    } finally {
      setSending(false);
    }
  };



  const lastBotMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m && m.role === 'bot' && !m.pending) return m;
    }
    return null;
  }, [messages]);

  const startEditLastBot = () => {
    if (!lastBotMessage) return;
    setBotEditingId(lastBotMessage.id);
    setBotEditValue(lastBotMessage.content || '');
  };

  const cancelEditBot = () => {
    setBotEditingId(null);
    setBotEditValue('');
  };

  const saveEditBot = async () => {
    if (!botEditingId) return;
    const nextText = botEditValue.trim();
    setMessages(prev => prev.map(m => m.id === botEditingId ? ({ ...m, content: nextText || m.content, edited: true }) : m));
    try {
      await updateMessageDoc(botEditingId, { content: nextText, edited: true });
    } catch (e) {
      console.error(e);
    }
    cancelEditBot();
  };

  const regenerateLastBot = async () => {
    if (!lastBotMessage || sending) return;
    const botId = lastBotMessage.botId;
    if (!botId) return;
    const bot = botById.get(botId);
    if (!bot) return;
    const idx = messages.findIndex(m => m.id === lastBotMessage.id);
    const context = idx >= 0 ? messages.slice(0, idx) : messages;
    setSending(true);
    try {
      const botSettings = loadCharacterSettings(userId, bot.id);
      const apiMessages = buildApiMessagesForBot(bot, context);
      const { content } = await requestCompletion({ apiMessages, settings, characterSettings: botSettings, stream: false });
      const finalText = content || '(no response)';
      setMessages(prev => prev.map(m => m.id === lastBotMessage.id ? ({ ...m, content: finalText, pending: false }) : m));
      await updateMessageDoc(lastBotMessage.id, { content: finalText });
      setTimeout(scrollToBottom, 50);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { id: makeId(), role: 'system', content: `Error: ${e.message || 'Failed to regenerate.'}` }]);
    } finally {
      setSending(false);
    }
  };


  const getFirestore = async () => {
    const { db, firestoreModule } = await getFirestoreServices();
    return { db, ...firestoreModule };
  };

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const { db, doc, getDoc, collection, query, orderBy, limit, getDocs } = await getFirestore();
        const gRef = doc(db, 'group_chats', groupId);
        const gSnap = await getDoc(gRef);
        if (!gSnap.exists()) {
          navigate('/');
          return;
        }
        const g = { id: gSnap.id, ...gSnap.data() };
        if (!alive) return;
        setGroup(g);
        setAuthorNote(g.authorNote || '');
        setPinnedMessages(g.pinnedMessages || []);

        // Load bots in this group
        const botDocs = await Promise.all((g.botIds || []).map(async (cid) => {
          const cSnap = await getDoc(doc(db, 'characters', cid));
          return cSnap.exists() ? { id: cSnap.id, ...cSnap.data() } : null;
        }));
        const botList = botDocs.filter(Boolean);
        if (!alive) return;
        setBots(botList);

        // Load recent messages
        const mQ = query(collection(db, 'group_chats', groupId, 'messages'), orderBy('createdAt', 'asc'), limit(200));
        const mSnap = await getDocs(mQ);
        const list = mSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!alive) return;
        setMessages(list);
        setTimeout(scrollToBottom, 50);
      } catch (e) {
        console.error('Failed to load group chat', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [groupId, userId]);

  // Persist Author's Note for this group chat
  useEffect(() => {
    if (!userId || !groupId) return;
    const t = setTimeout(async () => {
      try {
        const { db, firestoreModule } = await getFirestoreServices();
        const { doc, setDoc, serverTimestamp } = firestoreModule;
        await setDoc(doc(db, 'group_chats', groupId), {
          authorNote: authorNote || '',
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (e) {
        // non-fatal
        console.error('Failed to save author note', e);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [authorNote, groupId, userId]);

// Persist pinned messages (Lorebook)
useEffect(() => {
  if (!userId || !groupId) return;
  const t = setTimeout(async () => {
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { doc, setDoc, serverTimestamp } = firestoreModule;
      await setDoc(doc(db, 'group_chats', groupId), {
        pinnedMessages: pinnedMessages || [],
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error('Failed to save pinned messages', e);
    }
  }, 500);
  return () => clearTimeout(t);
}, [pinnedMessages, groupId, userId]);



  const botById = useMemo(() => {
    const map = new Map();
    bots.forEach(b => map.set(b.id, b));
    return map;
  }, [bots]);

  const settings = useMemo(() => loadSettings(userId), [userId]);

  const openBotSettings = async (botId) => {
    if (!userId) return;
    const bot = botById.get(botId);
    if (!bot) return;
    setActiveBotForSettings(botId);
    const local = loadCharacterSettings(userId, botId);
    const synced = await syncCharacterSettings(userId, botId);
    setActiveBotSettings(synced || local);
    setSettingsOpen(true);
  };


// Pinning / Lorebook
const makePinId = (msg) => msg?.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const isPinned = (msg) => {
  const id = msg?.id;
  return (pinnedMessages || []).some(p => p.id === id);
};

const pinMsg = (msg) => {
  if (!msg?.content) return;
  const id = msg.id || makePinId(msg);
  if ((pinnedMessages || []).some(p => p.id === id)) return;
  const text = (msg.content || '').trim();
  if (!text) return;
  const next = [
    ...(pinnedMessages || []),
    {
      id,
      text: text.slice(0, 500),
      role: msg.role,
      botId: msg.botId || null,
      pinnedAt: Date.now(),
    }
  ].slice(0, 20);
  setPinnedMessages(next);
};

const unpinMsg = (msg) => {
  const id = msg?.id;
  if (!id) return;
  setPinnedMessages(prev => (prev || []).filter(p => p.id !== id));
};

const removePinById = (id) => {
  setPinnedMessages(prev => (prev || []).filter(p => p.id !== id));
};

  const buildApiMessagesForBot = (bot, history) => {
    const system = `You are ${bot.name || 'a bot'}.
` +
      `Persona/Definition:
${bot.personality || bot.description || ''}

` +
      `Rules:
- Stay in character.
- This is a group chat. Address other bots by name when appropriate.
- Keep responses concise unless asked.
`;

    // Convert group chat into OpenAI-style messages:
    // Represent other bots as assistant text prefixed with their name.
    const msgs = [{ role: 'system', content: system }];
    const note = (authorNote || '').trim();
    if (note) msgs.push({ role: 'system', content: `Author's Note (Context): ${note}` });
    if ((pinnedMessages || []).length > 0) {
      msgs.push({
        role: 'system',
        content: 'Pinned Lorebook (always true; keep these facts in memory):\n' + (pinnedMessages || []).slice(0, 20).map(p => `- ${p.text}`).join('\n')
      });
    }
    history.forEach(m => {
      if (m.role === 'user') {
        msgs.push({ role: 'user', content: m.content });
        return;
      }
      const speaker = botById.get(m.botId)?.name || 'Bot';
      msgs.push({ role: 'assistant', content: `${speaker}: ${m.content}` });
    });
    // Nudge current bot to speak as itself
    msgs.push({ role: 'user', content: `Respond as ${bot.name || 'this bot'} (no prefix needed).` });
    return msgs;
  };

  const persistMessage = async (msg) => {
    const { db, collection, addDoc, serverTimestamp } = await getFirestore();
    const ref = await addDoc(collection(db, 'group_chats', groupId, 'messages'), {
      ...msg,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  };


  const replaceLocalId = (tempId, realId) => {
    setMessages(prev => prev.map(m => m.id === tempId ? ({ ...m, id: realId }) : m));
  };

  const updateMessageDoc = async (id, patch) => {
    const { db, doc, updateDoc, serverTimestamp } = await getFirestore();
    await updateDoc(doc(db, 'group_chats', groupId, 'messages', id), { ...patch, updatedAt: serverTimestamp() });
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || bots.length < 2) return;

    setSending(true);
    setInput('');
    const tempUserId = makeId();
    const userMsg = { id: tempUserId, role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setTimeout(scrollToBottom, 50);

    try {
      const realUserId = await persistMessage({ role: 'user', content: text, userId });
      replaceLocalId(tempUserId, realUserId);

      // Each bot responds in order.
      for (const bot of bots) {
        const botSettings = loadCharacterSettings(userId, bot.id);
        const apiMessages = buildApiMessagesForBot(bot, [...messages, userMsg]);

        // typing placeholder
        const tempId = makeId();
        setMessages(prev => [...prev, { id: tempId, role: 'bot', botId: bot.id, content: '…', pending: true }]);
        setTimeout(scrollToBottom, 50);

        const { content } = await requestCompletion({
          apiMessages,
          settings,
          characterSettings: botSettings,
          stream: false,
        });

        const finalText = content || '(no response)';
        setMessages(prev => prev.map(m => m.id === tempId ? ({ ...m, content: finalText, pending: false }) : m));
        const realBotMsgId = await persistMessage({ role: 'bot', botId: bot.id, content: finalText });
        replaceLocalId(tempId, realBotMsgId);
        setTimeout(scrollToBottom, 50);
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { id: makeId(), role: 'system', content: `Error: ${e.message || 'Failed to generate responses.'}` }]);
    } finally {
      setSending(false);
      // update group updatedAt
      try {
        const { db, doc, updateDoc, serverTimestamp } = await getFirestore();
        await updateDoc(doc(db, 'group_chats', groupId), { updatedAt: serverTimestamp() });
      } catch {}
    }
  };

  const runBotToBotRound = async () => {
    if (sending || bots.length < 2) return;
    setSending(true);
    try {
      // No new user message; bots continue from latest context once each.
      for (const bot of bots) {
        const botSettings = loadCharacterSettings(userId, bot.id);
        const apiMessages = buildApiMessagesForBot(bot, messages);

        const tempId = makeId();
        setMessages(prev => [...prev, { id: tempId, role: 'bot', botId: bot.id, content: '…', pending: true }]);
        setTimeout(scrollToBottom, 50);

        const { content } = await requestCompletion({ apiMessages, settings, characterSettings: botSettings, stream: false });

        const finalText = content || '(no response)';
        setMessages(prev => prev.map(m => m.id === tempId ? ({ ...m, content: finalText, pending: false }) : m));
        const realBotMsgId = await persistMessage({ role: 'bot', botId: bot.id, content: finalText });
        replaceLocalId(tempId, realBotMsgId);
        setTimeout(scrollToBottom, 50);
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { id: makeId(), role: 'system', content: `Error: ${e.message || 'Failed to generate responses.'}` }]);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center text-gray-400">Loading group chat...</div>
    );
  }

  if (!group) return null;

  return (
    <div className="h-[100dvh] min-h-[100dvh] flex flex-col bg-[#0b0b12]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-white/5 sticky top-0 bg-[#0b0b12] z-10">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="p-2 rounded-xl hover:bg-white/5">
            <span className="material-icons-outlined text-gray-300">arrow_back</span>
          </Link>
          <div className="min-w-0">
            <div className="text-white font-semibold truncate">{group.title || 'Group Chat'}</div>
            <div className="text-xs text-gray-500 truncate">
              {bots.map(b => b.name).filter(Boolean).join(' • ')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={runBotToBotRound}
            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-white"
            title="Let bots respond once each without a user message"
          >
            <span className="material-icons-outlined text-sm">forum</span>
            Bot-to-bot
          </button>

          <button onClick={() => setBurgerOpen(true)} className="p-2 rounded-xl hover:bg-white/5">
            <span className="material-icons-outlined text-gray-200">menu</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      
<div ref={listRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 space-y-3">
  {/* Pinned Lorebook */}
  {pinnedMessages.length > 0 && (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden mb-2">
      <button
        onClick={() => setShowPinned(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-white/5"
      >
        <div className="flex items-center gap-2 text-sm text-gray-200">
          <span className="material-icons-outlined text-[18px] text-yellow-300">push_pin</span>
          <span className="font-semibold">Pinned</span>
          <span className="text-xs text-gray-500">({pinnedMessages.length})</span>
        </div>
        <span className="material-icons-outlined text-gray-400 text-[18px]">
          {showPinned ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {showPinned && (
        <div className="px-4 pb-3 space-y-2">
          {pinnedMessages.map((p) => (
            <div key={p.id} className="flex items-start gap-2 bg-black/20 border border-white/10 rounded-xl px-3 py-2">
              <div className="text-xs text-gray-300 leading-relaxed break-words flex-1">
                {p.text}
              </div>
              <button
                onClick={() => removePinById(p.id)}
                className="p-1 rounded-lg hover:bg-white/5 text-gray-300"
                title="Unpin"
              >
                <span className="material-icons-outlined text-[16px]">close</span>
              </button>
            </div>
          ))}
          <div className="text-[11px] text-gray-500">
            Pinned items are always included in the bots’ memory.
          </div>
        </div>
      )}
    </div>
  )}

        {messages.map(m => {
          if (m.role === 'system') {
            return (
              <div key={m.id} className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                {m.content}
              </div>
            );
          }
          const isUser = m.role === 'user';
          const bot = m.botId ? botById.get(m.botId) : null;
          return (
            <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[92%] sm:max-w-[75%] relative group rounded-2xl px-3 py-2 border ${
                isUser ? 'bg-violet-600/20 border-violet-500/20' : 'bg-white/5 border-white/10'
              }`}>

<button
  onClick={() => (isPinned(m) ? unpinMsg(m) : pinMsg(m))}
  className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-xl bg-black/60 hover:bg-black/80 border border-white/10"
  title={isPinned(m) ? 'Unpin' : 'Pin'}
>
  <span className="material-icons-outlined text-[16px] text-yellow-300">push_pin</span>

</button>

                {!isUser && m.role === 'bot' && lastBotMessage && m.id === lastBotMessage.id && !m.pending && (
                  <div className="absolute -bottom-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={startEditLastBot}
                      className="p-1.5 rounded-xl bg-black/60 hover:bg-black/80 border border-white/10"
                      title="Edit last response"
                    >
                      <span className="material-icons-outlined text-[16px] text-gray-200">edit</span>
                    </button>
                    <button
                      onClick={regenerateLastBot}
                      className="p-1.5 rounded-xl bg-black/60 hover:bg-black/80 border border-white/10"
                      title="Regenerate last response"
                    >
                      <span className="material-icons-outlined text-[16px] text-gray-200">refresh</span>
                    </button>
                  </div>
                )}

                {!isUser && bot ? (
                  <div className="flex items-center gap-2 mb-1">
                    <img
                      src={bot.avatarUrl || bot.imageUrl || '/default-avatar.png'}
                      alt={bot.name}
                      className="w-6 h-6 rounded-lg object-cover border border-white/10"
                    />
                    <div className="text-xs font-semibold text-violet-200">{bot.name}</div>
                    <button
                      onClick={() => openBotSettings(bot.id)}
                      className="ml-auto text-[10px] px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-200"
                      title="Model settings for this bot"
                    >
                      Model
                    </button>
                  </div>
                ) : null}

                <div className={`prose prose-invert max-w-none ${isUser ? 'text-white' : 'text-gray-100'} text-sm leading-relaxed`}>
                  {botEditingId === m.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={botEditValue}
                        onChange={(e) => setBotEditValue(e.target.value)}
                        rows={6}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-400/60 resize-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={cancelEditBot} className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white">Cancel</button>
                        <button onClick={saveEditBot} className="px-3 py-1.5 rounded-xl bg-emerald-500/90 hover:bg-emerald-500 text-sm text-white">Save</button>
                      </div>
                    </div>
                  ) : (
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  )}
                </div>
                {m.pending ? <div className="mt-1 text-[10px] text-gray-500">thinking...</div> : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 border-t border-white/5 bg-[#0b0b12]">
                <div className="flex items-center justify-between mb-2 px-1">
          <button
            type="button"
            onClick={() => setShowAuthorNote(v => !v)}
            className="text-[11px] text-gray-400 hover:text-gray-200 flex items-center gap-1"
          >
            <span className="material-icons-outlined text-[14px]">note_alt</span>
            Author&apos;s Note
            <span className="material-icons-outlined text-[14px] opacity-70">{showAuthorNote ? 'expand_less' : 'expand_more'}</span>
          </button>
          {authorNote?.trim() ? (
            <button
              type="button"
              onClick={() => setAuthorNote('')}
              className="text-[11px] text-gray-500 hover:text-gray-300"
              title="Clear author note"
            >
              Clear
            </button>
          ) : null}
        </div>

        {showAuthorNote ? (
          <div className="mb-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-500">Context injector (affects next replies)</span>
              <span className="text-[10px] text-gray-600">{(authorNote || '').length}/200</span>
            </div>
            <input
              value={authorNote}
              onChange={(e) => setAuthorNote(e.target.value.slice(0, 200))}
              placeholder="e.g. It is raining outside. Bot A is angry."
              className="w-full bg-transparent text-gray-200 text-sm outline-none placeholder-gray-600"
            />
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          <button
            onClick={runBotToBotRound}
            className="sm:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10"
            title="Bot-to-bot"
          >
            <span className="material-icons-outlined text-gray-200">forum</span>
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message the group..."
            rows={1}
            className="flex-1 resize-none bg-white/5 border border-white/10 rounded-2xl px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/40 max-h-32"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            disabled={sending || !input.trim()}
            onClick={handleSend}
            className="p-2 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60"
          >
            <span className="material-icons-outlined text-white">send</span>
          </button>
        </div>
      </div>

      <BurgerSettingsMenu
        open={burgerOpen}
        onClose={() => setBurgerOpen(false)}
        onOpenBotMenu={null}
        onOpenChatTools={null}
        onOpenModelSettings={() => {
          // Open model settings for first bot (quick access). Users can change per bot from message cards too.
          if (bots[0]) openBotSettings(bots[0].id);
        }}
      />

      <ModelSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        characterId={activeBotForSettings}
        characterSettings={activeBotSettings}
        onCharacterSettingsChange={setActiveBotSettings}
      />
    </div>
  );
}
