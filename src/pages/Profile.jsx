import { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestoreServices } from '../utils/firebaseClient';
import { useAuth } from '../contexts/AuthContext';
import { warmBotAssets } from '../utils/assetCache';
import { filterNsfw } from '../utils/contentRating';
import AvatarWithBorder from '../components/AvatarWithBorder';
import ReportModal from '../components/ReportModal';

// Ensures a social link value is a proper external URL.
// If the user entered just a username, prepend the platform's base URL.
const socialBaseUrls = {
  twitter: 'https://twitter.com/',
  github: 'https://github.com/',
  youtube: 'https://youtube.com/@',
  instagram: 'https://instagram.com/',
  twitch: 'https://twitch.tv/',
  reddit: 'https://reddit.com/u/',
  website: 'https://',
};

function ensureSocialUrl(platform, value) {
  if (!value) return value;
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = socialBaseUrls[platform];
  if (!base) return trimmed;
  // Strip leading @ or / from usernames
  const cleaned = trimmed.replace(/^[@/]+/, '');
  return base + cleaned;
}

export default function Profile() {
  const { userId } = useParams();
  const { user: currentUser, userData, isOwner, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState(null);
  const [userBots, setUserBots] = useState([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [botsLoading, setBotsLoading] = useState(true);
  const [botsError, setBotsError] = useState(null);
  const [loadAllBots, setLoadAllBots] = useState(false);
  const [hasMoreBots, setHasMoreBots] = useState(false);
  const [devVerifyRequesting, setDevVerifyRequesting] = useState(false);
  const [devVerifyMessage, setDevVerifyMessage] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);

  // Use the ID from params, or current user if no params (e.g. /profile/me)
  const targetId = userId === 'me' ? currentUser?.uid : userId;

  useEffect(() => {
    setLoadAllBots(false);
  }, [targetId]);

  useEffect(() => {
    let cancelled = false;
    async function fetchProfile() {
      if (!targetId) {
        setProfileLoading(false);
        setBotsLoading(false);
        return;
      }

      setProfileLoading(true);
      setBotsLoading(true);
      setBotsError(null);

      try {
        // Fetch User Data
        const { db, firestoreModule } = await getFirestoreServices();
        const { doc, getDoc } = firestoreModule;
        const userRef = doc(db, 'users', targetId);
        const userSnap = await getDoc(userRef);

        if (cancelled) return;

        if (userSnap.exists()) {
          setProfileUser(userSnap.data());
        } else {
          // User not found
          setProfileUser(null);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching profile:", error);
          setProfileUser(null);
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }

      try {
        // Fetch User's Bots (limit initial load)
        const { db, firestoreModule } = await getFirestoreServices();
        const { collection, query, where, getDocs, limit } = firestoreModule;
        const botsRef = collection(db, 'characters');
        const initialLimit = 24;
        const fetchLimit = loadAllBots ? null : initialLimit + 1;
        const q = fetchLimit
          ? query(botsRef, where('creatorId', '==', targetId), limit(fetchLimit))
          : query(botsRef, where('creatorId', '==', targetId));
        const querySnapshot = await getDocs(q);
        if (cancelled) return;
        const bots = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        warmBotAssets(bots.map(bot => bot.imageURL));

        // Sort client-side by createdAt (desc) when available
        bots.sort((a, b) => {
          const timeA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
          const timeB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
          return timeB - timeA;
        });

        if (fetchLimit) {
          setHasMoreBots(bots.length > initialLimit);
          setUserBots(bots.slice(0, initialLimit));
        } else {
          setHasMoreBots(false);
          setUserBots(bots);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching profile bots:", error);
          setBotsError('Failed to load bots. Please try again.');
          setUserBots([]);
        }
      } finally {
        if (!cancelled) setBotsLoading(false);
      }
    }

    fetchProfile();
    return () => { cancelled = true; };
  }, [targetId, loadAllBots]);

  const visibleBots = useMemo(
    () => filterNsfw(userBots, !!userData?.nsfwEnabled),
    [userBots, userData?.nsfwEnabled]
  );

  const requestVerifiedDev = async () => {
    if (!currentUser || currentUser.uid !== profileUser.uid) return;
    if (profileUser.isVerifiedDev) return;
    if (profileUser.verifiedDevRequestStatus === 'pending') return;

    if (!window.confirm("Request Verified Bot Dev status? An admin will review your profile.")) return;

    setDevVerifyRequesting(true);
    setDevVerifyMessage(null);
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { doc, setDoc, updateDoc, serverTimestamp } = firestoreModule;

      // Create/update request doc (admin panel reads pending requests)
      await setDoc(doc(db, 'verifiedDevRequests', currentUser.uid), {
        uid: currentUser.uid,
        displayName: profileUser.displayName || currentUser.displayName || '',
        email: profileUser.email || currentUser.email || '',
        photoURL: profileUser.photoURL || currentUser.photoURL || '',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Mirror status on the user doc for easy rendering in profile
      await updateDoc(doc(db, 'users', currentUser.uid), {
        verifiedDevRequestStatus: 'pending',
        verifiedDevRequestedAt: serverTimestamp()
      });

      setProfileUser(prev => ({
        ...prev,
        verifiedDevRequestStatus: 'pending'
      }));
      setDevVerifyMessage({ type: 'success', text: 'Request sent. Awaiting admin review.' });
    } catch (e) {
      console.error('Failed to request verified dev:', e);
      setDevVerifyMessage({ type: 'error', text: 'Failed to send request. Please try again.' });
    } finally {
      setDevVerifyRequesting(false);
    }
  };


  if (authLoading && userId === 'me') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6">
        <div className="w-full max-w-3xl space-y-4">
          <div className="skeleton h-48 w-full rounded-2xl" />
          <div className="flex gap-4">
            <div className="skeleton w-24 h-24 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-5 w-48" />
              <div className="skeleton h-4 w-32" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6">
        <div className="w-full max-w-3xl space-y-4">
          <div className="skeleton h-48 w-full rounded-2xl" />
          <div className="flex gap-4">
            <div className="skeleton w-24 h-24 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-5 w-48" />
              <div className="skeleton h-4 w-32" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-gray-400">
        <span className="material-icons-outlined text-6xl mb-4">error_outline</span>
        <h2 className="text-2xl font-semibold">User not found</h2>
      </div>
    );
  }

  // Check if this is the current user's profile or if the viewer is an owner/admin
  // Note: isOwner() checks if the *current logged in user* is the owner
  const canEdit = currentUser?.uid === profileUser.uid || isOwner(); 
  // Wait, isOwner() check might be for the platform owner, not the profile owner. 
  // Let's assume isOwner() means "Platform Owner". 
  // The user themselves can always edit their own profile.

  const isPlatformOwner = profileUser.roles?.includes('owner');
  const themeColor = profileUser.theme || 'violet'; // Default theme

  return (
    <div className="min-h-full bg-[#0a0a0f] pb-20">
      {/* Banner */}
      <div className="h-48 md:h-64 w-full bg-gray-800 relative overflow-hidden">
        {profileUser.bannerURL ? (
          <img 
            src={profileUser.bannerURL} 
            alt="Profile Banner" 
            loading="eager"
            fetchpriority="high"
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-r from-${themeColor}-900 to-gray-900`}></div>
        )}
        
        {/* Edit Button (Absolute) */}
        {canEdit && (
           <button 
             onClick={() => navigate(`/profile/edit`)} // Assuming /profile/edit edits *my* profile
             className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white px-4 py-2 rounded-full backdrop-blur-sm transition-all flex items-center gap-2"
           >
             <span className="material-icons-outlined text-sm">edit</span>
             <span>Edit Profile</span>
           </button>
        {!canEdit && currentUser && (
          <button
            onClick={() => {
              setReportTarget({
                targetType: 'user',
                targetId: profileUser.uid,
                targetName: profileUser.displayName || profileUser.username || '',
                targetOwnerId: profileUser.uid
              });
              setReportOpen(true);
            }}
            className="absolute top-4 right-4 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 px-4 py-2 rounded-full backdrop-blur-sm transition-all flex items-center gap-2 border border-rose-500/20"
          >
            <span className="material-icons-outlined text-sm">report</span>
            <span>Report</span>
          </button>
        )}
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-16 sm:-mt-24 mb-6">
          {/* Profile Header */}
          <div className="flex flex-col md:flex-row items-start md:items-end gap-6">
            {/* PFP */}
            <AvatarWithBorder
              src={profileUser.photoURL}
              alt={profileUser.displayName}
              borderId={profileUser.avatarBorderId}
              size="w-32 h-32 sm:w-40 sm:h-40"
              className={`border-4 border-[#0a0a0f] shadow-xl ${isPlatformOwner ? 'ring-4 ring-yellow-500/50' : ''}`}
              imgClassName="w-full h-full"
/>

            {/* Info */}
            <div className="flex-1 min-w-0 pt-2 md:pb-4">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className={`text-3xl font-bold truncate ${profileUser.email === 'evvyxan@gmail.com' ? 'janitor-text' : 'text-white'}`}>{profileUser.displayName || 'Anonymous'}</h1>
                {isPlatformOwner && (
                  <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                    <span className="material-icons-outlined text-xs">verified</span> Owner
                  </span>
                )}
                {profileUser.roles?.includes('head_admin') && (
                  <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                    <span className="material-icons-outlined text-xs">admin_panel_settings</span> Head Admin
                  </span>
                )}
                {profileUser.roles?.includes('admin') && !profileUser.roles?.includes('head_admin') && !isPlatformOwner && (
                  <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                    <span className="material-icons-outlined text-xs">shield</span> Admin
                  </span>
                )}
                {profileUser.roles?.includes('mod') && !profileUser.roles?.includes('admin') && !profileUser.roles?.includes('head_admin') && !isPlatformOwner && (
                  <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                    <span className="material-icons-outlined text-xs">gavel</span> Mod
                  </span>
                )}
                )}
                {profileUser.isVerifiedDev && (
                  <span className="bg-sky-500/15 text-sky-200 border border-sky-500/30 px-2 py-0.5 rounded text-xs font-bold inline-flex items-center gap-1">
                    <span className="material-icons-outlined text-xs" aria-hidden="true">verified</span>
                    Verified Dev
                  </span>
                )}
                {profileUser.badge?.name && (
                  <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded text-xs font-bold inline-flex items-center gap-1">
                    <span aria-hidden="true">{profileUser.badge.icon || '🎖️'}</span>
                    {profileUser.badge.name}
                  </span>
                )}
                {profileUser.level && (
                  <span className="bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded text-xs font-bold">
                    Lvl {profileUser.level}
                  </span>
                )}
              </div>
              <p className="text-gray-400 max-w-2xl">{profileUser.bio || "No bio yet."}</p>

              {/* Verified Dev Request */}
              {canEdit && currentUser?.uid === profileUser.uid && !profileUser.isVerifiedDev && (
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  {profileUser.verifiedDevRequestStatus === 'pending' ? (
                    <span className="bg-white/5 border border-white/10 text-gray-300 px-3 py-2 rounded-xl text-sm inline-flex items-center gap-2">
                      <span className="material-icons-outlined text-base">hourglass_top</span>
                      Verified Dev request pending
                    </span>
                  ) : (
                    <button
                      onClick={requestVerifiedDev}
                      disabled={devVerifyRequesting}
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold transition-colors inline-flex items-center gap-2 w-fit"
                    >
                      <span className="material-icons-outlined text-base">verified</span>
                      {devVerifyRequesting ? 'Sending...' : 'Request Verified Bot Dev'}
                    </button>
                  )}

                  {devVerifyMessage && (
                    <div className={`text-sm ${devVerifyMessage.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                      {devVerifyMessage.text}
                    </div>
                  )}
                </div>
              )}
              
              {/* Socials */}
              {profileUser.social_links && (
                <div className="flex flex-wrap gap-3 mt-3">
                   {profileUser.social_links.twitter && (
                     <a href={ensureSocialUrl('twitter', profileUser.social_links.twitter)} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#1DA1F2] transition-colors text-sm"><i className="fab fa-twitter"></i> Twitter</a>
                   )}
                   {profileUser.social_links.discord && (
                     <span className="text-gray-400 text-sm"><i className="fab fa-discord text-[#5865F2]"></i> {profileUser.social_links.discord}</span>
                   )}
                   {profileUser.social_links.github && (
                     <a href={ensureSocialUrl('github', profileUser.social_links.github)} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors text-sm"><i className="fab fa-github"></i> GitHub</a>
                   )}
                   {profileUser.social_links.youtube && (
                     <a href={ensureSocialUrl('youtube', profileUser.social_links.youtube)} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#FF0000] transition-colors text-sm"><i className="fab fa-youtube"></i> YouTube</a>
                   )}
                   {profileUser.social_links.instagram && (
                     <a href={ensureSocialUrl('instagram', profileUser.social_links.instagram)} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#E1306C] transition-colors text-sm"><i className="fab fa-instagram"></i> Instagram</a>
                   )}
                   {profileUser.social_links.twitch && (
                     <a href={ensureSocialUrl('twitch', profileUser.social_links.twitch)} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#9146FF] transition-colors text-sm"><i className="fab fa-twitch"></i> Twitch</a>
                   )}
                   {profileUser.social_links.reddit && (
                     <a href={ensureSocialUrl('reddit', profileUser.social_links.reddit)} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#FF4500] transition-colors text-sm"><i className="fab fa-reddit"></i> Reddit</a>
                   )}
                   {profileUser.social_links.website && (
                     <a href={ensureSocialUrl('website', profileUser.social_links.website)} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-violet-400 transition-colors text-sm"><span className="material-icons-outlined text-sm align-middle">language</span> Website</a>
                   )}
                </div>
              )}
            </div>

            {/* Stats / XP */}
            <div className="w-full md:w-64 bg-[#12121a] rounded-xl p-4 border border-white/5">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">XP Progress</span>
                <span className="text-white font-mono">{profileUser.xp || 0} / {(profileUser.level || 1) * 1000}</span>
              </div>
              <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-${themeColor}-500`} 
                  style={{ width: `${Math.min(100, ((profileUser.xp || 0) / ((profileUser.level || 1) * 1000)) * 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between mt-4 text-center">
                 <div>
                   <div className="text-lg font-bold text-white">{userBots.length}</div>
                   <div className="text-xs text-gray-500">Bots</div>
                 </div>
                 <div>
                   <div className="text-lg font-bold text-white">{profileUser.stats?.likes_received || 0}</div>
                   <div className="text-xs text-gray-500">Likes</div>
                 </div>
                 <div>
                   <div className="text-lg font-bold text-white">{profileUser.stats?.messages_sent || 0}</div>
                   <div className="text-xs text-gray-500">Msgs</div>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
          
          {/* Main Content: Bots */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="material-icons-outlined">smart_toy</span>
              Created Bots
            </h2>
            
            {botsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="skeleton h-36 w-full rounded-xl" />
                ))}
              </div>
            ) : botsError ? (
              <div className="text-center py-10 bg-[#12121a] rounded-2xl border border-white/5">
                <span className="material-icons-outlined text-4xl text-red-400 mb-3 block">error_outline</span>
                <p className="text-gray-300 font-medium">{botsError}</p>
              </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {visibleBots.map(bot => (
                <div key={bot.id} onClick={() => navigate(`/chat/${bot.id}`)} className="bg-[#12121a] border border-white/5 rounded-xl p-4 hover:border-violet-500/30 transition-all cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg bg-gray-800 overflow-hidden shrink-0">
                      {bot.imageURL ? (
                        <img
                          src={bot.imageURL}
                          alt={bot.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                        />
                      ) : (
                        <span className="material-icons-outlined text-gray-600">smart_toy</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white truncate">{bot.name}</h3>
                      <p className="text-xs text-gray-400 line-clamp-2">{bot.description}</p>
                    </div>
                  </div>
                </div>
              ))}
              {visibleBots.length === 0 && (
                <p className="text-gray-500 col-span-full italic">No bots created yet.</p>
              )}
            </div>
            )}
            {!botsLoading && !botsError && hasMoreBots && !loadAllBots && (
              <div className="pt-4">
                <button
                  onClick={() => setLoadAllBots(true)}
                  className="text-sm text-violet-300 hover:text-violet-200"
                >
                  Load all bots
                </button>
              </div>
            )}
          </div>

          {/* Sidebar: Personas */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="material-icons-outlined">face</span>
              Personas
            </h2>
            <div className="space-y-3">
              {profileUser.persona_list && profileUser.persona_list.map((persona, idx) => (
                <div key={idx} className="bg-[#12121a] border border-white/5 rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden shrink-0">
                      {persona.avatar ? (
                        <img
                          src={persona.avatar}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="material-icons-outlined text-gray-600 text-sm">person</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{persona.name}</h4>
                      <p className="text-xs text-gray-500 line-clamp-1">{persona.description}</p>
                    </div>
                  </div>
                </div>
              ))}
              {(!profileUser.persona_list || profileUser.persona_list.length === 0) && (
                <p className="text-gray-500 text-sm italic">No personas created.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} target={reportTarget} />
    </div>
  );
}
