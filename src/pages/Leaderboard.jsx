import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFirestoreServices } from '../utils/firebaseClient';
import { useAuth } from '../contexts/AuthContext';
import { filterNsfw } from '../utils/contentRating';
import { warmBotAssets } from '../utils/assetCache';

export default function Leaderboard() {
  const [viewMode, setViewMode] = useState('bots'); // 'bots' or 'users'
  const [activeTab, setActiveTab] = useState('popular'); // 'popular', 'rated', 'trending' for bots; 'xp', 'likes' for users
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { userData } = useAuth();

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      try {
        let q;
        const collectionName = viewMode === 'bots' ? 'characters' : 'users';
        const { db, firestoreModule } = await getFirestoreServices();
        const { collection, query, orderBy, limit, getDocs } = firestoreModule;
        const colRef = collection(db, collectionName);

        if (viewMode === 'bots') {
          if (activeTab === 'popular') {
            q = query(colRef, orderBy('chatCount', 'desc'), limit(50));
          } else if (activeTab === 'rated') {
            q = query(colRef, orderBy('rating', 'desc'), limit(50));
          } else if (activeTab === 'loved') {
            q = query(colRef, orderBy('loveCount', 'desc'), limit(50));
          } else if (activeTab === 'messages') {
            q = query(colRef, orderBy('messageCount', 'desc'), limit(50));
          } else {
            q = query(colRef, orderBy('createdAt', 'desc'), limit(50));
          }
        } else {
          // Users Leaderboard
          if (activeTab === 'xp') {
            q = query(colRef, orderBy('xp', 'desc'), limit(50));
          } else if (activeTab === 'likes') {
            // Check if stats.likes_received is indexed, otherwise might need compound index or just field 'likes'
            // Assuming 'stats.likes_received' works if simple orderBy, but nested fields can be tricky without index.
            // Let's assume 'stats.likes_received' is a valid path. If not, I might need to rely on a top-level field or create index.
            // For safety, I'll add 'likes' to top level user object in future updates, but for now let's try path.
            // Actually, let's stick to XP as the main one, and maybe 'level'.
             q = query(colRef, orderBy('xp', 'desc'), limit(50));
          } else {
             q = query(colRef, orderBy('xp', 'desc'), limit(50));
          }
        }

        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setItems(data);
        if (viewMode === 'bots') {
          warmBotAssets(data.map(item => item.imageURL));
        }
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, [viewMode, activeTab]);

  const visibleItems = useMemo(() => (
    viewMode === 'bots'
      ? filterNsfw(items, !!userData?.nsfwEnabled)
      : items
  ), [items, viewMode, userData?.nsfwEnabled]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Leaderboard</h1>
          <p className="text-gray-400">Top ranked {viewMode} on the platform</p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex justify-center mb-6">
           <div className="bg-white/5 p-1 rounded-xl flex">
             <button 
               onClick={() => { setViewMode('bots'); setActiveTab('popular'); }}
               className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'bots' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}
             >
               Bots
             </button>
             <button 
               onClick={() => { setViewMode('users'); setActiveTab('xp'); }}
               className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'users' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}
             >
               Users
             </button>
           </div>
        </div>

        {/* Sub Tabs */}
        <div className="flex justify-center mb-8 px-4">
          <div className="bg-white/5 p-1 rounded-xl flex gap-1 overflow-x-auto max-w-full no-scrollbar">
            {viewMode === 'bots' ? (
              <>
                <TabButton id="popular" icon="whatshot" label="Most Chats" active={activeTab} set={setActiveTab} />
                <TabButton id="messages" icon="forum" label="Most Messages" active={activeTab} set={setActiveTab} />
                <TabButton id="loved" icon="favorite" label="Most Loved" active={activeTab} set={setActiveTab} />
                <TabButton id="rated" icon="star" label="Highest Rated" active={activeTab} set={setActiveTab} />
              </>
            ) : (
              <>
                <TabButton id="xp" icon="military_tech" label="Highest Level" active={activeTab} set={setActiveTab} />
                {/* Add more user metrics if available */}
              </>
            )}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="bg-[#12121a] border border-white/5 rounded-2xl p-4 flex items-center gap-4">
                <div className="skeleton w-8 h-8 rounded-full" />
                <div className="skeleton w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-40" />
                  <div className="skeleton h-3 w-24" />
                </div>
                <div className="skeleton h-4 w-16" />
              </div>
            ))}
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No items found.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleItems.map((item, index) => (
              <div 
                key={item.id}
                onClick={() => navigate(viewMode === 'bots' ? `/chat/${item.id}` : `/profile/${item.id}`)}
                className="group flex items-center gap-2 sm:gap-4 p-3 sm:p-4 bg-[#12121a] border border-white/5 rounded-2xl hover:border-violet-500/30 hover:bg-white/5 transition-all cursor-pointer"
              >
                {/* Rank */}
                <div className={`
                  w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center font-bold text-base sm:text-lg rounded-full shrink-0
                  ${index === 0 ? 'text-yellow-400 bg-yellow-400/10' : 
                    index === 1 ? 'text-gray-300 bg-gray-300/10' : 
                    index === 2 ? 'text-amber-600 bg-amber-600/10' : 
                    'text-gray-500'}
                `}>
                  {index + 1}
                </div>

                {/* Avatar */}
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-violet-900/20 shrink-0">
                  {item.imageURL || item.photoURL ? (
                    <img
                      src={item.imageURL || item.photoURL}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-icons-outlined text-violet-400">
                        {viewMode === 'bots' ? 'smart_toy' : 'person'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <h3 className="font-semibold text-white text-sm sm:text-base truncate">{item.name || item.displayName || 'Unknown'}</h3>
                    {viewMode === 'users' && Array.isArray(item.roles) && item.roles.includes('owner') && (
                      <span className="px-1 py-0.5 rounded text-[8px] sm:text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 shrink-0">OWNER</span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-400 truncate w-full">
                    {viewMode === 'bots' 
                      ? (item.description || item.personality) 
                      : `Lvl ${item.level || 1} • ${item.xp || 0} XP`
                    }
                  </p>
                </div>

                {/* Stats */}
                <div className="flex flex-col items-end gap-0.5 sm:gap-1 text-[10px] sm:text-xs text-gray-500 shrink-0">
                  {viewMode === 'bots' ? (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="material-icons-outlined text-xs sm:text-sm">chat_bubble_outline</span>
                        <span>{item.chatCount || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="material-icons-outlined text-xs sm:text-sm text-pink-500/50">favorite</span>
                        <span>{item.loveCount || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="material-icons-outlined text-xs sm:text-sm text-yellow-500/50">star</span>
                        <span>{Number(item.rating || 0).toFixed(1)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="material-icons-outlined text-xs sm:text-sm text-violet-400">military_tech</span>
                      <span>{item.xp || 0} XP</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ id, icon, label, active, set }) {
  return (
    <button
      onClick={() => set(id)}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0
        ${active === id 
          ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20' 
          : 'text-gray-400 hover:text-white hover:bg-white/5'}
      `}
    >
      <span className="material-icons-outlined text-lg">{icon}</span>
      {label}
    </button>
  );
}
