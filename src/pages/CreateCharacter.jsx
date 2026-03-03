import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getFirestoreServices } from '../utils/firebaseClient';
import { useAuth } from '../contexts/AuthContext';
import { CharacterCard } from '@lenml/char-card-reader';
import TagInput from '../components/TagInput';
import { slugifyTag, uniqueTags } from '../utils/tagUtils';

const timeoutPromise = (promise, ms = 15000, errorMsg = 'Operation timed out') => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
  ]);
};

export default function CreateCharacter() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const userId = user?.uid;

  const [saving, setSaving] = useState(false);
  const [originalTagSlugs, setOriginalTagSlugs] = useState([]);
  const [loading, setLoading] = useState(!!editId);
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    tags: [],
    personality: '',
    scenario: '',
    example_dialogue: '',
    first_message: '',
    imageURL: '',
    visibility: 'public',
    contentRating: 'sfw',
    definition: '',
    creators_note: '',
  });

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileChange({ target: { files: [file] } });
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      let card;
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        const text = await file.text();
        card = CharacterCard.from_json(JSON.parse(text));
      } else {
        const arrayBuffer = await file.arrayBuffer();
        card = await CharacterCard.from_file(arrayBuffer);
      }
      
      const v2 = card.toSpecV2();

      const updateForm = (imgData = null) => {
        setForm(prev => {
          // Handle complex fields mapping
          const firstMessage = v2.data.first_mes || v2.data.first_message || prev.first_message;
          
          let definition = v2.data.system_prompt || '';
          if (v2.data.post_history_instructions) {
            definition += (definition ? '\n\n' : '') + v2.data.post_history_instructions;
          }
          if (!definition && prev.definition) definition = prev.definition;

          let creatorsNote = v2.data.creator_notes || '';
          if (v2.data.alternate_greetings && Array.isArray(v2.data.alternate_greetings) && v2.data.alternate_greetings.length > 0) {
            creatorsNote += (creatorsNote ? '\n\n' : '') + 'Alternate Greetings:\n' + v2.data.alternate_greetings.join('\n');
          }
          if (!creatorsNote && prev.creators_note) creatorsNote = prev.creators_note;

          return {
            ...prev,
            ...(imgData ? { imageURL: imgData } : {}),
            name: v2.data.name || prev.name,
            description: v2.data.description || prev.description, // Visual description
            personality: v2.data.personality || prev.personality, // Detailed personality
            scenario: v2.data.scenario || prev.scenario,
            first_message: firstMessage,
            example_dialogue: v2.data.mes_example || prev.example_dialogue,
            creators_note: creatorsNote,
            definition: definition,
            tags: v2.data.tags ? uniqueTags(v2.data.tags) : prev.tags,
          };
        });
      };

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => updateForm(reader.result);
        reader.readAsDataURL(file);
      } else {
        updateForm();
      }
    } catch (err) {
      console.error('Failed to read character card:', err);
      alert('Failed to read character card. Make sure it is a valid SillyTavern card.');
    }
  };

  useEffect(() => {
    if (!editId || !userId) return;

    async function loadCharacter() {
      try {
        const { db, firestoreModule } = await getFirestoreServices();
        const { doc, getDoc } = firestoreModule;
        const docRef = doc(db, 'characters', editId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.creatorId !== userId) {
            alert("You don't have permission to edit this character.");
            navigate('/');
            return;
          }
          setForm({
            name: data.name || '',
            description: data.description || '',
            tags: Array.isArray(data.tags) ? data.tags : [],
            personality: data.personality || '',
            scenario: data.scenario || '',
            example_dialogue: data.example_dialogue || '',
            first_message: data.first_message || '',
            imageURL: data.imageURL || '',
            visibility: data.visibility || 'public',
            contentRating: data.contentRating || (data.rating === 'nsfw' || data.rating === 'sfw' ? data.rating : 'sfw'),
            definition: data.definition || '',
            creators_note: data.creators_note || '',
          });
        } else {
          navigate('/');
        }
      } catch (err) {
        console.error('Error loading character:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCharacter();
  }, [editId, userId, navigate]);

  const update = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const resolveImageUrl = async (url) => {
    if (!url) return url;
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

  const handleImageBlur = async (e) => {
    const value = e.target.value;
    if (value) {
      const resolved = await resolveImageUrl(value);
      if (resolved !== value) {
        setForm(prev => ({ ...prev, imageURL: resolved }));
      }
    }
  };


  const handleDelete = async () => {
    if (!editId) return;
    if (!window.confirm("Are you sure you want to delete this character? This cannot be undone.")) return;

    setSaving(true);
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { doc, deleteDoc } = firestoreModule;
      await deleteDoc(doc(db, 'characters', editId));
      navigate('/');
    } catch (err) {
      console.error("Error deleting character:", err);
      alert("Failed to delete character.");
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.personality.trim()) return;
    if (!userId) return;

    setSaving(true);
    try {
      let finalImageURL = form.imageURL;

      if (finalImageURL) {
        finalImageURL = await timeoutPromise(resolveImageUrl(finalImageURL), 10000, 'Image resolution timed out');
      }

      const { db, firestoreModule } = await getFirestoreServices();
      const { collection, addDoc, doc, updateDoc, serverTimestamp, writeBatch, setDoc, increment, getDoc } = firestoreModule;

      const charData = {
        name: form.name.trim(),
        description: form.description.trim(),
        tags: uniqueTags(form.tags),
        tagSlugs: uniqueTags(form.tags).map(t => slugifyTag(t)).filter(Boolean),
        nameLower: form.name.trim().toLowerCase(),
        personality: form.personality.trim(),
        scenario: form.scenario.trim(),
        example_dialogue: form.example_dialogue.trim(),
        first_message: form.first_message.trim(),
        imageURL: finalImageURL,
        visibility: form.visibility,
        contentRating: form.contentRating,
        definition: form.definition.trim(),
        creators_note: form.creators_note.trim(),
        updatedAt: serverTimestamp(),
      };

      
      const syncTags = async (nextTagSlugs, prevTagSlugs = []) => {
        try {
          const added = (nextTagSlugs || []).filter(s => s && !prevTagSlugs.includes(s));
          const removed = (prevTagSlugs || []).filter(s => s && !(nextTagSlugs || []).includes(s));

          if (!added.length && !removed.length) return;

          const batch = writeBatch(db);
          const now = serverTimestamp();

          for (const slug of added) {
            const ref = doc(db, 'tags', slug);
            // Merge to allow user-created tags
            batch.set(ref, { slug, name: slug.replace(/-/g, ' '), count: increment(1), lastUsedAt: now, createdAt: now }, { merge: true });
          }
          for (const slug of removed) {
            const ref = doc(db, 'tags', slug);
            batch.set(ref, { count: increment(-1), lastUsedAt: now }, { merge: true });
          }
          await batch.commit();
        } catch (e) {
          console.warn('Tag sync failed (non-fatal):', e);
        }
      };
if (editId) {
        await timeoutPromise(updateDoc(doc(db, 'characters', editId), charData), 15000, 'Update operation timed out');
        await syncTags(charData.tagSlugs || [], originalTagSlugs || []);
        navigate(`/chat/${editId}`);
      } else {
        const docRef = await timeoutPromise(addDoc(collection(db, 'characters'), {
          ...charData,
          creatorId: userId,
          creatorName: userData?.displayName || user?.displayName || user?.email,
          createdAt: serverTimestamp(),
          chatCount: 0,
          messageCount: 0,
          views: 0,
          rating: 0,
          loveCount: 0,
          ratingCount: 0,
          totalStars: 0,
        }), 15000, 'Create operation timed out');
        await syncTags(charData.tagSlugs || [], []);
        navigate(`/chat/${docRef.id}`);
      }
    } catch (err) {
      console.error('Error saving character:', err);
      alert(err.message || 'Failed to save character. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full px-6">
        <div className="w-full max-w-3xl space-y-4">
          <div className="skeleton h-6 w-48" />
          <div className="skeleton h-40 w-full rounded-2xl" />
          <div className="skeleton h-12 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Creation Form
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-8 flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <span className="material-icons-outlined text-gray-400">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              {editId ? 'Edit Character' : 'Create Character'}
            </h1>
            <p className="text-gray-400 text-sm">
              Define your character's personality
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Left Column - Form */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Import Card Section */}
            {!editId && (
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`bg-violet-600/10 border-2 border-dashed ${isDragging ? 'border-violet-400 bg-violet-600/20' : 'border-violet-500/20'} rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn transition-all duration-200`}
              >
                <div className="text-center sm:text-left">
                  <h3 className="text-white font-medium mb-1">Import from Character Card</h3>
                  <p className="text-gray-400 text-xs">Drag and drop or upload a SillyTavern PNG, WEBP or JSON file.</p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary whitespace-nowrap flex items-center gap-2 text-sm"
                >
                  <span className="material-icons-outlined text-base">file_upload</span>
                  Select Card
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".png,.json,.webp"
                  className="hidden"
                />
              </div>
            )}


            <form id="create-form" onSubmit={handleSubmit} className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Character Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={update('name')}
                  placeholder="e.g. Luna the Witch"
                  className="input-field"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Short Description</label>
                <p className="text-xs text-gray-500 mb-1.5">
                  A brief bio displayed on the character card.
                </p>
                <input
                  type="text"
                  value={form.description}
                  onChange={update('description')}
                  placeholder="A wise ancient witch living in the forest."
                  className="input-field"
                />
              </div>

              {/* Creator's Note (Private) */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Creator's Note (Private)</label>
                <p className="text-xs text-gray-500 mb-1.5">
                  Private notes for yourself. Not visible to others or the AI.
                </p>
                <textarea
                  value={form.creators_note}
                  onChange={update('creators_note')}
                  placeholder="Notes about implementation, lore, etc."
                  className="textarea-field h-20"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Tags</label>
                <TagInput
                  value={form.tags}
                  onChange={(next) => setForm(prev => ({ ...prev, tags: next }))}
                  placeholder="Add tags like Fantasy, RPG, Magic"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Visibility */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Visibility</label>
                  <select
                    value={form.visibility}
                    onChange={update('visibility')}
                    className="input-field appearance-none"
                  >
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                  </select>
                </div>

                {/* Rating */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Content Rating</label>
                  <select
                    value={form.contentRating}
                    onChange={update('contentRating')}
                    className="input-field appearance-none"
                  >
                    <option value="sfw">SFW</option>
                    <option value="nsfw">NSFW</option>
                  </select>
                </div>
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Character Image URL</label>
                <div className="flex flex-col gap-3">
                  <input
                    type="url"
                    value={form.imageURL}
                    onChange={update('imageURL')}
                    onBlur={handleImageBlur}
                    placeholder="https://example.com/character-image.png"
                    className="input-field"
                  />
                  <p className="text-xs text-gray-500">
                    Paste a direct link to an image (PNG, JPG, GIF).
                  </p>
                </div>
              </div>

              {/* Personality / System Prompt */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Personality / Persona *
                </label>
                <textarea
                  value={form.personality}
                  onChange={update('personality')}
                  placeholder="Describe personality, traits, and behavior..."
                  className="textarea-field h-32"
                  required
                />
              </div>

              {/* Advanced Definition */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Advanced Definition
                </label>
                <p className="text-xs text-gray-500 mb-1.5">
                  Detailed prompt or JSON-like definition for complex characters.
                </p>
                <textarea
                  value={form.definition}
                  onChange={update('definition')}
                  placeholder="[Character('Name') { ... }]"
                  className="textarea-field h-40 font-mono text-sm"
                />
              </div>

              {/* Scenario */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Scenario</label>
                <textarea
                  value={form.scenario}
                  onChange={update('scenario')}
                  placeholder="Where does the conversation take place?"
                  className="textarea-field h-24"
                />
              </div>

              {/* Example Dialogue */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Example Dialogue</label>
                <textarea
                  value={form.example_dialogue}
                  onChange={update('example_dialogue')}
                  placeholder="User: Hello\nChar: Hi there!"
                  className="textarea-field h-24"
                />
              </div>

              {/* First Message */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">First Message</label>
                <textarea
                  value={form.first_message}
                  onChange={update('first_message')}
                  placeholder="The opening line..."
                  className="textarea-field h-24"
                />
              </div>
            </form>
          </div>

          {/* Right Column - Preview */}
          <div className="lg:col-span-4 space-y-6">
            <div className="sticky top-6">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Preview</h3>
              
              {/* Standard Preview */}
              <div className="w-full aspect-square rounded-xl overflow-hidden bg-[#1a1a23] border border-white/10 mx-auto">
                {form.imageURL ? (
                  <img
                    src={form.imageURL}
                    alt="Preview"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="material-icons-outlined text-4xl text-gray-700">image</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="flex-1 btn-secondary justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="create-form"
                  disabled={saving || !form.name.trim() || !form.personality.trim()}
                  className="flex-1 btn-primary justify-center disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="skeleton h-4 w-10 rounded" />
                      {editId ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      <span className="material-icons-outlined text-sm">publish</span>
                      {editId ? 'Save' : 'Create'}
                    </>
                  )}
                </button>
              </div>
              
              {editId && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="w-full mt-3 px-4 py-2 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <span className="material-icons-outlined text-sm">delete</span>
                  Delete Character
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
