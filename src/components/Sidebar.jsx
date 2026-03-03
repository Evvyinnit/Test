import { lazy, Suspense, useMemo, useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { getFirestoreServices } from '../utils/firebaseClient';
import { useAuth } from '../contexts/AuthContext';
import { loadSettings, getModelConfig } from '../utils/settings';
import { warmBotAssets } from '../utils/assetCache';
import AvatarWithBorder from './AvatarWithBorder';

const ModelSettings = lazy(() => import('./ModelSettings'));
const FeedbackModal = lazy(() => import('./FeedbackModal'));

export default function Sidebar({ open, onClose }) {
  const { user, userData, logout, isAdmin, refreshUser } = useAuth();
  const [recentChats, setRecentChats] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [nsfwEnabled, setNsfwEnabled] = useState(!!userData?.nsfwEnabled);
  const [showArchived, setShowArchived] = useState(false);
  const [renamingChatId, setRenamingChatId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const navigate = useNavigate();

  // Fetch user's recent chats
  useEffect(() => {
    if (!user) return;
    let active = true;

    (async () => {
      const { db, firestoreModule } = await getFirestoreServices();
      const { collection, query, where, getDocs } = firestoreModule;
      if (!active) return;

      const q = query(
        collection(db, 'chats'),
        where('userId', '==', user.uid)
      );
      const snap = await getDocs(q);
      const chats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Client-side sort and limit to avoid index issues
      chats.sort((a, b) => {
        const timeA = a.updatedAt?.seconds || 0;
        const timeB = b.updatedAt?.seconds || 0;
        return timeB - timeA;
      });
      const limited = chats.slice(0, 20);
      if (!active) return;
      setRecentChats(limited);
      warmBotAssets(limited.map(chat => chat.characterImageURL));
    })();

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    setNsfwEnabled(!!userData?.nsfwEnabled);
  }, [userData]);

  const handleChatClick = (chatItem) => {
    navigate(`/chat/${chatItem.characterId}`);
    onClose();
  };


  const handleNsfwToggle = async () => {
    if (!user) return;
    const next = !nsfwEnabled;
    setNsfwEnabled(next);
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { doc, updateDoc } = firestoreModule;
      await updateDoc(doc(db, 'users', user.uid), { nsfwEnabled: next });
      refreshUser?.();
    } catch (err) {
      console.error('Error updating NSFW preference:', err);
      setNsfwEnabled(!next);
      alert('Failed to update NSFW preference.');
    }
  };

  const visibleRecentChats = useMemo(() => (
    nsfwEnabled
      ? recentChats
      : recentChats.filter(chat => chat.characterContentRating !== 'nsfw' && chat.characterRating !== 'nsfw')
  ), [nsfwEnabled, recentChats]);

  const pinnedChats = useMemo(
    () => visibleRecentChats.filter(chat => chat.pinned && !chat.archived),
    [visibleRecentChats]
  );

  const activeChats = useMemo(
    () => visibleRecentChats.filter(chat => !chat.pinned && !chat.archived),
    [visibleRecentChats]
  );

  const archivedChats = useMemo(
    () => visibleRecentChats.filter(chat => chat.archived),
    [visibleRecentChats]
  );

  const updateChatMeta = async (chatId, updates) => {
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { doc, updateDoc } = firestoreModule;
      await updateDoc(doc(db, 'chats', chatId), updates);
      setRecentChats(prev => prev.map(chat => chat.id === chatId ? { ...chat, ...updates } : chat));
    } catch (err) {
      console.error('Error updating chat meta:', err);
      alert('Failed to update chat.');
    }
  };

  const handleRenameChat = (chat) => {
    setRenamingChatId(chat.id);
    setRenameValue(chat.chatName || chat.characterName || '');
  };

  const handleRenameSave = async (chat) => {
    const nextName = renameValue.trim();
    setRenamingChatId(null);
    if (!nextName) return;
    await updateChatMeta(chat.id, { chatName: nextName });
  };

  const handlePinToggle = async (chat) => {
    await updateChatMeta(chat.id, { pinned: !chat.pinned });
  };

  const handleArchiveToggle = async (chat) => {
    await updateChatMeta(chat.id, { archived: !chat.archived });
  };

  return (
    <aside className={`sidebar-shell ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="material-icons-outlined text-violet-400">auto_awesome</span>
          <span className="font-semibold text-white">Nevy AI</span>
        </div>
        <button onClick={onClose} className="lg:hidden p-1 hover:bg-white/5 rounded-lg">
          <span className="material-icons-outlined text-gray-400 text-xl">close</span>
        </button>
      </div>
      {user && (
        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => { navigate(`/profile/${user?.uid}`); onClose(); }}
            className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
          >
            <AvatarWithBorder
              src={userData?.photoURL || user.photoURL}
              alt=""
              borderId={userData?.avatarBorderId}
              size={32}
              className="shrink-0"
              imgClassName="w-8 h-8"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1 min-w-0">
              <p className="text-sm text-gray-200 truncate">{userData?.displayName || user.displayName || 'Welcome back'}</p>
              {userData?.isVerifiedDev && (
                <span className="material-icons-outlined text-[16px] text-sky-400 shrink-0" title="Verified Bot Dev">verified</span>
              )}
            </div>
              <div className="flex items-center gap-2">
                {userData?.badge?.name && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                    <span aria-hidden="true">{userData.badge.icon || '🎖️'}</span>
                    {userData.badge.name}
                  </span>
                )}
                <p className="text-[10px] text-gray-500 truncate">View profile</p>
              </div>
            </div>
          </button>
          <button
            onClick={logout}
            className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
            title="Sign Out"
          >
            <span className="material-icons-outlined text-gray-400 text-lg">logout</span>
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="p-3 space-y-1">
        <NavLink
          to="/"
          onClick={onClose}
          className={({ isActive }) =>
            `nav-link ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`
          }
          end
        >
          <span className="material-icons-outlined text-lg">search</span>
          Search
        </NavLink>
        <NavLink
          to="/create"
          onClick={onClose}
          className={({ isActive }) =>
            `nav-link ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`
          }
        >
          <span className="material-icons-outlined text-lg">add_circle_outline</span>
          Create Character
        </NavLink>
        <NavLink
          to="/leaderboard"
          onClick={onClose}
          className={({ isActive }) =>
            `nav-link ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`
          }
        >
          <span className="material-icons-outlined text-lg">leaderboard</span>
          Leaderboard
        </NavLink>
        <NavLink
          to="/members"
          onClick={onClose}
          className={({ isActive }) =>
            `nav-link ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`
          }
        >
          <span className="material-icons-outlined text-lg">groups</span>
          Members
        </NavLink>
        <NavLink
          to="/my-bots"
          onClick={onClose}
          className={({ isActive }) =>
            `nav-link ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`
          }
        >
          <span className="material-icons-outlined text-lg">smart_toy</span>
          My Bots
        </NavLink>
        <NavLink
          to="/help"
          onClick={onClose}
          className={({ isActive }) =>
            `nav-link ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`
          }
        >
          <span className="material-icons-outlined text-lg">help_outline</span>
          Help & Guide
        </NavLink>
        
        {isAdmin && isAdmin() && (
          <NavLink
            to="/admin"
            onClick={onClose}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'nav-link-admin' : 'nav-link-inactive'}`
            }
          >
            <span className="material-icons-outlined text-lg">admin_panel_settings</span>
            Admin
          </NavLink>
        )}
      </div>

      {/* Chat / Character List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {visibleRecentChats.length === 0 ? (
          <p className="text-gray-500 text-xs text-center mt-8">No chats yet. Start by clicking a character!</p>
        ) : (
          <>
            <div className="flex items-center justify-between px-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Sessions</p>
              {archivedChats.length > 0 && (
                <button
                  onClick={() => setShowArchived(prev => !prev)}
                  className="text-[11px] text-gray-400 hover:text-gray-200"
                >
                  {showArchived ? 'Hide archived' : 'Show archived'}
                </button>
              )}
            </div>

            {pinnedChats.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-gray-600 px-2">Pinned</p>
                {pinnedChats.map(chat => (
                  <div key={chat.id} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left text-gray-300 hover:bg-white/5 transition-colors">
                    <button
                      onClick={() => handleChatClick(chat)}
                      className="flex items-center gap-2.5 flex-1 min-w-0"
                      aria-label={`Open ${chat.chatName || chat.characterName || 'chat'}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center flex-shrink-0">
                        {chat.characterImageURL ? (
                          <img
                            src={chat.characterImageURL}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="w-8 h-8 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="material-icons-outlined text-violet-400 text-sm">person</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        {renamingChatId === chat.id ? (
                          <input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => handleRenameSave(chat)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameSave(chat);
                              if (e.key === 'Escape') setRenamingChatId(null);
                            }}
                            className="w-full bg-white/10 border border-white/10 rounded-md px-2 py-1 text-xs text-gray-200"
                            autoFocus
                          />
                        ) : (
                          <p className="truncate font-medium text-gray-200">{chat.chatName || chat.characterName || 'Character'}</p>
                        )}
                        <p className="truncate text-xs text-gray-500">{chat.lastMessage || 'Start chatting...'}</p>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleRenameChat(chat)} className="p-1 rounded hover:bg-white/10 text-gray-400" aria-label="Rename chat">
                        <span className="material-icons-outlined text-sm">edit</span>
                      </button>
                      <button onClick={() => handlePinToggle(chat)} className="p-1 rounded hover:bg-white/10 text-gray-400" aria-label="Unpin chat">
                        <span className="material-icons-outlined text-sm">push_pin</span>
                      </button>
                      <button onClick={() => handleArchiveToggle(chat)} className="p-1 rounded hover:bg-white/10 text-gray-400" aria-label="Archive chat">
                        <span className="material-icons-outlined text-sm">archive</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeChats.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-gray-600 px-2">Recent</p>
                {activeChats.map(chat => (
                  <div key={chat.id} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left text-gray-300 hover:bg-white/5 transition-colors">
                    <button
                      onClick={() => handleChatClick(chat)}
                      className="flex items-center gap-2.5 flex-1 min-w-0"
                      aria-label={`Open ${chat.chatName || chat.characterName || 'chat'}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center flex-shrink-0">
                        {chat.characterImageURL ? (
                          <img
                            src={chat.characterImageURL}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="w-8 h-8 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="material-icons-outlined text-violet-400 text-sm">person</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        {renamingChatId === chat.id ? (
                          <input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => handleRenameSave(chat)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameSave(chat);
                              if (e.key === 'Escape') setRenamingChatId(null);
                            }}
                            className="w-full bg-white/10 border border-white/10 rounded-md px-2 py-1 text-xs text-gray-200"
                            autoFocus
                          />
                        ) : (
                          <p className="truncate font-medium text-gray-200">{chat.chatName || chat.characterName || 'Character'}</p>
                        )}
                        <p className="truncate text-xs text-gray-500">{chat.lastMessage || 'Start chatting...'}</p>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleRenameChat(chat)} className="p-1 rounded hover:bg-white/10 text-gray-400" aria-label="Rename chat">
                        <span className="material-icons-outlined text-sm">edit</span>
                      </button>
                      <button onClick={() => handlePinToggle(chat)} className="p-1 rounded hover:bg-white/10 text-gray-400" aria-label="Pin chat">
                        <span className="material-icons-outlined text-sm">push_pin</span>
                      </button>
                      <button onClick={() => handleArchiveToggle(chat)} className="p-1 rounded hover:bg-white/10 text-gray-400" aria-label="Archive chat">
                        <span className="material-icons-outlined text-sm">archive</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showArchived && archivedChats.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-gray-600 px-2">Archived</p>
                {archivedChats.map(chat => (
                  <div key={chat.id} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left text-gray-300 hover:bg-white/5 transition-colors opacity-70">
                    <button
                      onClick={() => handleChatClick(chat)}
                      className="flex items-center gap-2.5 flex-1 min-w-0"
                      aria-label={`Open ${chat.chatName || chat.characterName || 'chat'}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center flex-shrink-0">
                        {chat.characterImageURL ? (
                          <img
                            src={chat.characterImageURL}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="w-8 h-8 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="material-icons-outlined text-violet-400 text-sm">person</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-200">{chat.chatName || chat.characterName || 'Character'}</p>
                        <p className="truncate text-xs text-gray-500">{chat.lastMessage || 'Start chatting...'}</p>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleArchiveToggle(chat)} className="p-1 rounded hover:bg-white/10 text-gray-400" aria-label="Unarchive chat">
                        <span className="material-icons-outlined text-sm">unarchive</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Owner Credit */}
      <div className="px-4 py-2 border-t border-white/5">
        <p className="text-[10px] text-gray-600 text-center">
          Created by{' '}
          <a href="https://github.com/Evvyinnit" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-violet-400 transition-colors">
            Nimesh D. Bandara aka Evvy Xan
          </a>
        </p>
      </div>

      {/* User Info */}
      <div className="p-3 border-t border-white/5 space-y-2">
        {/* Settings Button */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors"
        >
          <span className="material-icons-outlined text-lg">tune</span>
          <span>Model Settings</span>
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">
            {getModelConfig(loadSettings(user?.uid).model).name.split(' ').slice(0, 2).join(' ')}
          </span>
        </button>


        <button
          onClick={() => setFeedbackOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors"
        >
          <span className="material-icons-outlined text-lg">feedback</span>
          <span>Feedback</span>
        </button>

        <button
          onClick={handleNsfwToggle}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors"
        >
          <span className={`material-icons-outlined text-lg ${nsfwEnabled ? 'text-pink-400' : 'text-gray-500'}`}>explicit</span>
          <span>Show NSFW Bots</span>
          <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${nsfwEnabled ? 'bg-pink-500/15 text-pink-300' : 'bg-white/5 text-gray-500'}`}>
            {nsfwEnabled ? 'On' : 'Off'}
          </span>
        </button>
      </div>

      {/* Model Settings Modal */}
      <Suspense fallback={null}>
        <ModelSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      </Suspense>
    </aside>
  );
}
