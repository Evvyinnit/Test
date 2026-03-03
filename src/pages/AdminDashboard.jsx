import { useState, useEffect } from 'react';
import { getFirestoreServices } from '../utils/firebaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { warmBotAssets } from '../utils/assetCache';
import { clampLevel, getBadgeForLevel, getAvatarBorderForLevel, getUnlockedAvatarBorders, MAX_LEVEL } from '../utils/levelSystem';
import TagInput from '../components/TagInput';
import { slugifyTag, uniqueTags } from '../utils/tagUtils';

function UserEditModal({ user, onClose, onSave }) {
  const [formData, setFormData] = useState({
    roles: user.roles || [],
    level: user.level || 1,
    xp: user.xp || 0,
    isVerifiedDev: !!user.isVerifiedDev
  });

  const availableRoles = ['user', 'mod', 'admin', 'head_admin', 'owner'];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'roles') {
      const role = value;
      setFormData(prev => {
        const newRoles = checked
          ? [...prev.roles, role]
          : prev.roles.filter(r => r !== role);
        return { ...prev, roles: newRoles };
      });
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'number' ? Number(value) : type === 'checkbox' ? checked : value
      }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-[#12121a] border border-white/10 rounded-2xl w-full max-w-md p-6 relative shadow-2xl shadow-violet-500/10">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
        <h2 className="text-xl font-bold text-white mb-6">Edit User: {user.displayName || 'No Name'}</h2>
        
        <form onSubmit={(e) => { e.preventDefault(); onSave(user.id, formData); }}>
          
          <div className="mb-6">
            <label className="block text-gray-400 text-sm mb-3 font-medium">Roles</label>
            <div className="flex flex-wrap gap-2">
              {availableRoles.map(role => (
                <label key={role} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition-all duration-200 ${formData.roles.includes(role) ? 'bg-violet-600/20 border-violet-500/50' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                  <input 
                    type="checkbox" 
                    name="roles" 
                    value={role}
                    checked={formData.roles.includes(role)}
                    onChange={handleChange}
                    className="accent-violet-500 w-4 h-4"
                  />
                  <span className={`text-sm capitalize ${formData.roles.includes(role) ? 'text-violet-200' : 'text-gray-300'}`}>{role.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-gray-400 text-sm mb-2 font-medium">Level</label>
              <input 
                type="number" 
                name="level" 
                value={formData.level}
                onChange={handleChange}
                min="1"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2 font-medium">XP</label>
              <input 
                type="number" 
                name="xp" 
                value={formData.xp}
                onChange={handleChange}
                min="0"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
                    <div className="mb-6">
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border bg-white/5 border-white/5 hover:bg-white/10 transition-all duration-200">
              <input
                type="checkbox"
                name="isVerifiedDev"
                checked={!!formData.isVerifiedDev}
                onChange={handleChange}
                className="accent-sky-500 w-4 h-4"
              />
              <span className="text-sm text-gray-300">Verified Bot Dev</span>
            </label>
          </div>

</div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors font-medium"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors shadow-lg shadow-violet-500/20"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


function BotEditModal({ bot, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: bot.name || '',
    description: bot.description || '',
    tags: bot.tags || [],
    visibility: bot.visibility || 'public',
    contentRating: bot.contentRating || 'sfw',
    isFeatured: !!bot.isFeatured,
  });

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-[#12121a] border border-white/10 rounded-2xl w-full max-w-2xl p-6 relative shadow-2xl shadow-violet-500/10 max-h-[90dvh] overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
        <h2 className="text-xl font-bold text-white mb-2">Edit Bot</h2>
        <div className="text-xs text-gray-500 mb-6 break-all">
          ID: {bot.id} • Creator: {bot.creatorName || bot.creatorId || 'unknown'}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSave(bot, formData); }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2 font-medium">Name</label>
              <input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors"
                placeholder="Bot name"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2 font-medium">Visibility</label>
              <select
                value={formData.visibility}
                onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value }))}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors"
              >
                <option value="public">public</option>
                <option value="unlisted">unlisted</option>
                <option value="private">private</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-gray-400 text-sm mb-2 font-medium">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors"
              placeholder="Short description"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2 font-medium">Content Rating</label>
              <select
                value={formData.contentRating}
                onChange={(e) => setFormData(prev => ({ ...prev, contentRating: e.target.value }))}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors"
              >
                <option value="sfw">sfw</option>
                <option value="nsfw">nsfw</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border bg-white/5 border-white/5 hover:bg-white/10 transition-all duration-200 w-full">
                <input
                  type="checkbox"
                  checked={!!formData.isFeatured}
                  onChange={(e) => setFormData(prev => ({ ...prev, isFeatured: e.target.checked }))}
                  className="accent-yellow-500 w-4 h-4"
                />
                <span className="text-sm text-gray-300">Featured</span>
              </label>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-gray-400 text-sm mb-2 font-medium">Tags</label>
            <TagInput
              value={formData.tags}
              onChange={(tags) => setFormData(prev => ({ ...prev, tags }))}
              placeholder="Add tags (press Enter or comma)"
            />
            <div className="text-[11px] text-gray-500 mt-2">
              Admin can add/remove tags here. Tags are synced into the global tag list.
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors font-medium"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors shadow-lg shadow-violet-500/20"
            >
              Save Bot
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'bots', 'verifications', 'feedback', 'reports'
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingBot, setEditingBot] = useState(null);
  const [pendingVerifyCount, setPendingVerifyCount] = useState(0);
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [busyAction, setBusyAction] = useState(null); // e.g. { type, userId }


  // Redirect if not admin
  useEffect(() => {
    if (user && !isAdmin()) {
      navigate('/');
    }
  }, [user, isAdmin, navigate]);

  useEffect(() => {
    fetchItems();
  }, [activeTab]);

  useEffect(() => {
    fetchVerifyCount();
    fetchFeedbackCount();
    fetchReportsCount();
    const t = setInterval(fetchVerifyCount, 30000);
    const t2 = setInterval(fetchFeedbackCount, 30000);
    const t3 = setInterval(fetchReportsCount, 30000);
    return () => { clearInterval(t); clearInterval(t2); clearInterval(t3); };
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { collection, getDocs, query, limit, where, orderBy } = firestoreModule;

      if (activeTab === 'users') {
        const q = query(collection(db, 'users'), limit(50));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setItems(data);
        warmBotAssets(data.map(item => item.photoURL));
        return;
      }

      if (activeTab === 'bots') {
        const q = query(collection(db, 'characters'), limit(50));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setItems(data);
        warmBotAssets(data.map(item => item.imageURL));
        return;
      }

      
      if (activeTab === 'feedback') {
        const q = query(
          collection(db, 'feedback'),
          orderBy('createdAt', 'desc'),
          limit(100)
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setItems(data);
        warmBotAssets(data.map(item => item.photoURL));
        return;
      }

      

      if (activeTab === 'reports') {
        const q = query(
          collection(db, 'reports'),
          orderBy('createdAt', 'desc'),
          limit(150)
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setItems(data);
        warmBotAssets(data.map(item => item.reporterPhotoURL));
        return;
      }

if (activeTab === 'verifications') {
        // Verification requests (pending)
        const q = query(
          collection(db, 'verifiedDevRequests'),
          where('status', '==', 'pending'),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setItems(data);
        warmBotAssets(data.map(item => item.photoURL));
        return;
      }

      setItems([]);
      return;
} catch (error) {
      console.error("Error fetching admin items:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVerifyCount = async () => {
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { collection, getDocs, query, where, limit } = firestoreModule;
      const q = query(collection(db, 'verifiedDevRequests'), where('status', '==', 'pending'), limit(50));
      const snap = await getDocs(q);
      setPendingVerifyCount(snap.size || snap.docs.length || 0);
    } catch (e) {
      // silent
    }
  };

  const fetchFeedbackCount = async () => {
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { collection, getDocs, query, where, limit } = firestoreModule;
      const q = query(collection(db, 'feedback'), where('status', '==', 'new'), limit(100));
      const snap = await getDocs(q);
      setPendingFeedbackCount(snap.size || snap.docs.length || 0);
    } catch (e) {
      // silent
    }
  };



  const toggleBan = async (userId, currentStatus) => {
    if (!window.confirm(`Are you sure you want to ${currentStatus ? 'unban' : 'ban'} this user?`)) return;
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { doc, updateDoc } = firestoreModule;
      await updateDoc(doc(db, 'users', userId), {
        isBanned: !currentStatus
      });
      fetchItems();
      fetchVerifyCount(); // Refresh
    } catch (error) {
      console.error("Error toggling ban:", error);
    }
  };

  const fetchReportsCount = async () => {
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { collection, getDocs, query, where, limit } = firestoreModule;
      const q = query(collection(db, 'reports'), where('status', '==', 'new'), limit(100));
      const snap = await getDocs(q);
      setPendingReportsCount(snap.size || snap.docs.length || 0);
    } catch (e) {
      // silent
    }
  };



  const handleSaveUser = async (userId, data) => {
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { doc, updateDoc } = firestoreModule;

      // Normalize + enforce caps
      const normalizedLevel = clampLevel(data.level ?? 1);
      const normalizedXp = normalizedLevel >= MAX_LEVEL ? 0 : Math.max(0, Number(data.xp ?? 0) || 0);

      const expectedBadge = getBadgeForLevel(normalizedLevel);
      const expectedMaxBorder = getAvatarBorderForLevel(normalizedLevel);
      const unlockedBorderIds = getUnlockedAvatarBorders(normalizedLevel).map(b => b.id);

      // Selection rules:
      // - If current selected is missing OR invalid for the level, pick the newest unlocked border.
      // - If user previously used the "max" border, keep them on the newest when leveling up.
      const prevMaxBorderId = data.avatarBorderMaxId || null;
      let selectedBorderId = data.avatarBorderId || null;
      if (!selectedBorderId || selectedBorderId === prevMaxBorderId || !unlockedBorderIds.includes(selectedBorderId)) {
        selectedBorderId = expectedMaxBorder.id;
      }

      const payload = {
        ...data,
        level: normalizedLevel,
        xp: normalizedXp,
        badge: expectedBadge,
        avatarBorderMaxId: expectedMaxBorder.id,
        avatarBorderId: selectedBorderId
      };

      await updateDoc(doc(db, 'users', userId), payload);
      setEditingUser(null);
      fetchItems();
      fetchVerifyCount();
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Failed to update user");
    }
  };


const handleSaveBot = async (bot, data) => {
  try {
    const { db, firestoreModule } = await getFirestoreServices();
    const { doc, updateDoc, serverTimestamp, writeBatch, setDoc, increment } = firestoreModule;

    const nextTags = uniqueTags(data.tags || []);
    const nextTagSlugs = nextTags.map(t => slugifyTag(t)).filter(Boolean);
    const prevTagSlugs = (bot.tagSlugs || (bot.tags || []).map(t => slugifyTag(t)).filter(Boolean)) || [];

    // Sync global tags counts (best-effort)
    const syncTags = async () => {
      try {
        const added = (nextTagSlugs || []).filter(s => s && !prevTagSlugs.includes(s));
        const removed = (prevTagSlugs || []).filter(s => s && !(nextTagSlugs || []).includes(s));
        if (!added.length && !removed.length) return;

        const batch = writeBatch(db);
        for (const slug of added) {
          batch.set(doc(db, 'tags', slug), {
            slug,
            name: slug.replace(/-/g, ' '),
            count: increment(1),
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          }, { merge: true });
        }
        for (const slug of removed) {
          batch.set(doc(db, 'tags', slug), {
            slug,
            name: slug.replace(/-/g, ' '),
            count: increment(-1),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }
        await batch.commit();
      } catch (e) {
        // don't block bot edits if tag sync fails
        console.warn('Tag sync failed (admin bot edit):', e);
      }
    };

    await updateDoc(doc(db, 'characters', bot.id), {
      name: (data.name || '').trim(),
      nameLower: (data.name || '').trim().toLowerCase(),
      description: (data.description || '').trim(),
      tags: nextTags,
      tagSlugs: nextTagSlugs,
      visibility: data.visibility || 'public',
      contentRating: data.contentRating || 'sfw',
      isFeatured: !!data.isFeatured,
      updatedAt: serverTimestamp(),
      updatedByAdmin: true,
    });

    await syncTags();
    setEditingBot(null);
    fetchItems();
  } catch (e) {
    console.error('Failed to save bot:', e);
    alert('Failed to save bot (check Firestore rules).');
  }
};


  const deleteChatWithBranches = async (chatId) => {
    const { db, firestoreModule } = await getFirestoreServices();
    const { collection, getDocs, deleteDoc, doc } = firestoreModule;

    // Delete branches subcollection docs if present
    try {
      const branchSnap = await getDocs(collection(db, 'chats', chatId, 'branches'));
      for (const b of branchSnap.docs) {
        await deleteDoc(doc(db, 'chats', chatId, 'branches', b.id));
      }
    } catch (e) {
      // branches may not exist / rules may block; continue with chat delete attempt
    }

    await deleteDoc(doc(db, 'chats', chatId));
  };

  const deleteUserChats = async (targetUid) => {
    const { db, firestoreModule } = await getFirestoreServices();
    const { collection, query, where, getDocs } = firestoreModule;
    const q = query(collection(db, 'chats'), where('userId', '==', targetUid));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteChatWithBranches(d.id);
    }
    return snap.size || snap.docs.length || 0;
  };

  const deleteUserBots = async (targetUid) => {
    const { db, firestoreModule } = await getFirestoreServices();
    const { collection, query, where, getDocs, deleteDoc, doc } = firestoreModule;
    const q = query(collection(db, 'characters'), where('creatorId', '==', targetUid));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(doc(db, 'characters', d.id));
    }
    return snap.size || snap.docs.length || 0;
  };

  const deleteUserComments = async (targetUid) => {
    const { db, firestoreModule } = await getFirestoreServices();
    const { collection, query, where, getDocs, deleteDoc, doc } = firestoreModule;
    const q = query(collection(db, 'comments'), where('userId', '==', targetUid));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(doc(db, 'comments', d.id));
    }
    return snap.size || snap.docs.length || 0;
  };

  const softDeleteUserAccount = async (targetUid) => {
    const { db, firestoreModule } = await getFirestoreServices();
    const { doc, updateDoc, serverTimestamp } = firestoreModule;

    await updateDoc(doc(db, 'users', targetUid), {
      isBanned: true,
      isDeleted: true,
      deletedAt: serverTimestamp(),
      // remove most PII so profile is effectively gone
      displayName: 'Deleted User',
      photoURL: '',
      email: '',
      roles: ['deleted']
    });
  };

  const handleAdminDeleteChats = async (u) => {
    if (!window.confirm(`Delete ALL chats for ${u.displayName || u.uid}? This cannot be undone.`)) return;
    try {
      setBusyAction({ type: 'delete_chats', userId: u.id });
      const count = await deleteUserChats(u.id);
      alert(`Deleted ${count} chat(s).`);
      fetchItems();
    } catch (e) {
      console.error('Failed deleting chats:', e);
      alert('Failed to delete chats (check Firestore rules).');
    } finally {
      setBusyAction(null);
    }
  };

  const handleAdminDeleteUser = async (u) => {
    if (u.id === user?.uid) {
      alert("You can't delete your own account from the admin panel.");
      return;
    }
    const ok = window.confirm(
      `SOFT DELETE user ${u.displayName || u.uid}?

This will:
- Delete their chats
- Delete their bots
- Delete their comments
- Mark the user as deleted/banned

This cannot be undone.`
    );
    if (!ok) return;

    try {
      setBusyAction({ type: 'delete_user', userId: u.id });
      await deleteUserChats(u.id);
      await deleteUserBots(u.id);
      await deleteUserComments(u.id);
      await softDeleteUserAccount(u.id);
      alert('User deleted (soft delete) + content removed.');
      fetchItems();
      fetchVerifyCount();
    } catch (e) {
      console.error('Failed deleting user:', e);
      alert('Failed to delete user (check Firestore rules).');
    } finally {
      setBusyAction(null);
    }
  };


  const deleteBot = async (botId) => {
    if (!window.confirm("Delete this bot?")) return;
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { doc, deleteDoc } = firestoreModule;
      await deleteDoc(doc(db, 'characters', botId));
      fetchItems();
    } catch (error) {
      console.error("Error deleting bot:", error);
    }
  };

  const toggleFeature = async (botId, currentStatus) => {
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { doc, updateDoc } = firestoreModule;
      await updateDoc(doc(db, 'characters', botId), {
        isFeatured: !currentStatus
      });
      fetchItems();
    } catch (error) {
      console.error("Error toggling feature:", error);
    }
  };



  
  const updateFeedbackStatus = async (feedbackId, status) => {
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { doc, updateDoc, serverTimestamp } = firestoreModule;
      await updateDoc(doc(db, 'feedback', feedbackId), {
        status,
        updatedAt: serverTimestamp(),
        resolvedAt: status === 'resolved' ? serverTimestamp() : null
      });
      fetchItems();
      fetchFeedbackCount();
    } catch (e) {
      alert(e?.message || 'Failed to update feedback.');
    }
  };

  const deleteFeedback = async (feedbackId) => {
    if (!window.confirm('Delete this feedback?')) return;
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { doc, deleteDoc } = firestoreModule;
      await deleteDoc(doc(db, 'feedback', feedbackId));
      fetchItems();
      fetchFeedbackCount();
    } catch (e) {
      alert(e?.message || 'Failed to delete feedback.');
    }
  };

const approveVerifiedDev = async (request) => {
    if (!window.confirm(`Approve Verified Bot Dev for ${request.displayName || request.email || request.uid}?`)) return;
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { doc, updateDoc, serverTimestamp } = firestoreModule;

      await updateDoc(doc(db, 'users', request.uid), {
        isVerifiedDev: true,
        verifiedDevRequestStatus: 'approved',
        verifiedDevVerifiedAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'verifiedDevRequests', request.id), {
        status: 'approved',
        resolvedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      fetchItems();
    } catch (e) {
      console.error('Failed to approve verified dev:', e);
      alert('Failed to approve request');
    }
  };

  const updateReportStatus = async (reportId, status) => {
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { doc, updateDoc, serverTimestamp } = firestoreModule;
      await updateDoc(doc(db, 'reports', reportId), {
        status,
        updatedAt: serverTimestamp(),
        resolvedAt: status === 'resolved' ? serverTimestamp() : null
      });
      fetchItems();
      fetchReportsCount();
    } catch (e) {
      alert(e?.message || 'Failed to update report.');
    }
  };

  const deleteReport = async (reportId) => {
    if (!window.confirm('Delete this report?')) return;
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { doc, deleteDoc } = firestoreModule;
      await deleteDoc(doc(db, 'reports', reportId));
      fetchItems();
      fetchReportsCount();
    } catch (e) {
      alert(e?.message || 'Failed to delete report.');
    }
  };



  const rejectVerifiedDev = async (request) => {
    if (!window.confirm(`Reject Verified Bot Dev request for ${request.displayName || request.email || request.uid}?`)) return;
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { doc, updateDoc, serverTimestamp } = firestoreModule;

      await updateDoc(doc(db, 'users', request.uid), {
        verifiedDevRequestStatus: 'rejected',
        verifiedDevRejectedAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'verifiedDevRequests', request.id), {
        status: 'rejected',
        resolvedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      fetchItems();
    } catch (e) {
      console.error('Failed to reject verified dev:', e);
      alert('Failed to reject request');
    }
  };
  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <div className="skeleton h-6 w-48" />
        <div className="skeleton h-32 w-full rounded-xl" />
        <div className="skeleton h-32 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 h-full overflow-y-auto">
      <h1 className="text-3xl font-bold text-white mb-6">Admin Dashboard</h1>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-white/10 pb-4">
        <button 
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'users' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Users
        </button>
        <button 
          onClick={() => setActiveTab('bots')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'bots' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Bots
        </button>

        <button 
          onClick={() => setActiveTab('feedback')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'feedback' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <span className="inline-flex items-center gap-2">
            Feedback
            {pendingFeedbackCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/20">
                {pendingFeedbackCount}
              </span>
            )}
          </span>
        </button>

        <button 
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'reports' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <span className="inline-flex items-center gap-2">
            Reports
            {pendingReportsCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/20">
                {pendingReportsCount}
              </span>
            )}
          </span>
        </button>
        <button 
          onClick={() => setActiveTab('verifications')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'verifications' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <span className="inline-flex items-center gap-2">
            Dev Verifications
            {pendingVerifyCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/20">
                {pendingVerifyCount}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="bg-[#12121a] border border-white/5 p-4 rounded-xl flex items-center justify-between hover:border-violet-500/20 transition-colors">
            <div className="flex items-center gap-4">
               {activeTab === 'users' ? (
                 <>
                   <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden shrink-0">
                     {item.photoURL ? (
                       <img
                         src={item.photoURL}
                         loading="lazy"
                         decoding="async"
                         className="w-full h-full object-cover"
                       />
                     ) : null}
                   </div>
                   <div>
                     <div className="flex items-center gap-2">
                       <div className={`font-semibold ${item.email === 'evvyxan@gmail.com' ? 'janitor-text' : 'text-white'}`}>{item.displayName || 'No Name'}</div>
                       {item.roles && item.roles.length > 0 && (
                         <div className="flex gap-1">
                           {item.roles.map(r => (
                             <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/20 capitalize">
                               {r.replace('_', ' ')}
                             </span>
                           ))}
                         </div>
                       )}
                     </div>
                     <div className="text-xs text-gray-500">{item.email}</div>
                     <div className="text-[10px] text-gray-600 font-mono mt-1 flex gap-3">
                       <span>UID: {item.uid?.substring(0, 8)}...</span>
                       <span>Lvl: {item.level || 1}</span>
                       <span>XP: {item.xp || 0}</span>
                     </div>
                   </div>
                 </>
               ) : activeTab === 'bots' ? (
                 <>
                   <div className="w-10 h-10 rounded-lg bg-gray-800 overflow-hidden shrink-0">
                     {item.imageURL ? (
                       <img
                         src={item.imageURL}
                         loading="lazy"
                         decoding="async"
                         className="w-full h-full object-cover"
                       />
                     ) : null}
                   </div>
                   <div>
                     <div className="font-semibold text-white">{item.name}</div>
                     <div className="text-xs text-gray-500">Created by: {item.creatorName || item.creatorId}</div>
                   </div>
                 </>
               ) : activeTab === 'feedback' ? (
                 <>
                   <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden shrink-0">
                     {item.photoURL ? (
                       <img
                         src={item.photoURL}
                         loading="lazy"
                         decoding="async"
                         className="w-full h-full object-cover"
                       />
                     ) : null}
                   </div>
                   <div className="min-w-0">
                     <div className="flex items-center gap-2">
                       <div className="font-semibold text-white truncate">{item.displayName || 'Unknown'}</div>
                       <span className={`text-[10px] px-1.5 py-0.5 rounded border ${item.status === 'new' ? 'bg-red-500/10 text-red-300 border-red-500/20' : item.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20' : 'bg-white/5 text-gray-300 border-white/10'}`}>
                         {item.status || 'new'}
                       </span>
                       <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10">
                         {item.type || 'general'}
                       </span>
                     </div>
                     <div className="text-xs text-gray-500 truncate">{item.email}</div>
                     <div className="text-xs text-gray-300 mt-1 line-clamp-2">
                       {item.message}
                     </div>
                   </div>
                 </>
               ) : activeTab === 'reports' ? (
                 <>
                   <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden shrink-0">
                     {item.reporterPhotoURL ? (
                       <img
                         src={item.reporterPhotoURL}
                         loading="lazy"
                         decoding="async"
                         className="w-full h-full object-cover"
                       />
                     ) : null}
                   </div>
                   <div className="min-w-0">
                     <div className="flex items-center gap-2">
                       <div className="font-semibold text-white truncate">{item.reporterDisplayName || 'Unknown reporter'}</div>
                       <span className={`text-[10px] px-1.5 py-0.5 rounded border ${item.status === 'new' ? 'bg-red-500/10 text-red-300 border-red-500/20' : item.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20' : 'bg-white/5 text-gray-300 border-white/10'}`}>
                         {item.status || 'new'}
                       </span>
                       <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-200 border border-rose-500/20">
                         {item.targetType === 'bot' ? 'bot' : 'user'}
                       </span>
                     </div>
                     <div className="text-xs text-gray-500 truncate">{item.reporterEmail}</div>
                     <div className="text-xs text-gray-300 mt-1 truncate">
                       Target: <span className="text-white/90">{item.targetName || item.targetId}</span>
                     </div>
                     <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                       {item.message}
                     </div>
                   </div>
                 </>
               
              ) : activeTab === 'reports' ? (
                <>
                  <button 
                    onClick={() => updateReportStatus(item.id, 'read')}
                    className="px-3 py-1 rounded text-xs font-bold bg-white/5 text-gray-200 hover:bg-white/10 transition-colors"
                  >
                    Mark Read
                  </button>
                  <button 
                    onClick={() => updateReportStatus(item.id, 'resolved')}
                    className="px-3 py-1 rounded text-xs font-bold bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 transition-colors"
                  >
                    Resolve
                  </button>
                  <button 
                    onClick={() => deleteReport(item.id)}
                    className="px-3 py-1 rounded text-xs font-bold bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                  >
                    Delete
                  </button>
                </>
) : (
                 <>
                   <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden shrink-0">
                     {item.photoURL ? (
                       <img
                         src={item.photoURL}
                         loading="lazy"
                         decoding="async"
                         className="w-full h-full object-cover"
                       />
                     ) : null}
                   </div>
                   <div>
                     <div className="flex items-center gap-2">
                       <div className="font-semibold text-white">{item.displayName || 'Unknown'}</div>
                       <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10">
                         {item.uid?.substring(0, 8)}...
                       </span>
                     </div>
                     <div className="text-xs text-gray-500">{item.email}</div>
                     <div className="text-[10px] text-amber-300 mt-1">
                       Pending Verified Bot Dev
                     </div>
                   </div>
                 </>
               ))}
            </div>

            <div className="flex gap-2">
              {activeTab === 'users' ? (
                <>
                  <button 
                    onClick={() => setEditingUser(item)}
                    className="px-3 py-1 rounded text-xs font-bold bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => toggleBan(item.id, item.isBanned)}
                    className={`px-3 py-1 rounded text-xs font-bold transition-colors ${item.isBanned ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}
                  >
                    {item.isBanned ? 'Unban' : 'Ban'}
                  </button>
                
                  <button 
                    onClick={() => handleAdminDeleteChats(item)}
                    disabled={busyAction?.userId === item.id}
                    className="px-3 py-1 rounded text-xs font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Delete all chats for this user"
                  >
                    {busyAction?.type === 'delete_chats' && busyAction?.userId === item.id ? 'Deleting…' : 'Delete Chats'}
                  </button>
                  <button 
                    onClick={() => handleAdminDeleteUser(item)}
                    disabled={busyAction?.userId === item.id}
                    className="px-3 py-1 rounded text-xs font-bold bg-red-600/20 text-red-300 hover:bg-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Soft delete user + delete their content"
                  >
                    {busyAction?.type === 'delete_user' && busyAction?.userId === item.id ? 'Deleting…' : 'Delete User'}
                  </button>
</>
              ) : activeTab === 'bots' ? (
                <>
                  <button 
                    onClick={() => setEditingBot(item)}
                    className="px-3 py-1 rounded text-xs font-bold bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-colors"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => toggleFeature(item.id, item.isFeatured)}
                    className={`px-3 py-1 rounded text-xs font-bold transition-colors ${item.isFeatured ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'}`}
                  >
                    {item.isFeatured ? 'Unfeature' : 'Feature'}
                  </button>
                  <button 
                    onClick={() => deleteBot(item.id)}
                    className="px-3 py-1 rounded text-xs font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    Delete
                  </button>
                </>
              ) : activeTab === 'feedback' ? (
                <>
                  <button 
                    onClick={() => updateFeedbackStatus(item.id, item.status === 'new' ? 'read' : 'read')}
                    className="px-3 py-1 rounded text-xs font-bold bg-white/5 text-gray-200 hover:bg-white/10 transition-colors"
                  >
                    Mark Read
                  </button>
                  <button 
                    onClick={() => updateFeedbackStatus(item.id, 'resolved')}
                    className="px-3 py-1 rounded text-xs font-bold bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 transition-colors"
                  >
                    Resolve
                  </button>
                  <button 
                    onClick={() => deleteFeedback(item.id)}
                    className="px-3 py-1 rounded text-xs font-bold bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                  >
                    Delete
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => approveVerifiedDev(item)}
                    className="px-3 py-1 rounded text-xs font-bold bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 transition-colors"
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => rejectVerifiedDev(item)}
                    className="px-3 py-1 rounded text-xs font-bold bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {editingUser && (
        <UserEditModal 
          user={editingUser} 
          onClose={() => setEditingUser(null)} 
          onSave={handleSaveUser} 
        />
      )}

      {editingBot && (
        <BotEditModal
          bot={editingBot}
          onClose={() => setEditingBot(null)}
          onSave={handleSaveBot}
        />
      )}
    </div>
  );
}
