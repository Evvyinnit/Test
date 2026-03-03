import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFirestoreServices } from '../utils/firebaseClient';
import { warmBotAssets } from '../utils/assetCache';
import { useAuth } from '../contexts/AuthContext';

export default function MyBots() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState(null);
  const [error, setError] = useState(null);

  const pageSize = 20;

  const fetchFirst = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setBots([]);
    setCursor(null);
    setHasMore(true);

    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { collection, query, where, orderBy, limit, getDocs } = firestoreModule;

      // Uses server-side pagination to avoid loading every bot at once.
      // May require an index on: characters(creatorId ASC, createdAt DESC).
      const q = query(
        collection(db, 'characters'),
        where('creatorId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );

      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setBots(data);
      warmBotAssets(data.map(b => b.imageURL), { max: 24 });

      const last = snap.docs[snap.docs.length - 1] || null;
      setCursor(last);
      setHasMore(snap.docs.length === pageSize);
    } catch (err) {
      // Fallback (no index): load a capped amount and sort client-side.
      console.warn('MyBots paginated query failed (missing index?). Falling back to capped fetch.', err);
      try {
        const { db, firestoreModule } = await getFirestoreServices();
        const { collection, query, where, getDocs } = firestoreModule;

        const q = query(collection(db, 'characters'), where('creatorId', '==', user.uid));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        const capped = data.slice(0, 200);
        setBots(capped);
        warmBotAssets(capped.map(b => b.imageURL), { max: 24 });
        setHasMore(false);
        setCursor(null);
        setError('Loaded in fallback mode (create Firestore index for best performance).');
      } catch (err2) {
        console.error('Error fetching my bots:', err2);
        setError('Failed to load your bots.');
        setHasMore(false);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchMore = useCallback(async () => {
    if (!user || !hasMore || loadingMore || !cursor) return;
    setLoadingMore(true);
    setError(null);

    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { collection, query, where, orderBy, limit, startAfter, getDocs } = firestoreModule;

      const q = query(
        collection(db, 'characters'),
        where('creatorId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        startAfter(cursor),
        limit(pageSize)
      );

      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      setBots(prev => [...prev, ...data]);
      warmBotAssets(data.map(b => b.imageURL), { max: 24 });

      const last = snap.docs[snap.docs.length - 1] || cursor;
      setCursor(last);
      setHasMore(snap.docs.length === pageSize);
    } catch (err) {
      console.error('Error loading more bots:', err);
      setHasMore(false);
      setError('Failed to load more bots.');
    } finally {
      setLoadingMore(false);
    }
  }, [user, hasMore, loadingMore, cursor]);

  useEffect(() => {
    fetchFirst();
  }, [fetchFirst]);

  const handleDelete = async (botId, botName) => {
    if (!window.confirm(`Are you sure you want to delete "${botName}"? This cannot be undone.`)) return;

    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { doc, deleteDoc } = firestoreModule;
      await deleteDoc(doc(db, 'characters', botId));
      setBots(prev => prev.filter(b => b.id !== botId));
    } catch (err) {
      console.error('Error deleting bot:', err);
      alert('Failed to delete bot.');
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0f]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-xl font-semibold text-white">My Bots</h1>
          <button
            onClick={() => navigate('/create')}
            className="px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-200 hover:bg-violet-500/25"
          >
            Create Bot
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-40 rounded-2xl bg-white/5 border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            {bots.length === 0 ? (
              <div className="text-center py-16 text-gray-400">You haven’t created any bots yet.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {bots.map(bot => (
                  <div key={bot.id} className="rounded-2xl overflow-hidden border border-white/5 bg-[#12121a] shadow-lg shadow-black/20">
                    <button
                      onClick={() => navigate(`/chat/${bot.id}`)}
                      className="block w-full text-left group"
                    >
                      <div className="aspect-[4/5] bg-black/30 overflow-hidden">
                        {bot.imageURL ? (
                          <img src={bot.imageURL} alt={bot.name || 'Bot'} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600">
                            <span className="material-icons-outlined">image</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="text-sm font-semibold text-gray-100 line-clamp-1">{bot.name || 'Unnamed'}</h3>
                        <p className="mt-1 text-[11px] text-gray-500 line-clamp-2">{bot.personality || '—'}</p>
                      </div>
                    </button>

                    <div className="p-3 pt-0 flex items-center justify-between gap-2">
                      <button
                        onClick={() => navigate(`/create?edit=${bot.id}`)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(bot.id, bot.name || 'this bot')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Load more */}
            {bots.length > 0 && (
              <div className="flex items-center justify-center mt-8">
                {hasMore ? (
                  <button
                    onClick={fetchMore}
                    disabled={loadingMore}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 disabled:opacity-60"
                  >
                    {loadingMore ? 'Loading...' : 'Load more'}
                  </button>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
