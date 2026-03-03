import { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { getFirestoreServices } from '../utils/firebaseClient';
import { useAuth } from '../contexts/AuthContext';
import { loadSettings, getModelConfig } from '../utils/settings';
import { loadCharacterSettings, saveCharacterSettings, syncCharacterSettings, getDefaultCharacterSettings } from '../utils/characterSettings';
import { getCharacterContentRating } from '../utils/contentRating';
import { warmBotAssets } from '../utils/assetCache';

import { getNextLevelXp, getBadgeForLevel, MAX_LEVEL, getAvatarBorderForLevel, getUnlockedAvatarBorders } from '../utils/levelSystem';
const ModelSettings = lazy(() => import('../components/ModelSettings'));
const BotMenu = lazy(() => import('../components/BotMenu'));
const ChatTools = lazy(() => import('../components/ChatTools'));
const BurgerSettingsMenu = lazy(() => import('../components/BurgerSettingsMenu'));
const GroupChatCreateModal = lazy(() => import('../components/GroupChatCreateModal'));

export default function Chat() {
  const { characterId } = useParams();
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const userId = user?.uid;

  const getFirestore = async () => {
    const { db, firestoreModule } = await getFirestoreServices();
    return { db, ...firestoreModule };
  };

  const [showLanguagePopup, setShowLanguagePopup] = useState(false);
  const [character, setCharacter] = useState(null);
  const [userRating, setUserRating] = useState(0);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [pendingRating, setPendingRating] = useState(0);
  const [isLoved, setIsLoved] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');

  useEffect(() => {
    const localHidden = localStorage.getItem('gemini_language_popup_hidden');
    const userHidden = userData?.languagePopupHidden;
    
    if (!localHidden && !userHidden) {
      setShowLanguagePopup(true);
    } else {
      setShowLanguagePopup(false);
    }
  }, [userData]);

  // Load User's Rating and Love status
  useEffect(() => {
    if (!userId || !characterId) return;

    async function loadUserInteraction() {
      try {
        const { db, doc, getDoc } = await getFirestore();
        const ratingRef = doc(db, 'ratings', `${userId}_${characterId}`);
        const ratingSnap = await getDoc(ratingRef);
        if (ratingSnap.exists()) {
          setUserRating(ratingSnap.data().rating);
        }

        const loveRef = doc(db, 'loves', `${userId}_${characterId}`);
        const loveSnap = await getDoc(loveRef);
        setIsLoved(loveSnap.exists());
      } catch (err) {
        console.error('Error loading user interaction:', err);
      }
    }
    loadUserInteraction();
  }, [userId, characterId]);

  // Load Comments
  useEffect(() => {
    if (!characterId) return;

    async function loadComments() {
      try {
        const { db, collection, query, where, orderBy, getDocs } = await getFirestore();
        const q = query(collection(db, 'comments'), where('characterId', '==', characterId), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error loading comments:', err);
      }
    }
    loadComments();
  }, [characterId]);

  const handleClosePopup = async (dontShowAgain) => {
    if (dontShowAgain) {
      localStorage.setItem('gemini_language_popup_hidden', 'true');
      if (userId) {
        try {
          const { db, doc, updateDoc } = await getFirestore();
          await updateDoc(doc(db, 'users', userId), {
            languagePopupHidden: true
          });
        } catch (error) {
          console.error('Error updating user preference:', error);
        }
      }
    }
    setShowLanguagePopup(false);
  };
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [authorNote, setAuthorNote] = useState('');
  const [showAuthorNote, setShowAuthorNote] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showPinned, setShowPinned] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [loadingChar, setLoadingChar] = useState(true);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [botMenuOpen, setBotMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [burgerOpen, setBurgerOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);

  const [groupCreateOpen, setGroupCreateOpen] = useState(false);
  const [characterSettings, setCharacterSettings] = useState(() => loadCharacterSettings(user?.uid, characterId));
  const [activeBranchId, setActiveBranchId] = useState('main');
  const [branches, setBranches] = useState([{ id: 'main', name: 'Main', messageCount: 0 }]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [personaMode, setPersonaMode] = useState('default');
  const [summary, setSummary] = useState('');
  const [summaryMessageCount, setSummaryMessageCount] = useState(0);
  const [summaryUpdatedAt, setSummaryUpdatedAt] = useState(null);
  const [autoSummarize, setAutoSummarize] = useState(true);
  const [chatMemories, setChatMemories] = useState([]);
  const [longMemories, setLongMemories] = useState([]);
  const [promptLibrary, setPromptLibrary] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [botEditingIndex, setBotEditingIndex] = useState(null);
  const [botEditValue, setBotEditValue] = useState('');

  const [commandNotice, setCommandNotice] = useState('');
  const [lastResponseMeta, setLastResponseMeta] = useState(null);
  const [summarizing, setSummarizing] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState('');
  const [rateLimitInfo, setRateLimitInfo] = useState(null);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [networkQuality, setNetworkQuality] = useState(() => {
    if (typeof navigator === 'undefined') return 'unknown';
    return navigator.connection?.effectiveType || 'unknown';
  });

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
  const mainMessagesRef = useRef([]);

  const chatDocId = userId && characterId ? `${userId}_${characterId}` : null;

  // Get current model settings
  const getActiveSettings = () => {
    const base = loadSettings(userId);
    // Model selection is per-bot (characterSettings.model). API keys remain global per user.
    return { ...base, model: characterSettings?.model || base.model };
  };

  const makeId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  };

  const formatDateTime = (value) => {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return '';
    }
  };

  const estimateTokens = (text) => {
    if (!text) return 0;
    const words = text.trim().split(/\s+/).length;
    return Math.max(1, Math.round(words * 1.3));
  };

  const getPricingForModel = (settings, modelId) => {
    const overrides = settings?.pricingOverrides?.[modelId] || {};
    const input = Number(overrides.input);
    const output = Number(overrides.output);
    return {
      input: Number.isFinite(input) ? input : null,
      output: Number.isFinite(output) ? output : null,
    };
  };

  const formatMs = (ms) => {
    if (ms == null || Number.isNaN(ms)) return '—';
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatCost = (cost) => {
    if (cost == null || Number.isNaN(cost)) return 'N/A';
    return `$${cost.toFixed(4)}`;
  };

  const getSafetyGuidance = () => {
    const level = characterSettings?.safetyLevel || 'balanced';
    if (level === 'strict') {
      return 'Safety Guidance: Avoid explicit sexual content, graphic violence, illegal activity instructions, and self-harm guidance. Offer safe alternatives when possible.';
    }
    if (level === 'relaxed') {
      return 'Safety Guidance: Stay respectful, avoid direct harm or illegal instructions, and keep content consensual.';
    }
    return 'Safety Guidance: Avoid harmful or illegal guidance, keep content respectful, and de-escalate unsafe topics.';
  };

  const readFileAsText = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = reject;
    reader.readAsText(file);
  });

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const convertImageToWebp = async (file) => {
    const dataUrl = await readFileAsDataUrl(file);
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const maxDim = 1024;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', 0.85);
  };

  const personaOptions = useMemo(() => {
    const builtIns = [
      { id: 'default', label: 'Default', description: 'Use the character\'s native personality.' },
      { id: 'friendly', label: 'Friendly', description: 'Warm, helpful, supportive tone.' },
      { id: 'professional', label: 'Professional', description: 'Concise, structured, businesslike responses.' },
      { id: 'playful', label: 'Playful', description: 'Lighthearted, witty, casual vibes.' },
    ];
    const fromProfile = (userData?.persona_list || []).map((p, idx) => ({
      id: `persona:${idx}`,
      label: p.name || `Persona ${idx + 1}`,
      description: p.description || p.personality || '',
      persona: p,
    }));
    return [...builtIns, ...fromProfile];
  }, [userData?.persona_list]);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, streamText, scrollToBottom]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const handleConnection = () => {
      setNetworkQuality(connection?.effectiveType || 'unknown');
    };
    if (connection?.addEventListener) {
      connection.addEventListener('change', handleConnection);
    }
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection?.removeEventListener) {
        connection.removeEventListener('change', handleConnection);
      }
    };
  }, []);

  // Load per-character generation settings
  useEffect(() => {
    if (!userId || !characterId) return;
    const local = loadCharacterSettings(userId, characterId);
    setCharacterSettings(local);
    syncCharacterSettings(userId, characterId)
      .then(remote => {
        if (remote) setCharacterSettings(remote);
      })
      .catch(err => console.error('Error syncing character settings:', err));
  }, [userId, characterId]);

  // Load character data
  useEffect(() => {
    async function loadCharacter() {
      try {
        const { db, doc, getDoc, updateDoc, increment } = await getFirestore();
        const charSnap = await getDoc(doc(db, 'characters', characterId));
        if (!charSnap.exists()) {
          navigate('/');
          return;
        }
        const data = { id: charSnap.id, ...charSnap.data() };
        setCharacter(data);
        warmBotAssets([data.imageURL, data.creatorPhotoURL]);
        
        // Increment view count
        updateDoc(doc(db, 'characters', characterId), {
          views: increment(1)
        }).catch(err => console.error('Error incrementing views:', err));

      } catch (err) {
        console.error('Error loading character:', err);
        navigate('/');
      } finally {
        setLoadingChar(false);
      }
    }
    loadCharacter();
  }, [characterId, navigate]);

  // Load chat history from Firestore
  useEffect(() => {
    let cancelled = false;
    async function loadChat() {
      setChatLoaded(false);
      try {
        const { db, doc, getDoc } = await getFirestore();
        if (!chatDocId) return;
        const chatSnap = await getDoc(doc(db, 'chats', chatDocId));
        if (!cancelled) {
          if (chatSnap.exists()) {
            const data = chatSnap.data();
            const loadedMessages = data.messages || [];
            setMessages(loadedMessages);
            mainMessagesRef.current = loadedMessages;
            setSystemPrompt(data.systemPrompt || '');
            setPersonaMode(data.personaMode || 'default');
            setSummary(data.summary || '');
            setSummaryMessageCount(data.summaryMessageCount || 0);
            setAuthorNote(data.authorNote || '');
            setPinnedMessages(data.pinnedMessages || []);
            const summaryTime = data.summaryUpdatedAt?.seconds
              ? data.summaryUpdatedAt.seconds * 1000
              : (typeof data.summaryUpdatedAt === 'number' ? data.summaryUpdatedAt : null);
            setSummaryUpdatedAt(summaryTime ? formatDateTime(summaryTime) : null);
            setAutoSummarize(data.autoSummarize !== false);
            setChatMemories(data.memories || []);
            setActiveBranchId(data.activeBranchId || 'main');
          } else {
            setMessages([]);
            mainMessagesRef.current = [];
            setSystemPrompt('');
            setPersonaMode('default');
            setSummary('');
            setSummaryMessageCount(0);
            setSummaryUpdatedAt(null);
            setAutoSummarize(true);
            setChatMemories([]);
            setActiveBranchId('main');
          }
          setChatLoaded(true);
        }
      } catch (err) {
        console.error('Error loading chat:', err);
        if (!cancelled) setChatLoaded(true);
      }
    }
    if (character && chatDocId) loadChat();
    return () => { cancelled = true; };
  }, [character, chatDocId]);

  const replaceTags = (text) => {
    if (!text) return '';
    const userName = userData?.displayName || user?.displayName || 'User';
    const charName = character?.name || 'Character';
    return text.replace(/{{user}}/gi, userName).replace(/{{char}}/gi, charName);
  };

  const getPersonaPrompt = () => {
    if (!personaMode || personaMode === 'default') return '';
    const option = personaOptions.find(opt => opt.id === personaMode);
    if (!option) return '';
    if (option.persona) {
      const parts = [];
      if (option.persona.name) parts.push(`Name: ${option.persona.name}`);
      if (option.persona.description) parts.push(`Description: ${option.persona.description}`);
      if (option.persona.personality) parts.push(`Personality: ${option.persona.personality}`);
      return parts.join('\n');
    }
    return option.description || option.label;
  };

  const loadLongTermMemory = async () => {
    if (!userId) return;
    try {
      const { db, doc, getDoc } = await getFirestore();
      const ref = doc(db, 'users', userId, 'private_data', 'long_term_memory');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setLongMemories(snap.data().items || []);
      } else {
        setLongMemories([]);
      }
    } catch (err) {
      console.error('Error loading long-term memory:', err);
    }
  };

  const saveLongTermMemory = async (items) => {
    if (!userId) return;
    setLongMemories(items);
    try {
      const { db, doc, setDoc, serverTimestamp } = await getFirestore();
      const ref = doc(db, 'users', userId, 'private_data', 'long_term_memory');
      await setDoc(ref, { items, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.error('Error saving long-term memory:', err);
    }
  };

  const loadPromptLibrary = async () => {
    if (!userId) return;
    try {
      const { db, doc, getDoc } = await getFirestore();
      const ref = doc(db, 'users', userId, 'private_data', 'prompt_library');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setPromptLibrary(snap.data().items || []);
      } else {
        setPromptLibrary([]);
      }
    } catch (err) {
      console.error('Error loading prompt library:', err);
    }
  };

  const savePromptLibrary = async (items) => {
    if (!userId) return;
    setPromptLibrary(items);
    try {
      const { db, doc, setDoc, serverTimestamp } = await getFirestore();
      const ref = doc(db, 'users', userId, 'private_data', 'prompt_library');
      await setDoc(ref, { items, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.error('Error saving prompt library:', err);
    }
  };

  const saveChatMeta = async (next) => {
    if (!userId || !characterId || !chatDocId) return;
    try {
      const { db, doc, setDoc, serverTimestamp } = await getFirestore();
      await setDoc(doc(db, 'chats', chatDocId), {
        ...next,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.error('Error saving chat meta:', err);
    }
  };

  // Persist Author's Note (Context Injector)
  useEffect(() => {
    if (!chatLoaded) return;
    const t = setTimeout(() => {
      saveChatMeta({ authorNote: authorNote || '' });
    }, 500);
    return () => clearTimeout(t);
  }, [authorNote, chatLoaded]);


  // Persist pinned messages (Lorebook)
  useEffect(() => {
    if (!chatLoaded) return;
    const t = setTimeout(() => {
      saveChatMeta({ pinnedMessages: pinnedMessages || [] });
    }, 500);
    return () => clearTimeout(t);
  }, [pinnedMessages, chatLoaded]);

  const loadBranches = async () => {
    if (!userId || !characterId || !chatDocId) return;
    try {
      const { db, collection, getDocs } = await getFirestore();
      const snap = await getDocs(collection(db, 'chats', chatDocId, 'branches'));
      const branchDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const mainMeta = { id: 'main', name: 'Main', messageCount: mainMessagesRef.current.length || 0 };
      setBranches([mainMeta, ...branchDocs.map(b => ({
        id: b.id,
        name: b.name || 'Branch',
        messageCount: (b.messages || []).length,
      }))]);
    } catch (err) {
      console.error('Error loading branches:', err);
    }
  };

  const loadActiveMessages = async (branchId) => {
    if (!userId || !characterId || !chatDocId) return;
    try {
      if (branchId === 'main') {
        const { db, doc, getDoc } = await getFirestore();
        const snap = await getDoc(doc(db, 'chats', chatDocId));
        const msgs = snap.exists() ? (snap.data().messages || []) : [];
        mainMessagesRef.current = msgs;
        setMessages(msgs);
        return;
      }
      const { db, doc, getDoc } = await getFirestore();
      const snap = await getDoc(doc(db, 'chats', chatDocId, 'branches', branchId));
      const msgs = snap.exists() ? (snap.data().messages || []) : [];
      setMessages(msgs);
    } catch (err) {
      console.error('Error loading branch messages:', err);
    }
  };

  // Initialize with first_message only AFTER chat has been loaded from Firestore
  useEffect(() => {
    if (chatLoaded && character && messages.length === 0 && character.first_message) {
      const firstMsg = {
        role: 'assistant',
        content: replaceTags(character.first_message),
        timestamp: Date.now(),
      };
      setMessages([firstMsg]);
      saveMessages([firstMsg]);
    }
  }, [chatLoaded, character, messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userId) return;
    loadLongTermMemory();
    loadPromptLibrary();
  }, [userId]);

  useEffect(() => {
    if (!chatLoaded) return;
    loadBranches();
  }, [chatLoaded]);

  useEffect(() => {
    if (!chatLoaded) return;
    loadActiveMessages(activeBranchId);
  }, [activeBranchId, chatLoaded]);

  useEffect(() => {
    if (chatLoaded) {
      inputRef.current?.focus();
    }
  }, [chatLoaded]);

  useEffect(() => {
    if (!commandNotice) return;
    const timer = setTimeout(() => setCommandNotice(''), 3500);
    return () => clearTimeout(timer);
  }, [commandNotice]);

  useEffect(() => {
    setBranches(prev => prev.map(b => b.id === activeBranchId ? { ...b, messageCount: messages.length } : b));
  }, [messages, activeBranchId]);

  // Save messages (main chat or branch)
  const saveMessages = async (msgs, branchId = activeBranchId) => {
    if (!userId || !characterId || !chatDocId) return;
    try {
      const lastMessage = msgs[msgs.length - 1]?.content?.slice(0, 100) || '';
      const { db, doc, setDoc, serverTimestamp } = await getFirestore();
      const basePayload = {
        userId: userId,
        characterId,
        characterName: character?.name || 'Character',
        characterImageURL: character?.imageURL || '',
        characterContentRating: getCharacterContentRating(character),
      };

      if (branchId === 'main') {
        mainMessagesRef.current = msgs;
        await setDoc(doc(db, 'chats', chatDocId), {
          ...basePayload,
          messages: msgs,
          lastMessage,
          activeBranchId: 'main',
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } else {
        const branchName = branches.find(b => b.id === branchId)?.name || 'Branch';
        await setDoc(doc(db, 'chats', chatDocId, 'branches', branchId), {
          name: branchName,
          messages: msgs,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        await setDoc(doc(db, 'chats', chatDocId), {
          ...basePayload,
          lastMessage,
          activeBranchId: branchId,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
    } catch (err) {
      console.error('Error saving chat messages:', err);
    }
  };

  // Build system prompt from character data
  const buildSystemPrompt = () => {
    let prompt = '';
    if (character.name) prompt += `You are ${character.name}.\n\n`;
    if (character.personality) prompt += `Persona: ${replaceTags(character.personality)}\n\n`;
    if (character.scenario) prompt += `Scenario: ${replaceTags(character.scenario)}\n\n`;
    if (character.description) prompt += `Description: ${replaceTags(character.description)}\n\n`;
    if (character.definition) prompt += `Advanced Definition:\n${replaceTags(character.definition)}\n\n`;
    if (character.example_dialogue) prompt += `Example Dialogue:\n${replaceTags(character.example_dialogue)}\n\n`;
    const personaPrompt = getPersonaPrompt();
    if (personaPrompt) prompt += `Mode Guidance:\n${personaPrompt}\n\n`;
    if (systemPrompt) prompt += `Session Rules:\n${systemPrompt}\n\n`;
    if (summary) prompt += `Conversation Summary:\n${summary}\n\n`;
    if (chatMemories.length > 0) {
      prompt += 'Remembered Facts (This Chat):\n';
      chatMemories.forEach((m) => { prompt += `- ${m.text}\n`; });
      prompt += '\n';
    }
    if (longMemories.length > 0) {
      prompt += 'Long-Term Memory:\n';
      longMemories.forEach((m) => { prompt += `- ${m.text}\n`; });
      prompt += '\n';
    }
    prompt += `${getSafetyGuidance()}\n\n`;
    prompt += 'Stay in character at all times. Do not break character or mention being an AI. Respond naturally as this character would.';
    return prompt;
  };

  // Build message history for API
  const buildApiMessages = (currentMessages) => {
    const systemMsg = { role: 'system', content: buildSystemPrompt() };

    const pinned = Array.isArray(pinnedMessages) ? pinnedMessages : [];
    const pinnedMsg = pinned.length > 0
      ? {
          role: 'system',
          content:
            'Pinned Lorebook (always true; keep these facts in memory even if the chat is long):
' +
            pinned
              .slice(0, 20)
              .map((p) => `- ${p.text}`)
              .join('
')
        }
      : null;

    const note = (authorNote || '').trim();
    const noteMsg = note ? { role: 'system', content: `Author's Note (Context): ${note}` } : null;

    const history = currentMessages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    return [systemMsg, ...(pinnedMsg ? [pinnedMsg] : []), ...(noteMsg ? [noteMsg] : []), ...history];
  };

  const buildSummaryMessages = (currentMessages) => {
    const clipped = currentMessages.slice(-40);
    const transcript = clipped.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    return [
      { role: 'system', content: 'Summarize the conversation into concise bullet points capturing decisions, preferences, names, and open tasks. Avoid quoting.' },
      { role: 'user', content: `Conversation:\n${transcript}` }
    ];
  };

  const requestCompletion = async (apiMessages, { stream = true, onToken }) => {
    const settings = getActiveSettings();
    const modelConfig = getModelConfig(settings.model);
    const provider = modelConfig.provider;

    let apiKey = '';
    if (provider === 'pawan') apiKey = settings.pawanApiKey;
    if (provider === 'gemini') apiKey = settings.geminiApiKey;
    if (provider === 'groq') apiKey = settings.groqApiKey;
    if (provider === 'mistral') apiKey = settings.mistralApiKey;

    if (modelConfig.requiresKey && !apiKey) {
      throw new Error(`${modelConfig.name} requires an API key.`);
    }

    let response;

    if (['pawan', 'groq', 'mistral'].includes(provider)) {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      const body = {
        model: settings.model,
        messages: apiMessages,
        temperature: characterSettings.temperature != null ? characterSettings.temperature : modelConfig.tempDefault,
        max_tokens: characterSettings.maxTokens || 4096,
        top_p: characterSettings.topP || 0.9,
        stream,
      };
      if (provider === 'pawan') {
        if (characterSettings.topK) body.top_k = characterSettings.topK;
        if (characterSettings.repetitionPenalty) body.repetition_penalty = characterSettings.repetitionPenalty;
      }
      response = await fetch(modelConfig.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: abortRef.current?.signal,
      });
    } else if (provider === 'gemini') {
      const systemMsg = apiMessages.find(m => m.role === 'system');
      const chatMsgs = apiMessages.filter(m => m.role !== 'system');

      const contents = chatMsgs.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const geminiBody = {
        contents,
        generationConfig: {
          temperature: characterSettings.temperature != null ? characterSettings.temperature : modelConfig.tempDefault,
          maxOutputTokens: characterSettings.maxTokens || 2048,
          topP: characterSettings.topP || 0.9,
          topK: characterSettings.topK || 40,
        },
      };

      if (systemMsg) {
        geminiBody.systemInstruction = { parts: [{ text: systemMsg.content }] };
      }

      const endpoint = stream
        ? `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:streamGenerateContent?alt=sse&key=${settings.geminiApiKey}`
        : `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${settings.geminiApiKey}`;

      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
        signal: abortRef.current?.signal,
      });
    } else {
      throw new Error('Unknown provider');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.error?.message || `API error: ${response.status}`);
      error.status = response.status;
      error.retryAfter = response.headers.get('retry-after');
      throw error;
    }

    if (!stream) {
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content
        || data.candidates?.[0]?.content?.parts?.[0]?.text
        || '';
      const usage = data.usage || data.usageMetadata || null;
      return { text: text.trim(), usage };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          let delta = parsed.choices?.[0]?.delta?.content;
          if (delta === undefined) {
            delta = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          }
          if (delta) {
            fullText += delta;
            onToken?.(fullText);
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    return { text: fullText.replace(/<\/?think>/gi, '').trim(), usage: null };
  };

  const summarizeConversation = async (currentMessages = messages) => {
    if (!currentMessages.length || summarizing || streaming) return;
    setSummarizing(true);
    try {
      const summaryMessages = buildSummaryMessages(currentMessages);
      abortRef.current = new AbortController();
      const { text } = await requestCompletion(summaryMessages, { stream: false });
      if (text) {
        setSummary(text);
        setSummaryMessageCount(currentMessages.length);
        const updatedAt = Date.now();
        setSummaryUpdatedAt(formatDateTime(updatedAt));
        await saveChatMeta({
          summary: text,
          summaryMessageCount: currentMessages.length,
          summaryUpdatedAt: updatedAt,
        });
      }
    } catch (err) {
      console.error('Error summarizing conversation:', err);
    } finally {
      setSummarizing(false);
    }
  };

  const updateStatsForMessage = async (isFirstUserMessage) => {
    const { db, doc, updateDoc, increment } = await getFirestore();

    if (userId) {
      const xpGain = 10;
      let newXP = (userData?.xp || 0) + xpGain;
      let newLevel = userData?.level || 1;

      // Support multiple level-ups if XP gain is large.
      // XP is stored as "progress within current level".
      while (newLevel < MAX_LEVEL && newXP >= getNextLevelXp(newLevel)) {
        newXP -= getNextLevelXp(newLevel);
        newLevel += 1;
      }

      // Clamp to MAX_LEVEL and stop accumulating XP beyond it.
      if (newLevel >= MAX_LEVEL) {
        newLevel = MAX_LEVEL;
        newXP = 0;
      }

      const newBadge = getBadgeForLevel(newLevel);

      const expectedMaxBorder = getAvatarBorderForLevel(newLevel);
      const unlockedBorderIds = getUnlockedAvatarBorders(newLevel).map(b => b.id);
      const prevMaxBorderId = userData?.avatarBorderMaxId || null;

      let selectedBorderId = userData?.avatarBorderId || null;
      if (!selectedBorderId || selectedBorderId === prevMaxBorderId || !unlockedBorderIds.includes(selectedBorderId)) {
        selectedBorderId = expectedMaxBorder.id;
      }

      updateDoc(doc(db, 'users', userId), {
        xp: newXP,
        level: newLevel,
        badge: newBadge,
        avatarBorderMaxId: expectedMaxBorder.id,
        avatarBorderId: selectedBorderId,
        'stats.messages_sent': increment(1)
      }).catch(err => console.error('Error updating XP:', err));
    }

    if (isFirstUserMessage) {
      try {
        await updateDoc(doc(db, 'characters', characterId), {
          chatCount: increment(1),
          messageCount: increment(1)
        });
      } catch (e) {
        console.error('Error incrementing chat count', e);
      }
    } else {
      try {
        await updateDoc(doc(db, 'characters', characterId), {
          messageCount: increment(1)
        });
      } catch (e) {
        console.error('Error incrementing message count', e);
      }
    }
  };

  const maybeAutoSummarize = async (nextMessages) => {
    if (!autoSummarize || summarizing) return;
    if (nextMessages.length < 18) return;
    if (summaryMessageCount && summaryMessageCount >= nextMessages.length - 6) return;
    await summarizeConversation(nextMessages);
  };

  const sendCompletion = async (newMessages, { updateStats = true } = {}) => {
    const isFirstUserMessage = !messages.some(m => m.role === 'user');
    setMessages(newMessages);
    await saveMessages(newMessages);

    if (updateStats) {
      await updateStatsForMessage(isFirstUserMessage);
    }

    setStreaming(true);
    setStreamText('');
    abortRef.current = new AbortController();

    const apiMessages = buildApiMessages(newMessages);
    const requestStartedAt = performance.now();
    let firstTokenAt = null;

    try {
      const settings = getActiveSettings();
      const { text } = await requestCompletion(apiMessages, {
        stream: true,
        onToken: (full) => {
          if (!firstTokenAt) firstTokenAt = performance.now();
          setStreamText(full);
        }
      });

      if (text) {
        setRateLimitInfo(null);
        const promptTokens = estimateTokens(apiMessages.map(m => m.content).join(' '));
        const completionTokens = estimateTokens(text);
        const totalTokens = promptTokens + completionTokens;
        const pricing = getPricingForModel(settings, settings.model);
        const cost = pricing.input != null && pricing.output != null
          ? (promptTokens / 1000) * pricing.input + (completionTokens / 1000) * pricing.output
          : null;
        const endTime = performance.now();
        const latencyMs = firstTokenAt ? (firstTokenAt - requestStartedAt) : (endTime - requestStartedAt);
        const responseMs = endTime - requestStartedAt;

        const aiMsg = {
          role: 'assistant',
          content: text,
          timestamp: Date.now(),
          meta: {
            promptTokens,
            completionTokens,
            totalTokens,
            cost,
            latencyMs,
            responseMs,
          },
        };
        const finalMessages = [...newMessages, aiMsg];
        setMessages(finalMessages);
        setLastResponseMeta(aiMsg.meta);
        await saveMessages(finalMessages);
        await maybeAutoSummarize(finalMessages);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Chat error:', err);
        if (err.status === 429) {
          setRateLimitInfo({
            message: 'Rate limit reached. Please wait before sending another message.',
            retryAfter: err.retryAfter,
          });
        }
        const errMsg = { role: 'assistant', content: `*Error: ${err.message}*`, timestamp: Date.now() };
        const finalMessages = [...newMessages, errMsg];
        setMessages(finalMessages);
      }
    } finally {
      setStreaming(false);
      setStreamText('');
    }
  };

  const handleCommand = async (text) => {
    const [rawCommand, ...rest] = text.trim().split(' ');
    const command = rawCommand.toLowerCase();
    const arg = rest.join(' ').trim();

    if (command === '/summarize') {
      await summarizeConversation(messages);
      setCommandNotice('Summary updated.');
      return true;
    }
    if (command === '/reset') {
      if (window.confirm('Reset this chat? Messages and summary will be cleared.')) {
        setMessages([]);
        mainMessagesRef.current = [];
        setSummary('');
        setSummaryMessageCount(0);
        setSummaryUpdatedAt(null);
        setChatMemories([]);
        setActiveBranchId('main');
        await saveMessages([], 'main');
        await saveChatMeta({ summary: '', summaryMessageCount: 0, memories: [], activeBranchId: 'main' });
      }
      return true;
    }
    if (command === '/persona') {
      if (!arg) {
        setCommandNotice('Usage: /persona <name>');
        return true;
      }
      const match = personaOptions.find(opt => opt.label.toLowerCase() === arg.toLowerCase() || opt.id.toLowerCase() === arg.toLowerCase());
      if (match) {
        await handlePersonaChange(match.id);
        setCommandNotice(`Persona set to ${match.label}.`);
      } else {
        setCommandNotice('Persona not found.');
      }
      return true;
    }
    if (command === '/system') {
      await handleSystemPromptChange(arg);
      setCommandNotice('System prompt updated.');
      return true;
    }
    if (command === '/remember') {
      if (!arg) {
        setCommandNotice('Usage: /remember <text>');
        return true;
      }
      const item = { id: makeId(), text: arg, createdAt: Date.now() };
      const next = [item, ...chatMemories];
      setChatMemories(next);
      await saveChatMeta({ memories: next });
      setCommandNotice('Memory saved.');
      return true;
    }
    if (command === '/export') {
      const format = arg || 'txt';
      handleExport(format);
      return true;
    }
    return false;
  };

  const buildAttachmentText = (attachments) => {
    let appended = '';
    attachments.forEach((att) => {
      if (att.kind === 'text' && att.text) {
        appended += `\n\nAttached file: ${att.name}\n\`\`\`\n${att.text}\n\`\`\`\n`;
      } else if (att.kind === 'file') {
        appended += `\n\nAttached file: ${att.name}`;
      } else if (att.kind === 'image') {
        appended += `\n\nAttached image: ${att.name}`;
      }
    });
    return appended.trim() ? appended : '';
  };

  const handleAttachmentChange = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setAttachmentError('');

    const next = [];
    for (const file of files) {
      if (file.size > 6 * 1024 * 1024) {
        setAttachmentError('Files must be 6MB or smaller.');
        continue;
      }

      const id = makeId();
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isText = file.type.startsWith('text/') || /\.(md|txt|js|ts|tsx|jsx|json|py|rb|go|java|c|cpp|cs|php|html|css|yml|yaml)$/i.test(file.name);

      try {
        if (isImage) {
          const webpDataUrl = await convertImageToWebp(file);
          next.push({
            id,
            kind: 'image',
            name: file.name.replace(/\.[^.]+$/, '.webp'),
            mime: 'image/webp',
            dataUrl: webpDataUrl,
            size: file.size,
          });
        } else if (isText) {
          const text = await readFileAsText(file);
          next.push({
            id,
            kind: 'text',
            name: file.name,
            mime: file.type || 'text/plain',
            text: text.slice(0, 4000),
            size: file.size,
          });
        } else if (isPdf) {
          const dataUrl = await readFileAsDataUrl(file);
          next.push({
            id,
            kind: 'file',
            name: file.name,
            mime: file.type || 'application/pdf',
            dataUrl,
            size: file.size,
          });
        } else {
          const dataUrl = await readFileAsDataUrl(file);
          next.push({
            id,
            kind: 'file',
            name: file.name,
            mime: file.type || 'application/octet-stream',
            dataUrl,
            size: file.size,
          });
        }
      } catch (err) {
        console.error('Attachment error:', err);
        setAttachmentError('Some files could not be processed.');
      }
    }

    setPendingAttachments(prev => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    inputRef.current?.focus();
  };

  const removeAttachment = (id) => {
    setPendingAttachments(prev => prev.filter(att => att.id !== id));
  };


// Pinning / Lorebook
const makePinId = (msg, index) => {
  const ts = msg?.timestamp || 0;
  return `${ts}_${index}_${msg?.role || 'msg'}`;
};

const isMessagePinned = (msg, index) => {
  const id = makePinId(msg, index);
  return (pinnedMessages || []).some(p => p.id === id);
};

const pinMessage = (msg, index) => {
  const id = makePinId(msg, index);
  if ((pinnedMessages || []).some(p => p.id === id)) return;
  const text = (msg?.content || '').trim();
  if (!text) return;

  const next = [
    ...(pinnedMessages || []),
    {
      id,
      text: text.slice(0, 500),
      sourceRole: msg.role,
      sourceTimestamp: msg.timestamp || Date.now(),
      pinnedAt: Date.now(),
    }
  ].slice(0, 20);

  setPinnedMessages(next);
};

const unpinMessage = (msg, index) => {
  const id = makePinId(msg, index);
  setPinnedMessages((prev) => (prev || []).filter(p => p.id !== id));
};

const removePinById = (id) => {
  setPinnedMessages((prev) => (prev || []).filter(p => p.id !== id));
};

  // Send message
  const handleSend = async () => {
    const text = input.trim();
    if ((!text && pendingAttachments.length === 0) || streaming) return;
    if (!isOnline) {
      setCommandNotice('You appear to be offline. Reconnect to send messages.');
      return;
    }
    setRateLimitInfo(null);

    if (editingIndex !== null) {
      const updated = messages.map((m, i) => i === editingIndex ? { ...m, content: text, timestamp: Date.now() } : m);
      const sliced = updated.slice(0, editingIndex + 1);
      setEditingIndex(null);
      setInput('');
      await sendCompletion(sliced, { updateStats: false });
      return;
    }

    if (text.startsWith('/')) {
      const handled = await handleCommand(text);
      setInput('');
      if (handled) return;
    }

    const attachmentText = buildAttachmentText(pendingAttachments);
    const content = `${text}${attachmentText ? `${text ? '\n' : ''}${attachmentText}` : ''}`.trim();
    setInput('');
    const userMsg = {
      role: 'user',
      content,
      timestamp: Date.now(),
      attachments: pendingAttachments,
    };
    setPendingAttachments([]);
    const newMessages = [...messages, userMsg];
    await sendCompletion(newMessages, { updateStats: true });
  };

  const handleAddChatMemory = async (text) => {
    const item = { id: makeId(), text, createdAt: Date.now() };
    const next = [item, ...chatMemories];
    setChatMemories(next);
    await saveChatMeta({ memories: next });
  };

  const handleUpdateChatMemory = async (id, text) => {
    const next = chatMemories.map(m => m.id === id ? { ...m, text, updatedAt: Date.now() } : m);
    setChatMemories(next);
    await saveChatMeta({ memories: next });
  };

  const handleDeleteChatMemory = async (id) => {
    const next = chatMemories.filter(m => m.id !== id);
    setChatMemories(next);
    await saveChatMeta({ memories: next });
  };

  const handlePromoteChatMemory = async (item) => {
    const promoted = { id: makeId(), text: item.text, createdAt: Date.now() };
    await saveLongTermMemory([promoted, ...longMemories]);
  };

  const handleAddLongMemory = async (text) => {
    const item = { id: makeId(), text, createdAt: Date.now() };
    await saveLongTermMemory([item, ...longMemories]);
  };

  const handleUpdateLongMemory = async (id, text) => {
    const next = longMemories.map(m => m.id === id ? { ...m, text, updatedAt: Date.now() } : m);
    await saveLongTermMemory(next);
  };

  const handleDeleteLongMemory = async (id) => {
    const next = longMemories.filter(m => m.id !== id);
    await saveLongTermMemory(next);
  };

  const handleAddPrompt = async ({ title, content }) => {
    const item = { id: makeId(), title, content, createdAt: Date.now() };
    await savePromptLibrary([item, ...promptLibrary]);
  };

  const handleUpdatePrompt = async (id, title, content) => {
    const next = promptLibrary.map(p => p.id === id ? { ...p, title, content, updatedAt: Date.now() } : p);
    await savePromptLibrary(next);
  };

  const handleDeletePrompt = async (id) => {
    const next = promptLibrary.filter(p => p.id !== id);
    await savePromptLibrary(next);
  };

  const handleInsertPrompt = (item) => {
    setInput(prev => (prev ? `${prev}\n\n${item.content}` : item.content));
    inputRef.current?.focus();
  };

  const handleToggleReaction = async (index, reaction) => {
    const next = messages.map((m, i) => {
      if (i !== index) return m;
      const current = m.reaction || null;
      const nextReaction = current === reaction ? null : reaction;
      return { ...m, reaction: nextReaction, reactionUpdatedAt: Date.now() };
    });
    setMessages(next);
    await saveMessages(next);
  };

  const handleExport = (format) => {
    const safeFormat = ['txt', 'md', 'json'].includes(format) ? format : 'txt';
    const fileName = `${character?.name || 'chat'}-${safeFormat}.${safeFormat === 'md' ? 'md' : safeFormat}`;
    let payload = '';

    if (safeFormat === 'json') {
      payload = JSON.stringify({
        character: character?.name || 'Character',
        branchId: activeBranchId,
        summary,
        messages,
      }, null, 2);
    } else if (safeFormat === 'md') {
      payload = messages.map(m => `**${m.role === 'user' ? 'User' : 'Assistant'}:** ${m.content}`).join('\n\n');
    } else {
      payload = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
    }

    const blob = new Blob([payload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSystemPromptChange = async (value) => {
    setSystemPrompt(value);
    await saveChatMeta({ systemPrompt: value });
  };

  const handlePersonaChange = async (value) => {
    setPersonaMode(value);
    await saveChatMeta({ personaMode: value });
  };

  const handleToggleAutoSummarize = async (value) => {
    setAutoSummarize(value);
    await saveChatMeta({ autoSummarize: value });
  };

  const handleSwitchBranch = async (branchId) => {
    setActiveBranchId(branchId);
    await saveChatMeta({ activeBranchId: branchId });
  };

  const handleCreateBranchFromLatest = async () => {
    if (!chatDocId) return;
    const branchId = makeId();
    const branchName = `Branch ${branches.length}`;
    try {
      const { db, doc, setDoc, serverTimestamp } = await getFirestore();
      await setDoc(doc(db, 'chats', chatDocId, 'branches', branchId), {
        name: branchName,
        messages,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await saveChatMeta({ activeBranchId: branchId });
      setActiveBranchId(branchId);
      await loadBranches();
    } catch (err) {
      console.error('Error creating branch:', err);
    }
  };

  const handleBranchFromIndex = async (index) => {
    if (!chatDocId) return;
    const branchId = makeId();
    const branchName = `Branch ${branches.length}`;
    const sliced = messages.slice(0, index + 1);
    try {
      const { db, doc, setDoc, serverTimestamp } = await getFirestore();
      await setDoc(doc(db, 'chats', chatDocId, 'branches', branchId), {
        name: branchName,
        messages: sliced,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setActiveBranchId(branchId);
      await saveChatMeta({ activeBranchId: branchId });
      setMessages(sliced);
      await loadBranches();
    } catch (err) {
      console.error('Error branching conversation:', err);
    }
  };

  const handleRewindToIndex = async (index) => {
    const sliced = messages.slice(0, index + 1);
    setMessages(sliced);
    await saveMessages(sliced);
    setSummary('');
    setSummaryMessageCount(0);
    setSummaryUpdatedAt(null);
    await saveChatMeta({ summary: '', summaryMessageCount: 0 });
  };

  const handleRenameBranch = async (branch) => {
    if (!chatDocId) return;
    const nextName = window.prompt('Rename branch', branch.name);
    if (!nextName) return;
    try {
      const { db, doc, setDoc } = await getFirestore();
      await setDoc(doc(db, 'chats', chatDocId, 'branches', branch.id), { name: nextName }, { merge: true });
      await loadBranches();
    } catch (err) {
      console.error('Error renaming branch:', err);
    }
  };

  const handleDeleteBranch = async (branchId) => {
    if (!chatDocId) return;
    if (!window.confirm('Delete this branch?')) return;
    try {
      const { db, doc, deleteDoc } = await getFirestore();
      await deleteDoc(doc(db, 'chats', chatDocId, 'branches', branchId));
      if (activeBranchId === branchId) {
        setActiveBranchId('main');
        await saveChatMeta({ activeBranchId: 'main' });
      }
      await loadBranches();
    } catch (err) {
      console.error('Error deleting branch:', err);
    }
  };

  const startEditMessage = (index) => {
    const msg = messages[index];
    if (!msg || msg.role !== 'user') return;
    setEditingIndex(index);
    setInput(msg.content);
    inputRef.current?.focus();
  };


  const lastAssistantIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === 'assistant' && !messages[i]?.pending) return i;
    }
    return -1;
  }, [messages]);

  const startEditLastBotResponse = () => {
    if (lastAssistantIndex < 0) return;
    const msg = messages[lastAssistantIndex];
    setBotEditingIndex(lastAssistantIndex);
    setBotEditValue(msg?.content || '');
  };

  const saveEditedBotResponse = async () => {
    if (botEditingIndex == null) return;
    const nextText = botEditValue.trim();
    const updated = messages.map((m, i) =>
      i === botEditingIndex ? { ...m, content: nextText || m.content, edited: true, timestamp: Date.now() } : m
    );
    setMessages(updated);
    await saveMessages(updated);
    setBotEditingIndex(null);
    setBotEditValue('');
  };

  const cancelEditedBotResponse = () => {
    setBotEditingIndex(null);
    setBotEditValue('');
  };

  const regenerateLastBotResponse = async () => {
    if (streaming) return;
    const idx = lastAssistantIndex;
    if (idx < 0) return;
    const sliced = messages.slice(0, idx); // drop last assistant message
    await sendCompletion(sliced, { updateStats: false });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
  };

  // Get display name for current model
  const getCurrentModelLabel = () => {
    const settings = getActiveSettings();
    const config = getModelConfig(settings.model);
    return config.name;
  };

  const getCurrentProvider = () => {
    const settings = getActiveSettings();
    const config = getModelConfig(settings.model);
    return config.provider;
  };

  const handleSaveCharacterSettings = async (nextSettings) => {
    if (!userId || !characterId) return;
    const saved = await saveCharacterSettings(userId, characterId, nextSettings);
    if (saved) setCharacterSettings(saved);
  };

  const handleCreativityChange = async (value) => {
    if (!userId || !characterId) return;
    const next = { ...characterSettings, temperature: value };
    setCharacterSettings(next);
    await saveCharacterSettings(userId, characterId, next);
  };

  const handleSafetyLevelChange = async (value) => {
    if (!userId || !characterId) return;
    const next = { ...characterSettings, safetyLevel: value };
    setCharacterSettings(next);
    await saveCharacterSettings(userId, characterId, next);
  };

  const handleResetCharacterSettings = () => {
    const reset = getDefaultCharacterSettings();
    setCharacterSettings(reset);
    return reset;
  };

  const handleDeleteConversation = async () => {
    if (!userId || !characterId || !chatDocId) return;
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return;
    try {
      const { db, doc, deleteDoc } = await getFirestore();
      await deleteDoc(doc(db, 'chats', chatDocId));
      setMessages([]);
      mainMessagesRef.current = [];
      setSummary('');
      setSummaryMessageCount(0);
      setSummaryUpdatedAt(null);
      setChatMemories([]);
      setSystemPrompt('');
      setPersonaMode('default');
      setActiveBranchId('main');
      setBranches([{ id: 'main', name: 'Main', messageCount: 0 }]);
      setChatLoaded(true);
      setBotMenuOpen(false);
    } catch (err) {
      console.error('Error deleting conversation:', err);
      alert('Failed to delete conversation.');
    }
  };

  const handleRate = async (rating) => {
    if (!userId || !characterId) return;
    try {
      const { db, doc, getDoc, setDoc, updateDoc, serverTimestamp, increment } = await getFirestore();
      const ratingRef = doc(db, 'ratings', `${userId}_${characterId}`);
      const oldRatingSnap = await getDoc(ratingRef);
      
      let ratingDiff = rating;
      let countInc = 1;

      if (oldRatingSnap.exists()) {
        ratingDiff = rating - oldRatingSnap.data().rating;
        countInc = 0;
      }

      await setDoc(ratingRef, {
        userId: userId,
        characterId,
        rating,
        updatedAt: serverTimestamp()
      });

      setUserRating(rating);

      // Fetch the updated values from the character doc to calculate average rating
      // Alternatively, we use a simple calculation based on current local knowledge or Firestore increments.
      // For accurate results, we need the latest totalStars and ratingCount.
      // Since increments happen in the background, we'll fetch the document again or just estimate.
      // But for the leaderboard, it's better to update a single 'rating' field.
      const charSnap = await getDoc(doc(db, 'characters', characterId));
      const data = charSnap.data();
      const newTotalStars = (data.totalStars || 0) + ratingDiff;
      const newRatingCount = (data.ratingCount || 0) + countInc;
      const averageRating = newRatingCount > 0 ? (newTotalStars / newRatingCount) : 0;

      await updateDoc(doc(db, 'characters', characterId), {
        totalStars: increment(ratingDiff),
        ratingCount: increment(countInc),
        rating: averageRating
      });

    } catch (err) {
      console.error('Error rating:', err);
    }
  };

  const handleLove = async () => {
    if (!userId || !characterId) return;
    try {
      const { db, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, increment } = await getFirestore();
      const loveRef = doc(db, 'loves', `${userId}_${characterId}`);
      if (isLoved) {
        await deleteDoc(loveRef);
        await updateDoc(doc(db, 'characters', characterId), {
          loveCount: increment(-1)
        });
        // Also decrement creator's likes_received stat
        if (character.creatorId) {
          updateDoc(doc(db, 'users', character.creatorId), {
            'stats.likes_received': increment(-1)
          }).catch(err => console.error('Error updating creator stats:', err));
        }
        setIsLoved(false);
      } else {
        await setDoc(loveRef, {
          userId: userId,
          characterId,
          createdAt: serverTimestamp()
        });
        await updateDoc(doc(db, 'characters', characterId), {
          loveCount: increment(1)
        });
        // Also increment creator's likes_received stat
        if (character.creatorId) {
          updateDoc(doc(db, 'users', character.creatorId), {
            'stats.likes_received': increment(1)
          }).catch(err => console.error('Error updating creator stats:', err));
        }
        setIsLoved(true);
      }
    } catch (err) {
      console.error('Error loving:', err);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!userId || !commentInput.trim() || !characterId) return;

    try {
      const { db, collection, addDoc, serverTimestamp } = await getFirestore();
      const commentData = {
        characterId,
        userId: userId,
        userName: userData?.displayName || user?.displayName || 'Anonymous',
        userPhoto: userData?.photoURL || user?.photoURL || '',
        content: commentInput.trim(),
        rating: userRating || 0,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'comments'), commentData);
      setComments([{ id: docRef.id, ...commentData, createdAt: { seconds: Date.now()/1000 } }, ...comments]);
      setCommentInput('');
    } catch (err) {
      console.error('Error commenting:', err);
    }
  };

  const renderAttachments = (attachments = []) => {
    if (!attachments.length) return null;
    return (
      <div className="mt-3 space-y-2">
        {attachments.map(att => {
          if (att.kind === 'image') {
            return (
              <img
                key={att.id}
                src={att.dataUrl}
                alt={att.name}
                className="rounded-xl border border-white/10 max-h-64 object-cover"
              />
            );
          }
          if (att.kind === 'text') {
            return (
              <div key={att.id} className="bg-black/30 border border-white/10 rounded-xl p-3">
                <div className="text-[11px] text-gray-400 mb-2">{att.name}</div>
                <pre className="text-xs text-gray-300 whitespace-pre-wrap">{att.text}</pre>
              </div>
            );
          }
          return (
            <a
              key={att.id}
              href={att.dataUrl}
              download={att.name}
              className="flex items-center gap-2 text-xs text-violet-300 hover:text-violet-200"
            >
              <span className="material-icons-outlined text-sm">attach_file</span>
              {att.name}
            </a>
          );
        })}
      </div>
    );
  };

  const canSend = (input.trim() || pendingAttachments.length > 0) && !streaming && isOnline;
  const isPoorNetwork = ['slow-2g', '2g'].includes(networkQuality);

  if (loadingChar) {
    return (
      <div className="flex items-center justify-center h-full px-6">
        <div className="w-full max-w-2xl space-y-4">
          <div className="skeleton h-6 w-40" />
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!character) return null;

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0a0a0f] relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-violet-600/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/5 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 bg-[#0e0e16]/80 backdrop-blur-xl border-b border-white/5 z-20 relative">
        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={() => navigate('/')} 
            className="p-2 -ml-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-all"
            aria-label="Back"
          >
            <span className="material-icons-outlined">arrow_back</span>
          </button>
          
          <button 
            onClick={() => setBotMenuOpen(true)}
            className="flex items-center gap-3 group min-w-0 text-left"
          >
            <div className="relative">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden ring-2 ring-white/10 group-hover:ring-violet-500/50 transition-all shadow-lg shadow-black/50">
                {character.imageURL ? (
                  <img src={character.imageURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-violet-900/30 flex items-center justify-center">
                    <span className="material-icons-outlined text-violet-300">person</span>
                  </div>
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-[#0e0e16] rounded-full shadow-sm"></div>
            </div>
            
            <div className="min-w-0">
              <h2 className="font-bold text-white text-sm sm:text-base truncate flex items-center gap-1.5">
                {character.name}
                <span className="material-icons-outlined text-gray-500 text-sm opacity-0 group-hover:opacity-100 transition-opacity">expand_more</span>
              </h2>
              <p className="text-xs text-gray-400 truncate max-w-[200px] sm:max-w-xs">
                {character.scenario || 'Ready to chat'}
              </p>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
           {/* Branch Indicator */}
           <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/5 text-xs text-gray-400 mr-2">
             <span className="material-icons-outlined text-[14px]">call_split</span>
             <span>{branches.find(b => b.id === activeBranchId)?.name || 'Main'}</span>
           </div>

           {/* Love Button */}
           <button
            onClick={handleLove}
            className={`p-2 rounded-full transition-all ${isLoved ? 'bg-pink-500/10 text-pink-500' : 'text-gray-400 hover:bg-white/5 hover:text-pink-400'}`}
          >
            <span className="material-icons-outlined">{isLoved ? 'favorite' : 'favorite_border'}</span>
          </button>

          {/* Comments */}
          <button
            onClick={() => setShowComments(!showComments)}
            className={`p-2 rounded-full transition-all ${showComments ? 'bg-blue-500/10 text-blue-500' : 'text-gray-400 hover:bg-white/5 hover:text-blue-400'}`}
          >
            <span className="material-icons-outlined">forum</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => setBurgerOpen(true)}
            className="p-2 rounded-full text-gray-400 hover:bg-white/5 hover:text-violet-400 transition-all"
            aria-label="Open settings"
          >
            <span className="material-icons-outlined">menu</span>
          </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-hidden relative z-10 flex flex-col">
        {showComments ? (
          <div className="absolute inset-0 bg-[#0a0a0f] z-20 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <h3 className="font-bold text-white flex items-center gap-2">
                <span className="material-icons-outlined text-blue-400">forum</span>
                Comments
              </h3>
              <button 
                onClick={() => setShowComments(false)}
                className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400"
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Comment Input */}
              <form onSubmit={handleComment} className="mb-6 space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-xs text-gray-400">Rate this bot</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => handleRate(star)}
                        className={`material-icons-outlined text-base transition-colors ${userRating >= star ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'}`}
                        aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                      >
                        {userRating >= star ? 'star' : 'star_border'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-gray-200 outline-none focus:border-blue-500/50"
                  />
                  <button 
                    type="submit"
                    disabled={!commentInput.trim()}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 rounded-xl text-sm font-medium transition-colors"
                  >
                    Post
                  </button>
                </div>
              </form>

              {/* Comments List */}
              {comments.length === 0 ? (
                <div className="text-center py-10">
                  <span className="material-icons-outlined text-gray-700 text-4xl mb-2">comments_disabled</span>
                  <p className="text-gray-500 text-sm">No comments yet. Be the first!</p>
                </div>
              ) : (
                comments.map(comment => {
                  const isCurrentUser = comment.userId === user?.uid;
                  const displayPhoto = isCurrentUser ? (userData?.photoURL || user?.photoURL) : comment.userPhoto;
                  const displayName = isCurrentUser ? (userData?.displayName || user?.displayName) : comment.userName;
                  
                  return (
                    <div key={comment.id} className="bg-white/5 rounded-xl p-3 border border-white/5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-800">
                          {displayPhoto ? (
                            <img
                              src={displayPhoto}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="material-icons-outlined text-gray-500 text-[16px] flex items-center justify-center h-full">person</span>
                          )}
                        </div>
                        <span className={`text-sm font-semibold ${comment.userId === 'liHiw2xfxscykaCOAO1ufA3bViz2' || comment.userName === 'Evvy xan' ? 'janitor-text' : 'text-white'}`}>
                          {displayName}
                        </span>
                        {Number(comment.rating || 0) > 0 && (
                          <div className="flex items-center gap-0.5 text-[10px] text-yellow-500/80">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className="material-icons-outlined text-[12px]"
                                aria-hidden="true"
                              >
                                {Number(comment.rating || 0) >= star ? 'star' : 'star_border'}
                              </span>
                            ))}
                          </div>
                        )}
                        <span className="text-[10px] text-gray-500 ml-auto">
                          {comment.createdAt?.seconds ? new Date(comment.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 ml-8">{comment.content}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
            <div 
              className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6 scroll-smooth overscroll-contain" 
            >
              <div className="max-w-3xl mx-auto space-y-6 pb-4">

{/* Pinned Lorebook */}
{pinnedMessages.length > 0 && (
  <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
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
          Pinned items are always included in the bot’s memory.
        </div>
      </div>
    )}
  </div>
)}


                 {/* Empty State / Welcome */}
                 {messages.length === 0 && (
                   <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-50">
                     <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center">
                        <span className="material-icons-outlined text-4xl text-gray-500">chat_bubble_outline</span>
                     </div>
                     <p className="text-gray-400">Start a conversation with {character.name}</p>
                   </div>
                 )}

                 {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {/* Bot Avatar */}
                        {msg.role === 'assistant' && (
                           <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/10 self-end mb-1">
                              {character.imageURL ? (
                                <img src={character.imageURL} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="material-icons-outlined text-gray-500 text-sm flex items-center justify-center h-full bg-white/5">smart_toy</span>
                              )}
                           </div>
                        )}

                        <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] space-y-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            {/* Name Label (Optional, maybe only for bot or groups) */}
                            {msg.role === 'assistant' && i === 0 && (
                                <span className="text-[10px] text-gray-500 font-medium ml-1">{character.name}</span>
                            )}

                            <div className={`relative group ${msg.role === 'user' ? 'msg-user' : 'msg-ai'}`}>
                                {msg.role === 'user' ? (
                                    <p className="whitespace-pre-wrap leading-relaxed break-words">{msg.content}</p>
                                ) : (i === botEditingIndex ? (
                                    <div className="space-y-2">
                                      <textarea
                                        value={botEditValue}
                                        onChange={(e) => setBotEditValue(e.target.value)}
                                        rows={6}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-400/60 resize-none"
                                      />
                                      <div className="flex justify-end gap-2">
                                        <button
                                          onClick={cancelEditedBotResponse}
                                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={saveEditedBotResponse}
                                          className="px-3 py-1.5 rounded-xl bg-emerald-500/90 hover:bg-emerald-500 text-sm text-white"
                                        >
                                          Save
                                        </button>
                                      </div>
                                    </div>
                                ) : (
                                    <div className="prose prose-invert max-w-none leading-relaxed text-[15px] sm:text-sm">
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                ))}
                                
                                {renderAttachments(msg.attachments)}
                                
                                {/* Actions Overlay */}
                                <div className={`absolute ${msg.role === 'user' ? '-left-12 bottom-0' : '-right-12 bottom-0'} opacity-0 group-hover:opacity-100 transition-all flex flex-col gap-1`}>
                                  {msg.role === 'user' && (
                                    <button
                                      onClick={() => startEditMessage(i)}
                                      className="p-1 rounded bg-black/50 hover:bg-black/70 text-gray-300 hover:text-white"
                                      title="Edit message"
                                    >
                                      <span className="material-icons-outlined text-[14px]">edit</span>
                                    </button>
                                  )}

                                  {msg.role === 'assistant' && i === lastAssistantIndex && (
                                    <>
                                      <button
                                        onClick={startEditLastBotResponse}
                                        className="p-1 rounded bg-black/50 hover:bg-black/70 text-gray-300 hover:text-white"
                                        title="Edit last response"
                                      >
                                        <span className="material-icons-outlined text-[14px]">edit</span>
                                      </button>
                                      <button
                                        onClick={regenerateLastBotResponse}
                                        className="p-1 rounded bg-black/50 hover:bg-black/70 text-gray-300 hover:text-white"
                                        title="Regenerate last response"
                                      >
                                        <span className="material-icons-outlined text-[14px]">refresh</span>
                                      </button>
                                    </>
                                  )}

                                  <button
                                    onClick={() => handleRewindToIndex(i)}
                                    className="p-1 rounded bg-black/50 hover:bg-black/70 text-gray-300 hover:text-white"
                                    title="Rewind to here"
                                  >
                                    <span className="material-icons-outlined text-[14px]">history</span>
                                  </button>

                                  <button
                                    onClick={() => (isMessagePinned(msg, i) ? unpinMessage(msg, i) : pinMessage(msg, i))}
                                    className="p-1 rounded bg-black/50 hover:bg-black/70 text-gray-300 hover:text-white"
                                    title={isMessagePinned(msg, i) ? "Unpin" : "Pin to lorebook"}
                                  >
                                    <span className="material-icons-outlined text-[14px]">push_pin</span>
                                  </button>

                                  <button
                                    onClick={() => handleBranchFromIndex(i)}
                                    className="p-1 rounded bg-black/50 hover:bg-black/70 text-gray-300 hover:text-white"
                                    title="Branch from here"
                                  >
                                    <span className="material-icons-outlined text-[14px]">call_split</span>
                                  </button>
                                </div>
                            </div>
                            
                            {/* Footer (Time, Token, etc) */}
                            {msg.role === 'assistant' && msg.meta && (
                               <div className="text-[10px] text-gray-600 flex gap-2 pl-1">
                                  <span>{formatMs(msg.meta.latencyMs)}</span>
                               </div>
                            )}

                             {msg.role === 'assistant' && (
                              <div className="flex items-center gap-1 mt-1 pl-1">
                                <button
                                  onClick={() => handleToggleReaction(i, 'up')}
                                  className={`p-1 rounded transition-colors ${msg.reaction === 'up' ? 'text-emerald-400' : 'text-gray-600 hover:text-gray-400'}`}
                                >
                                  <span className="material-icons-outlined text-[14px]">{msg.reaction === 'up' ? 'thumb_up' : 'thumb_up_off_alt'}</span>
                                </button>
                                <button
                                  onClick={() => handleToggleReaction(i, 'down')}
                                  className={`p-1 rounded transition-colors ${msg.reaction === 'down' ? 'text-rose-400' : 'text-gray-600 hover:text-gray-400'}`}
                                >
                                  <span className="material-icons-outlined text-[14px]">{msg.reaction === 'down' ? 'thumb_down' : 'thumb_down_off_alt'}</span>
                                </button>
                              </div>
                             )}
                        </div>

                        {/* User Avatar (Optional) */}
                        {msg.role === 'user' && (
                           <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/10 self-end mb-1 bg-violet-600/20">
                              {userData?.photoURL || user?.photoURL ? (
                                <img src={userData?.photoURL || user?.photoURL} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="material-icons-outlined text-violet-300 text-sm flex items-center justify-center h-full">person</span>
                              )}
                           </div>
                        )}
                    </div>
                 ))}

                 {streaming && (
                    <div className="flex gap-4 justify-start">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/10 self-end mb-1">
                            {character.imageURL ? (
                              <img src={character.imageURL} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="material-icons-outlined text-gray-500 text-sm flex items-center justify-center h-full bg-white/5">smart_toy</span>
                            )}
                        </div>
                        <div className="msg-ai">
                            {streamText ? (
                                <div className="prose prose-invert prose-sm max-w-none streaming-cursor">
                                    <ReactMarkdown>{streamText}</ReactMarkdown>
                                </div>
                            ) : (
                                <div className="typing-indicator">
                                    <span></span><span></span><span></span>
                                </div>
                            )}
                        </div>
                    </div>
                 )}
                 <div ref={chatEndRef} className="h-4" />
              </div>
            </div>
        )}
      </main>

      {/* Input Footer */}
      <footer className="shrink-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] z-20 relative">
          <div className="max-w-3xl mx-auto">
             {/* Notices */}
              {editingIndex !== null && (
                <div className="mb-2 flex items-center justify-between text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <span>Editing message #{editingIndex + 1}. Sending will rerun from this point.</span>
                  <button
                    onClick={() => { setEditingIndex(null); setInput(''); }}
                    className="text-[10px] text-amber-200 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {!isOnline && (
                <div className="mb-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  Offline mode: messages will send once the connection is restored.
                </div>
              )}
              {isOnline && isPoorNetwork && (
                <div className="mb-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  Poor network detected. Responses may be delayed.
                </div>
              )}
              {rateLimitInfo && (
                <div className="mb-2 text-xs text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                  {rateLimitInfo.message}
                  {rateLimitInfo.retryAfter ? ` Retry after ${rateLimitInfo.retryAfter}s.` : ''}
                </div>
              )}
              {attachmentError && (
                <div className="mb-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {attachmentError}
                </div>
              )}
              {commandNotice && (
                <div className="mb-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                  {commandNotice}
                </div>
              )}
              {pendingAttachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {pendingAttachments.map(att => (
                    <div key={att.id} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300">
                      <span className="material-icons-outlined text-sm text-gray-400">
                        {att.kind === 'image' ? 'image' : att.kind === 'text' ? 'description' : 'attach_file'}
                      </span>
                      <span className="max-w-[140px] truncate">{att.name}</span>
                      <button
                        onClick={() => removeAttachment(att.id)}
                        className="text-gray-500 hover:text-gray-200"
                        aria-label={`Remove ${att.name}`}
                      >
                        <span className="material-icons-outlined text-sm">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
             
             {/* Input Bar */}
             <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-2xl opacity-20 group-focus-within:opacity-50 transition-opacity blur"></div>
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
                      placeholder="e.g. It is raining outside. The character is angry."
                      className="w-full bg-transparent text-gray-200 text-sm outline-none placeholder-gray-600"
                    />
                  </div>
                ) : null}

                <div className="relative bg-[#12121a] rounded-2xl flex items-end gap-2 p-2 shadow-xl shadow-black/50 border border-white/5">
                   <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.txt,.md,.js,.ts,.tsx,.jsx,.json,.py,.rb,.go,.java,.c,.cpp,.cs,.php,.html,.css,.yml,.yaml"
                    onChange={handleAttachmentChange}
                    className="hidden"
                  />
                   {/* File Input */}
                   <button 
                     onClick={() => fileInputRef.current?.click()}
                     className="p-2.5 text-gray-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-xl transition-all flex-shrink-0"
                   >
                     <span className="material-icons-outlined">attach_file</span>
                   </button>
                   
                   <textarea
                     ref={inputRef}
                     value={input}
                     onChange={(e) => setInput(e.target.value)}
                     onKeyDown={handleKeyDown}
                     placeholder={`Message ${character.name}...`}
                     rows={1}
                     className="flex-1 bg-transparent text-gray-100 text-sm placeholder-gray-500 resize-none outline-none py-3 max-h-32 min-h-[44px]"
                     style={{ minHeight: '44px' }}
                     onInput={(e) => {
                       e.target.style.height = 'auto';
                       e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
                     }}
                   />
                   
                   {/* Send Button */}
                    <button
                      onClick={streaming ? stopStreaming : handleSend}
                      disabled={!canSend && !streaming}
                      className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${
                        streaming 
                          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                          : canSend 
                            ? 'bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-600/20' 
                            : 'bg-white/5 text-gray-600'
                      }`}
                    >
                      <span className="material-icons-outlined">{streaming ? 'stop' : 'send'}</span>
                    </button>
                </div>
             </div>
             
             {/* Footer Info */}
             <p className="text-center text-gray-600 text-[10px] mt-3">
               {getCurrentProvider() === 'gemini' ? 'Powered by Google Gemini' : `Powered by ${getCurrentModelLabel()}`}
             </p>
          </div>
      </footer>
      
      {/* Language Warning Modal */}
      {showLanguagePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1e1e26] border border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative animate-in fade-in zoom-in duration-200" role="dialog" aria-modal="true">
            <button 
              onClick={() => handleClosePopup(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <span className="material-icons-outlined">close</span>
            </button>
            
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="material-icons-outlined text-yellow-500">warning</span>
              Language Notice / භාෂා දැනුම්දීම
            </h3>
            
            <div className="space-y-4 text-sm text-gray-300">
              <p>
                If you want to use sinhala as the language make sure to use <strong className="text-violet-400">gemini ai</strong>. 
                Cosmos rp will not be usable and i havent tested other models yet.
              </p>
              
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <p className="leading-relaxed text-gray-200">
                  සිංහල භාෂාව යොදා ගැනීමට <strong className="text-violet-400">gemini ai</strong> තෝරන්න. 
                  cosmos rp සිංහල සමග භාවිතා කල නොහැක. අනෙකුත් models පරීක්ෂා කර නොමැති අතර 
                  english භාෂාව සමග ඕනෑම modelක් භාවිතා කල හැක.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <Link 
                to="/help" 
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-colors font-medium"
              >
                <span className="material-icons-outlined text-lg">help</span>
                Visit Help / උදව්
              </Link>
              
              <button
                onClick={() => handleClosePopup(true)}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors py-2 flex items-center justify-center gap-1"
              >
                <span className="material-icons-outlined text-sm">visibility_off</span>
                Don't show this again / නැවත පෙන්වන්න එපා
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {ratingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1e1e26] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative animate-in fade-in zoom-in duration-200" role="dialog" aria-modal="true">
            <button
              onClick={() => setRatingOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              aria-label="Close rating"
            >
              <span className="material-icons-outlined">close</span>
            </button>

            <h3 className="text-lg font-semibold text-white mb-4">Rate this character</h3>

            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setPendingRating(star)}
                  className={`material-icons-outlined text-2xl transition-colors ${pendingRating >= star ? 'text-yellow-500' : 'text-gray-600 hover:text-gray-400'}`}
                  aria-label={`Set rating to ${star} star${star > 1 ? 's' : ''}`}
                >
                  {pendingRating >= star ? 'star' : 'star_border'}
                </button>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setRatingOpen(false)}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!pendingRating) return;
                  if (pendingRating !== userRating) {
                    await handleRate(pendingRating);
                  }
                  setRatingOpen(false);
                }}
                className="px-4 py-1.5 text-sm bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors disabled:bg-white/5 disabled:text-gray-600"
                disabled={!pendingRating}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Model Settings Modal */}
      <Suspense fallback={null}>
        
        <Suspense fallback={null}>
          <GroupChatCreateModal
            open={groupCreateOpen}
            onClose={() => setGroupCreateOpen(false)}
            seedCharacterId={characterId}
            onCreated={(gid) => navigate(`/group/${gid}`)}
          />
        </Suspense>

<ModelSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} characterId={characterId} characterSettings={characterSettings} onCharacterSettingsChange={setCharacterSettings} />
      </Suspense>

            {/* Burger Settings Menu */}
      <Suspense fallback={null}>
        <BurgerSettingsMenu
          open={burgerOpen}
          onClose={() => setBurgerOpen(false)}
          onOpenBotMenu={() => setBotMenuOpen(true)}
          onOpenChatTools={() => setToolsOpen(true)}
          onOpenModelSettings={() => setSettingsOpen(true)}
          onOpenGroupChat={() => setGroupCreateOpen(true)}
          onOpenReportBot={() => {
            setReportTarget({
              targetType: 'bot',
              targetId: characterId,
              targetName: character?.name || '',
              targetOwnerId: character?.creatorId || ''
            });
            setReportOpen(true);
          }}
        />

      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} target={reportTarget} />      </Suspense>

{/* Bot Menu */}
      <Suspense fallback={null}>
        <BotMenu
          open={botMenuOpen}
          onClose={() => setBotMenuOpen(false)}
          character={character}
          modelConfig={getModelConfig(getActiveSettings().model)}
          settings={characterSettings}
          defaultSettings={getDefaultCharacterSettings()}
          onSave={handleSaveCharacterSettings}
          onReset={handleResetCharacterSettings}
          onDeleteConversation={handleDeleteConversation}
        />
      </Suspense>

      {/* Chat Tools */}
      <Suspense fallback={null}>
        <ChatTools
          open={toolsOpen}
          onClose={() => setToolsOpen(false)}
          systemPrompt={systemPrompt}
          onSystemPromptChange={handleSystemPromptChange}
          personaMode={personaMode}
          personaOptions={personaOptions}
          onPersonaChange={handlePersonaChange}
          summary={summary}
          summaryUpdatedAt={summaryUpdatedAt}
          autoSummarize={autoSummarize}
          onToggleAutoSummarize={handleToggleAutoSummarize}
          onSummarize={() => summarizeConversation(messages)}
          creativity={characterSettings.temperature ?? getModelConfig(getActiveSettings().model).tempDefault}
          onCreativityChange={handleCreativityChange}
          safetyLevel={characterSettings.safetyLevel}
          onSafetyLevelChange={handleSafetyLevelChange}
          chatMemories={chatMemories}
          longMemories={longMemories}
          onAddChatMemory={handleAddChatMemory}
          onUpdateChatMemory={handleUpdateChatMemory}
          onDeleteChatMemory={handleDeleteChatMemory}
          onPromoteChatMemory={handlePromoteChatMemory}
          onAddLongMemory={handleAddLongMemory}
          onUpdateLongMemory={handleUpdateLongMemory}
          onDeleteLongMemory={handleDeleteLongMemory}
          promptLibrary={promptLibrary}
          onAddPrompt={handleAddPrompt}
          onUpdatePrompt={handleUpdatePrompt}
          onDeletePrompt={handleDeletePrompt}
          onInsertPrompt={handleInsertPrompt}
          branches={branches}
          activeBranchId={activeBranchId}
          onSwitchBranch={handleSwitchBranch}
          onCreateBranchFromLatest={handleCreateBranchFromLatest}
          onRenameBranch={handleRenameBranch}
          onDeleteBranch={handleDeleteBranch}
          onExport={handleExport}
        />
      </Suspense>
    </div>
  );

}
