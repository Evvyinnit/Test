import { useMemo, useState } from 'react';
import { getFirestoreServices } from '../utils/firebaseClient';
import { useAuth } from '../contexts/AuthContext';

const categories = [
  { id: 'spam', label: 'Spam / Scam' },
  { id: 'harassment', label: 'Harassment / Hate' },
  { id: 'sexual', label: 'Sexual content' },
  { id: 'illegal', label: 'Illegal / Dangerous' },
  { id: 'impersonation', label: 'Impersonation' },
  { id: 'copyright', label: 'Copyright / IP' },
  { id: 'other', label: 'Other' },
];

export default function ReportModal({ open, onClose, target }) {
  const { user, userData } = useAuth();
  const [category, setCategory] = useState('spam');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const targetLabel = useMemo(() => {
    if (!target) return '';
    if (target.targetType === 'bot') return `Bot: ${target.targetName || target.targetId || ''}`;
    if (target.targetType === 'user') return `User: ${target.targetName || target.targetId || ''}`;
    return target.targetType || '';
  }, [target]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSent(false);

    if (!user) {
      setError('Please sign in to submit a report.');
      return;
    }
    if (!target?.targetType || !target?.targetId) {
      setError('Missing report target.');
      return;
    }

    const trimmed = message.trim();
    if (trimmed.length < 5) {
      setError('Please add a bit more detail.');
      return;
    }

    setSending(true);
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { collection, addDoc, serverTimestamp } = firestoreModule;

      await addDoc(collection(db, 'reports'), {
        status: 'new', // new -> read -> resolved
        category,
        message: trimmed,

        reporterId: user.uid,
        reporterDisplayName: userData?.displayName || user.displayName || '',
        reporterEmail: user.email || '',
        reporterPhotoURL: userData?.photoURL || user.photoURL || '',

        targetType: target.targetType,
        targetId: target.targetId,
        targetName: target.targetName || '',
        targetOwnerId: target.targetOwnerId || '',

        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSent(true);
      setMessage('');
      setTimeout(() => {
        onClose?.();
        setSent(false);
      }, 800);
    } catch (e2) {
      setError(e2?.message || 'Failed to submit report.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#12121a] shadow-2xl shadow-rose-500/10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="min-w-0">
            <h2 className="text-white font-semibold text-lg flex items-center gap-2">
              <span className="material-icons-outlined text-rose-400 text-base">report</span>
              Report
            </h2>
            <p className="text-gray-400 text-sm truncate">{targetLabel}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">✕</button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2 font-medium">Reason</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-400/60 transition-colors"
            >
              {categories.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2 font-medium">Details</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="What happened? Add details or context so admins can review."
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-400/60 transition-colors resize-none"
            />
          </div>

          {error ? <div className="text-sm text-rose-400">{error}</div> : null}
          {sent ? <div className="text-sm text-emerald-400">Report sent. Thank you.</div> : null}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 text-white font-medium hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="px-4 py-2 rounded-xl bg-rose-500/90 hover:bg-rose-500 text-white font-medium transition-colors disabled:opacity-60"
            >
              {sending ? 'Sending…' : 'Submit report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
