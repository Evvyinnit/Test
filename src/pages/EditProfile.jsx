import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFirestoreServices } from '../utils/firebaseClient';
import { useAuth } from '../contexts/AuthContext';
import { getUnlockedAvatarBorders, getAvatarBorderById } from '../utils/levelSystem';
import AvatarWithBorder from '../components/AvatarWithBorder';

export default function EditProfile() {
  const { user, userData, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Tabs: 'general', 'visuals', 'personas'
  const [activeTab, setActiveTab] = useState('general');

  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    photoURL: '',
    bannerURL: '',
    theme: 'violet',
    social_links: { twitter: '', discord: '', github: '', youtube: '', instagram: '', twitch: '', reddit: '', website: '' },
    avatarBorderId: ''
  });

  const [personas, setPersonas] = useState([]);
  const [newPersona, setNewPersona] = useState({ name: '', avatar: '', description: '' });

  const unlockedBorders = getUnlockedAvatarBorders(userData?.level || 1);
  const selectedBorder = getAvatarBorderById(formData.avatarBorderId || (userData?.avatarBorderId || ''));


  useEffect(() => {
    if (userData) {
      setFormData({
        displayName: userData.displayName || '',
        bio: userData.bio || '',
        photoURL: userData.photoURL || '',
        bannerURL: userData.bannerURL || '',
        theme: userData.theme || 'violet',
        social_links: { twitter: '', discord: '', github: '', youtube: '', instagram: '', twitch: '', reddit: '', website: '', ...(userData.social_links || {}) },
        avatarBorderId: userData.avatarBorderId || ''
      });
      setPersonas(userData.persona_list || []);
    }
  }, [userData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('social_')) {
      const socialKey = name.split('_')[1];
      setFormData(prev => ({
        ...prev,
        social_links: { ...prev.social_links, [socialKey]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const resolveImageUrl = async (url) => {
    if (!url) return url;
    // Check for Tenor/Giphy URLs that might be share links (not direct media)
    const isTenor = url.includes('tenor.com') && !url.includes('media.tenor.com') && !url.includes('c.tenor.com');
    const isGiphy = url.includes('giphy.com') && !url.includes('media.giphy.com') && !url.includes('i.giphy.com');
    
    if (isTenor || isGiphy) {
      try {
        const res = await fetch(`/.netlify/functions/resolve-image?url=${encodeURIComponent(url)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.url && data.url !== url) {
             return data.url;
          }
        }
      } catch (err) {
        console.error("Failed to resolve image URL", err);
      }
    }
    return url;
  };

  const handleBlur = async (e) => {
    const { name, value } = e.target;
    if ((name === 'photoURL' || name === 'bannerURL') && value) {
      const resolved = await resolveImageUrl(value);
      if (resolved !== value) {
        setFormData(prev => ({ ...prev, [name]: resolved }));
      }
    }
  };

  const handlePersonaAvatarBlur = async (e) => {
    const value = e.target.value;
    if (value) {
      const resolved = await resolveImageUrl(value);
      if (resolved !== value) {
        setNewPersona(prev => ({ ...prev, avatar: resolved }));
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!user) throw new Error("No user logged in");
      
      const resolvedPhotoURL = await resolveImageUrl(formData.photoURL);
      const resolvedBannerURL = await resolveImageUrl(formData.bannerURL);

      const { db, firestoreModule } = await getFirestoreServices();
      const { doc, updateDoc } = firestoreModule;
      const userRef = doc(db, 'users', user.uid);
      
      const updatedData = {
        ...formData,
        photoURL: resolvedPhotoURL,
        bannerURL: resolvedBannerURL,
        persona_list: personas
      };
      
      const sanitizedData = JSON.parse(JSON.stringify(updatedData));

      await updateDoc(userRef, sanitizedData);
      
      if (refreshUser) await refreshUser();

      navigate(`/profile/${user.uid}`);
    } catch (error) {
      console.error("Error updating profile:", error);
      setError("Failed to save changes: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addPersona = async () => {
    if (!newPersona.name) return;
    const resolvedAvatar = await resolveImageUrl(newPersona.avatar);
    const personaToAdd = { ...newPersona, avatar: resolvedAvatar };
    setPersonas([...personas, personaToAdd]);
    setNewPersona({ name: '', avatar: '', description: '' });
  };

  const removePersona = (index) => {
    setPersonas(personas.filter((_, i) => i !== index));
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0f] text-white flex flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="hover:bg-white/10 p-1 rounded-full transition-colors">
            <span className="material-icons-outlined text-gray-400">arrow_back</span>
          </button>
          Edit Profile
        </h1>
        <div className="flex gap-3">
           <button 
            type="button" 
            onClick={() => navigate(`/profile/${user?.uid}`)}
            className="hidden sm:block px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-2 rounded-lg text-sm font-medium shadow-lg shadow-violet-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <span className="skeleton w-4 h-4 rounded-full"></span>
            ) : (
              <span className="material-icons-outlined text-sm">save</span>
            )}
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 w-full flex-1">
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl mb-6 flex items-center gap-3 animate-pulse">
            <span className="material-icons-outlined">error_outline</span>
            <span>{error}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-white/10 overflow-x-auto pb-1">
           {['general', 'visuals', 'personas'].map(tab => (
             <button
               key={tab}
               onClick={() => setActiveTab(tab)}
               className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors capitalize ${
                 activeTab === tab 
                 ? 'bg-violet-600/10 text-violet-400 border-b-2 border-violet-500' 
                 : 'text-gray-400 hover:text-white hover:bg-white/5'
               }`}
             >
               {tab}
             </button>
           ))}
        </div>

        <form onSubmit={handleSave} className="space-y-8">
          
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Display Name</label>
                  <input 
                    type="text" 
                    name="displayName" 
                    value={formData.displayName} 
                    onChange={handleChange} 
                    className="w-full bg-[#12121a] border border-white/10 rounded-xl p-3 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Theme Color</label>
                  <div className="relative">
                    <select 
                      name="theme" 
                      value={formData.theme} 
                      onChange={handleChange} 
                      className="w-full bg-[#12121a] border border-white/10 rounded-xl p-3 appearance-none focus:border-violet-500 outline-none transition-all"
                    >
                      <option value="violet">Violet (Default)</option>
                      <option value="blue">Blue</option>
                      <option value="green">Green</option>
                      <option value="red">Red</option>
                      <option value="amber">Amber</option>
                    </select>
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 material-icons-outlined pointer-events-none">expand_more</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Bio</label>
                <textarea 
                  name="bio" 
                  value={formData.bio} 
                  onChange={handleChange} 
                  rows="4"
                  className="w-full bg-[#12121a] border border-white/10 rounded-xl p-3 focus:border-violet-500 outline-none transition-all resize-none"
                  placeholder="Tell us about yourself..."
                ></textarea>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/5">
                <h3 className="text-lg font-medium text-white">Social Links</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Twitter / X URL</label>
                    <div className="relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 fab fa-twitter"></span>
                       <input
                         type="text"
                         name="social_twitter"
                         value={formData.social_links?.twitter || ''}
                         onChange={handleChange}
                         className="w-full bg-[#12121a] border border-white/10 rounded-xl p-3 pl-10 focus:border-violet-500 outline-none transition-all"
                         placeholder="https://twitter.com/username"
                       />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Discord User ID / Tag</label>
                    <div className="relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 fab fa-discord"></span>
                       <input
                         type="text"
                         name="social_discord"
                         value={formData.social_links?.discord || ''}
                         onChange={handleChange}
                         className="w-full bg-[#12121a] border border-white/10 rounded-xl p-3 pl-10 focus:border-violet-500 outline-none transition-all"
                         placeholder="username#0000"
                       />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">GitHub URL</label>
                    <div className="relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 fab fa-github"></span>
                       <input
                         type="text"
                         name="social_github"
                         value={formData.social_links?.github || ''}
                         onChange={handleChange}
                         className="w-full bg-[#12121a] border border-white/10 rounded-xl p-3 pl-10 focus:border-violet-500 outline-none transition-all"
                         placeholder="https://github.com/username"
                       />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">YouTube URL</label>
                    <div className="relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 fab fa-youtube"></span>
                       <input
                         type="text"
                         name="social_youtube"
                         value={formData.social_links?.youtube || ''}
                         onChange={handleChange}
                         className="w-full bg-[#12121a] border border-white/10 rounded-xl p-3 pl-10 focus:border-violet-500 outline-none transition-all"
                         placeholder="https://youtube.com/@channel"
                       />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Instagram URL</label>
                    <div className="relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 fab fa-instagram"></span>
                       <input
                         type="text"
                         name="social_instagram"
                         value={formData.social_links?.instagram || ''}
                         onChange={handleChange}
                         className="w-full bg-[#12121a] border border-white/10 rounded-xl p-3 pl-10 focus:border-violet-500 outline-none transition-all"
                         placeholder="https://instagram.com/username"
                       />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Twitch URL</label>
                    <div className="relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 fab fa-twitch"></span>
                       <input
                         type="text"
                         name="social_twitch"
                         value={formData.social_links?.twitch || ''}
                         onChange={handleChange}
                         className="w-full bg-[#12121a] border border-white/10 rounded-xl p-3 pl-10 focus:border-violet-500 outline-none transition-all"
                         placeholder="https://twitch.tv/username"
                       />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Reddit URL</label>
                    <div className="relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 fab fa-reddit"></span>
                       <input
                         type="text"
                         name="social_reddit"
                         value={formData.social_links?.reddit || ''}
                         onChange={handleChange}
                         className="w-full bg-[#12121a] border border-white/10 rounded-xl p-3 pl-10 focus:border-violet-500 outline-none transition-all"
                         placeholder="https://reddit.com/u/username"
                       />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Website</label>
                    <div className="relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 material-icons-outlined text-lg">language</span>
                       <input
                         type="text"
                         name="social_website"
                         value={formData.social_links?.website || ''}
                         onChange={handleChange}
                         className="w-full bg-[#12121a] border border-white/10 rounded-xl p-3 pl-10 focus:border-violet-500 outline-none transition-all"
                         placeholder="https://yoursite.com"
                       />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Visuals Tab */}
          {activeTab === 'visuals' && (
            <div className="space-y-8 animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {/* Profile Picture */}
                 <div className="space-y-4">
                    <label className="text-sm font-medium text-gray-300 block">Profile Picture</label>
                    <div className="flex flex-col items-center gap-4 p-6 bg-[#12121a] rounded-xl border border-white/5">
                       <div className="w-24 h-24 rounded-full overflow-hidden bg-black/50 ring-2 ring-violet-500/20">
                         {formData.photoURL ? (
                           <img
                             src={formData.photoURL}
                             alt="Preview"
                             loading="lazy"
                             decoding="async"
                             className="w-full h-full object-cover"
                           />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center text-gray-600">
                             <span className="material-icons-outlined text-4xl">person</span>
                           </div>
                         )}
                       </div>
                       <div className="w-full space-y-2">
                         <input 
                            type="text" 
                            name="photoURL" 
                            value={formData.photoURL} 
                            onChange={handleChange} 
                            onBlur={handleBlur}
                            placeholder="Image URL (GIFs supported)"
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-sm focus:border-violet-500 outline-none transition-all"
                          />
                          <p className="text-xs text-gray-500 text-center">Paste a direct link to an image or GIF.</p>
                       </div>
                    </div>
                 </div>

                 {/* Banner */}
                 <div className="space-y-4">
                    <label className="text-sm font-medium text-gray-300 block">Banner Image</label>
                    <div className="flex flex-col items-center gap-4 p-6 bg-[#12121a] rounded-xl border border-white/5">
                       <div className="w-full h-24 rounded-lg overflow-hidden bg-black/50 ring-2 ring-violet-500/20 relative">
                         {formData.bannerURL ? (
                           <img
                             src={formData.bannerURL}
                             alt="Preview"
                             loading="lazy"
                             decoding="async"
                             className="w-full h-full object-cover"
                           />
                         ) : (
                           <div className={`w-full h-full bg-gradient-to-r from-${formData.theme}-900 to-gray-900`}></div>
                         )}
                       </div>
                       <div className="w-full space-y-2">
                         <input 
                            type="text" 
                            name="bannerURL" 
                            value={formData.bannerURL} 
                            onChange={handleChange} 
                            onBlur={handleBlur}
                            placeholder="Banner URL"
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-sm focus:border-violet-500 outline-none transition-all"
                          />
                          <p className="text-xs text-gray-500 text-center">Recommended size: 1200x300px.</p>
                       </div>
                    </div>
                 </div>

              {/* Avatar Border */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-300 block">Avatar Border</label>
                    <p className="text-xs text-gray-500 mt-1">
                      Borders unlock with your level. Pick any unlocked border — new milestones unlock fancier ones automatically.
                    </p>
                  </div>
                  <div className="text-xs text-gray-400 whitespace-nowrap mt-1">Lvl {userData?.level || 1}</div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-[#12121a] rounded-xl border border-white/5">
                  <AvatarWithBorder
                    src={formData.photoURL}
                    alt="Avatar preview"
                    borderId={formData.avatarBorderId || userData?.avatarBorderId}
                    size={72}
                  />
                  <div className="min-w-0">
                    <div className="text-sm text-gray-300">Selected</div>
                    <div className="text-base font-semibold text-white truncate">{selectedBorder?.name || 'Recruit Ring'}</div>
                    <div className="text-xs text-gray-500">Unlocked: {unlockedBorders.length} border{unlockedBorders.length === 1 ? '' : 's'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {unlockedBorders.map((b) => {
                    const isSelected = (formData.avatarBorderId || userData?.avatarBorderId || '') === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, avatarBorderId: b.id }))}
                        className={`text-left p-3 rounded-xl border transition-all ${
                          isSelected ? 'border-violet-500/60 bg-violet-600/10' : 'border-white/10 bg-black/20 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <AvatarWithBorder src={formData.photoURL} alt={b.name} borderId={b.id} size={52} />
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white truncate">{b.name}</div>
                            <div className="text-xs text-gray-500">Level {b.level}+</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              </div>
            </div>
          )}

          {/* Personas Tab */}
          {activeTab === 'personas' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-violet-900/10 border border-violet-500/20 rounded-xl p-4 flex gap-3">
                <span className="material-icons-outlined text-violet-400">info</span>
                <p className="text-sm text-violet-200">Personas are alt-identities you can display on your profile. Adding them here does not save them automatically; remember to click "Save Changes"!</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Add New Persona Form */}
                <div className="lg:col-span-1 bg-[#12121a] border border-white/10 rounded-xl p-5 h-fit sticky top-24">
                   <h3 className="font-semibold text-white mb-4">Add Persona</h3>
                   <div className="space-y-3">
                     <input 
                       type="text" 
                       placeholder="Name" 
                       value={newPersona.name}
                       onChange={(e) => setNewPersona({...newPersona, name: e.target.value})}
                       className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-sm focus:border-violet-500 outline-none"
                     />
                     <div className="flex gap-2">
                       <input 
                         type="text" 
                         placeholder="Avatar URL" 
                         value={newPersona.avatar}
                         onChange={(e) => setNewPersona({...newPersona, avatar: e.target.value})}
                         onBlur={handlePersonaAvatarBlur}
                         className="flex-1 bg-black/20 border border-white/10 rounded-lg p-2 text-sm focus:border-violet-500 outline-none"
                       />
                       {newPersona.avatar && (
                         <div className="w-9 h-9 rounded bg-gray-800 overflow-hidden shrink-0">
                           <img
                             src={newPersona.avatar}
                             alt=""
                             loading="lazy"
                             decoding="async"
                             className="w-full h-full object-cover"
                           />
                         </div>
                       )}
                     </div>
                     <textarea 
                       placeholder="Short Description" 
                       value={newPersona.description}
                       onChange={(e) => setNewPersona({...newPersona, description: e.target.value})}
                       rows="2"
                       className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-sm focus:border-violet-500 outline-none resize-none"
                     />
                     <button 
                       type="button" 
                       onClick={addPersona}
                       disabled={!newPersona.name}
                       className="w-full bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       Add to List
                     </button>
                   </div>
                </div>

                {/* List */}
                <div className="lg:col-span-2 space-y-3">
                  {personas.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 border border-white/5 border-dashed rounded-xl">
                      No personas added yet.
                    </div>
                  ) : (
                    personas.map((p, idx) => (
                      <div key={idx} className="flex items-start gap-4 bg-[#12121a] border border-white/5 p-4 rounded-xl group hover:border-white/10 transition-colors">
                        <div className="w-12 h-12 rounded-full bg-gray-800 overflow-hidden shrink-0">
                          <img
                            src={p.avatar || 'https://via.placeholder.com/48'}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <h4 className="font-semibold text-white">{p.name}</h4>
                            <button 
                              type="button" 
                              onClick={() => removePersona(idx)}
                              className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
                              title="Remove"
                            >
                              <span className="material-icons-outlined text-lg">delete</span>
                            </button>
                          </div>
                          <p className="text-sm text-gray-400 mt-1">{p.description}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

        </form>
      </div>
    </div>
  );
}
