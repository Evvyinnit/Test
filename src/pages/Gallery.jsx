import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFirestoreServices } from '../utils/firebaseClient';
import { useAuth } from '../contexts/AuthContext';
import { filterNsfw } from '../utils/contentRating';
import { warmBotAssets } from '../utils/assetCache';

export default function Gallery() {
  const [sortBy, setSortBy] = useState('new'); // 'new' | 'top' | 'all'
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState(null);

  const navigate = useNavigate();
  const { userData } = useAuth();

  // Server-side pagination to avoid loading every bot at once
  const pageSize = 12;

  const buildQuery = useCallback(async (afterDoc = null) => {
    const { db, firestoreModule } = await getFirestoreServices();
    const { collection, query, where, orderBy, limit, startAfter, startAt, endAt } = firestoreModule;

    const colRef = collection(db, 'characters');

    const rawTerm = search.trim();
    const isTagSearch = rawTerm.startsWith('#');
    const tagFromSearch = isTagSearch ? slugifyTag(rawTerm) : null;

    const activeTag = selectedTag || tagFromSearch;
    const textTerm = !activeTag && rawTerm ? rawTerm.toLowerCase() : null;

    let q;

    if (activeTag) {
      // Tag-based browse/search
      if (sortBy === 'top' || sortBy === 'all') {
        q = query(
          colRef,
          where('tagSlugs', 'array-contains', activeTag),
          orderBy('views', 'desc'),
          orderBy('createdAt', 'desc'),
          limit(pageSize)
        );
      } else {
        q = query(
          colRef,
          where('tagSlugs', 'array-contains', activeTag),
          orderBy('createdAt', 'desc'),
          limit(pageSize)
        );
      }
    } else if (textTerm) {
      // Lightweight prefix search by nameLower (requires nameLower in docs)
      const endTerm = textTerm + '\uf8ff';
      q = query(
        colRef,
        orderBy('nameLower'),
        startAt(textTerm),
        endAt(endTerm),
        limit(pageSize)
      );
    } else {
      // Default feeds
      if (sortBy === 'top' || sortBy === 'all') {
        q = query(colRef, orderBy('views', 'desc'), orderBy('createdAt', 'desc'), limit(pageSize));
      } else {
        q = query(colRef, orderBy('createdAt', 'desc'), limit(pageSize));
      }
    }

    if (afterDoc) {
      // Rebuild with cursor
      if (activeTag) {
        if (sortBy === 'top' || sortBy === 'all') {
          q = query(
            colRef,
            where('tagSlugs', 'array-contains', activeTag),
            orderBy('views', 'desc'),
            orderBy('createdAt', 'desc'),
            startAfter(afterDoc),
            limit(pageSize)
          );
        } else {
          q = query(
            colRef,
            where('tagSlugs', 'array-contains', activeTag),
            orderBy('createdAt', 'desc'),
            startAfter(afterDoc),
            limit(pageSize)
          );
        }
      } else if (textTerm) {
        const endTerm = textTerm + '\uf8ff';
        q = query(
          colRef,
          orderBy('nameLower'),
          startAt(textTerm),
          endAt(endTerm),
          startAfter(afterDoc),
          limit(pageSize)
        );
      } else {
        if (sortBy === 'top' || sortBy === 'all') {
          q = query(colRef, orderBy('views', 'desc'), orderBy('createdAt', 'desc'), startAfter(afterDoc), limit(pageSize));
        } else {
          q = query(colRef, orderBy('createdAt', 'desc'), startAfter(afterDoc), limit(pageSize));
        }
      }
    }

    return { db, firestoreModule, q, activeTag, textTerm };
  }, [sortBy, search, selectedTag]);


  const fetchFirstPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    setItems([]);
    setCursor(null);
    setHasMore(true);
    setPage(1);

    try {
      const { firestoreModule, q } = await buildQuery(null);
      const { getDocs } = firestoreModule;
      const snap = await getDocs(q);

      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(data);
      warmBotAssets(data.map(item => item.imageURL), { max: 24 });

      const last = snap.docs[snap.docs.length - 1] || null;
      setCursor(last);
      setHasMore(snap.docs.length === pageSize);
    } catch (err) {
      console.error('Error loading gallery:', err);
      setError('Failed to load bots. Please try again.');
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  const fetchNextPage = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setError(null);

    try {
      const { firestoreModule, q } = await buildQuery(cursor);
      const { getDocs } = firestoreModule;
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      setItems(prev => [...prev, ...data]);
      warmBotAssets(data.map(item => item.imageURL), { max: 24 });

      const last = snap.docs[snap.docs.length - 1] || cursor;
      setCursor(last);
      setHasMore(snap.docs.length === pageSize);
      setPage(p => p + 1);
    } catch (err) {
      console.error('Error loading more bots:', err);
      setError('Failed to load more bots.');
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [buildQuery, cursor, hasMore, loadingMore]);

  
  const fetchTags = useCallback(async () => {
    setTagLoading(true);
    setTagError(null);
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { collection, query, orderBy, limit, getDocs } = firestoreModule;
      const q = query(collection(db, 'tags'), orderBy('count', 'desc'), orderBy('lastUsedAt', 'desc'), limit(200));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t?.id);
      setTagList(data);
    } catch (e) {
      console.error('Failed to load tags:', e);
      setTagError('Failed to load tags.');
    } finally {
      setTagLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showTags) fetchTags();
  }, [showTags, fetchTags]);
useEffect(() => {
    const t = setTimeout(() => {
      fetchFirstPage();
    }, 350);
    return () => clearTimeout(t);
  }, [fetchFirstPage, sortBy, search, selectedTag]);

  // Client-side filtering (over already-loaded pages)
  const visibleItems = useMemo(
    () => filterNsfw(items, !!userData?.nsfwEnabled),
    [items, userData?.nsfwEnabled]
  );

  const filteredItems = useMemo(() => {
    // Search is now server-side (by name prefix or #tag). Keep only NSFW filtering client-side.
    return visibleItems;
  }, [visibleItems]);

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num;
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0f]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Search Header */}
        <div className="flex flex-col md:flex-row gap-6 mb-8 items-center justify-between">
          <div className="relative w-full md:max-w-xl group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="material-icons-outlined text-gray-500 group-focus-within:text-violet-500 transition-colors">search</span>
            </div>
            <input
              type="text"
              placeholder="Search bots or #tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#12121a] border border-white/5 rounded-2xl py-3.5 pl-11 pr-4 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25 transition-all shadow-lg shadow-black/20"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedTag && (
                <button
                  onClick={() => setSelectedTag(null)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs bg-violet-500/15 border border-violet-500/25 text-violet-200"
                  title="Clear tag filter"
                >
                  <span>#{selectedTag}</span>
                  <span className="material-icons-outlined text-[16px]">close</span>
                </button>
              )}
              {search.trim().startsWith('#') && !selectedTag && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300">
                  Tip: press <span className="mx-1 text-gray-100">Tags</span> to browse similar tags
                </span>
              )}
            </div>

            
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            {/* Sort */}
            <div className="flex bg-[#12121a] p-1 rounded-xl border border-white/5 shrink-0">
              <button
                onClick={() => setSortBy('new')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${sortBy === 'new' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                New
              </button>
              <button
                onClick={() => setSortBy('top')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${sortBy === 'top' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Top
              </button>
              <button
                onClick={() => setSortBy('all')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${sortBy === 'all' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                All Time
              </button>
            </div>

            <button
              onClick={() => setShowTags(true)}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 shrink-0"
              title="Browse tags"
            >
              Tags
            </button>

            <button
              onClick={fetchFirstPage}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 shrink-0"
              title="Refresh list"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-white/5 border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-gray-300 mb-4">{error}</p>
            <button
              onClick={() => setShowTags(true)}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 shrink-0"
              title="Browse tags"
            >
              Tags
            </button>

            <button
              onClick={fetchFirstPage}
              className="px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-200 hover:bg-violet-500/25"
            >
              Try again
            </button>
          </div>
        ) : (
          <div>
            {filteredItems.length === 0 ? (
              <div className="text-center py-16 text-gray-400">No bots found.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/chat/${item.id}`)}
                    className="text-left group rounded-2xl overflow-hidden border border-white/5 bg-[#12121a] hover:bg-[#151520] hover:border-white/10 transition-all shadow-lg shadow-black/20"
                  >
                    <div className="aspect-[4/5] bg-black/30 overflow-hidden">
                      {item.imageURL ? (
                        <img
                          src={item.imageURL}
                          alt={item.name || 'Bot'}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600">
                          <span className="material-icons-outlined">image</span>
                        </div>
                      )}
                    </div>

                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-gray-100 line-clamp-1">{item.name || 'Unnamed'}</h3>
                        <span className="text-[10px] text-gray-500 shrink-0">{formatNumber(item.views || item.chatCount || 0)}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-gray-500 line-clamp-2">{item.personality || '—'}</p>
                      {Array.isArray(item.tags) && item.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.tags.slice(0, 3).map((t) => (
                            <span key={t} className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 border border-white/10 text-gray-300">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.creatorName && (
                        <p className="mt-2 text-[10px] text-gray-600 line-clamp-1">by {item.creatorName}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Load more */}
            <div className="flex items-center justify-center gap-3 mt-8">
              {hasMore ? (
                <button
                  onClick={fetchNextPage}
                  disabled={loadingMore}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 disabled:opacity-60"
                >
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              ) : (
                <p className="text-xs text-gray-500">You’ve reached the end.</p>
              )}
              {!loading && (
                <span className="text-xs text-gray-600">Loaded: {items.length}{hasMore ? ` (page ${page})` : ''}</span>
              )}
            </div>
          </div>
        )}
      </div>


      {/* Tags Modal */}
      {showTags && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <button
            className="absolute inset-0 bg-black/70"
            onClick={() => setShowTags(false)}
            aria-label="Close tags"
          />
          <div className="relative w-full sm:max-w-2xl max-h-[85dvh] overflow-hidden rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0f0f16] shadow-2xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-100">Browse Tags</h3>
                <p className="text-[11px] text-gray-500">Pick a tag to filter bots (like Janitor-style).</p>
              </div>
              <button
                onClick={() => setShowTags(false)}
                className="p-2 rounded-xl hover:bg-white/5 text-gray-300"
                aria-label="Close"
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[70dvh]">
              {tagLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="h-9 rounded-xl bg-white/5 border border-white/5 animate-pulse" />
                  ))}
                </div>
              ) : tagError ? (
                <div className="text-center py-10">
                  <p className="text-gray-300 mb-3">{tagError}</p>
                  <button
                    onClick={fetchTags}
                    className="px-3 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200"
                  >
                    Retry
                  </button>
                </div>
              ) : tagList.length ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {tagList.map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTag(t.id);
                        setSearch('');
                        setShowTags(false);
                      }}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left"
                      title={`#${t.id}`}
                    >
                      <span className="text-xs text-gray-100 truncate">#{t.id}</span>
                      <span className="text-[10px] text-gray-500 shrink-0">{t.count || 0}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-gray-400 py-12">No tags yet. Create a bot with tags to get started.</p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
