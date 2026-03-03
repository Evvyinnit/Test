import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFirestoreServices } from '../utils/firebaseClient';
import { warmBotAssets } from '../utils/assetCache';
import AvatarWithBorder from '../components/AvatarWithBorder';

export default function Members() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchMembers() {
      setLoading(true);
      try {
        // Fetch users, limit to 100 for now to prevent massive reads
        // In a real app, we'd paginate.
        const { db, firestoreModule } = await getFirestoreServices();
        const { collection, query, limit, getDocs } = firestoreModule;
        const q = query(collection(db, 'users'), limit(100)); 
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Sort by joined date if available, or name
        data.sort((a, b) => {
             const timeA = a.createdAt?.toDate ? a.createdAt.toDate() : 0;
             const timeB = b.createdAt?.toDate ? b.createdAt.toDate() : 0;
             return timeB - timeA;
        });

        setUsers(data);
        warmBotAssets(data.map(member => member.photoURL));
      } catch (err) {
        console.error('Error fetching members:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMembers();
  }, []);

  const filteredUsers = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return users.filter(user => (
      (user.displayName && user.displayName.toLowerCase().includes(search)) ||
      (user.email && user.email.toLowerCase().includes(search))
    ));
  }, [users, searchTerm]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Community Members</h1>
            <p className="text-gray-400">Discover and connect with other creators</p>
          </div>
          
          <div className="relative w-full md:w-64">
            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">search</span>
            <input 
              type="text" 
              placeholder="Search members..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#12121a] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="bg-[#12121a] border border-white/5 rounded-xl p-4 flex items-center gap-4">
                <div className="skeleton w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-32" />
                  <div className="skeleton h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16 bg-[#12121a] rounded-2xl border border-white/5">
            <span className="material-icons-outlined text-5xl text-gray-600 mb-3 block">group_off</span>
            <p className="text-gray-300 font-medium mb-1">No members found</p>
            <p className="text-gray-500 text-sm">Try adjusting your search query</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredUsers.map((user) => (
              <div 
                key={user.id}
                onClick={() => navigate(`/profile/${user.id}`)}
                className="group bg-[#12121a] border border-white/5 rounded-xl p-4 hover:border-violet-500/30 hover:bg-white/5 transition-all cursor-pointer flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-full bg-gray-800 overflow-hidden shrink-0 border-2 border-transparent group-hover:border-violet-500/50 transition-colors">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-violet-900/20 text-violet-300 font-bold text-lg">
                      {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
                    </div>
                  )}
                </div>
                
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className={`font-semibold truncate ${user.email === 'evvyxan@gmail.com' ? 'janitor-text' : 'text-white'}`}>
                      {user.displayName || 'Anonymous'}
                    </h3>
                    {user.isVerifiedDev && (
                      <span className="material-icons-outlined text-[14px] text-sky-400" title="Verified Bot Dev">verified</span>
                    )}
                    {user.roles?.includes('owner') && (
                      <span className="material-icons-outlined text-[14px] text-yellow-400" title="Owner">verified</span>
                    )}
                    {user.roles?.includes('head_admin') && !user.roles?.includes('owner') && (
                      <span className="material-icons-outlined text-[14px] text-red-500" title="Head Admin">security</span>
                    )}
                    {user.roles?.includes('admin') && !user.roles?.includes('owner') && !user.roles?.includes('head_admin') && (
                      <span className="material-icons-outlined text-[14px] text-blue-400" title="Admin">shield</span>
                    )}
                    {user.roles?.includes('mod') && !user.roles?.includes('owner') && !user.roles?.includes('head_admin') && !user.roles?.includes('admin') && (
                      <span className="material-icons-outlined text-[14px] text-green-400" title="Moderator">gavel</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    Joined {user.createdAt?.toDate ? new Date(user.createdAt.toDate()).toLocaleDateString() : 'Recently'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
