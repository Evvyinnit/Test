import { useState } from 'react';
import { getFirestoreServices } from '../utils/firebaseClient';
import { useAuth } from '../contexts/AuthContext';

export default function FeedbackModal({ open, onClose }) {
  const { user, userData } = useAuth();
  const [type, setType] = useState('general');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!user) {
      setError('Please sign in to send feedback.');
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

      await addDoc(collection(db, 'feedback'), {
        status: 'new', // new -> read -> resolved
        type,
        message: trimmed,
        userId: user.uid,
        displayName: userData?.displayName || user.displayName || '',
        email: user.email || '',
        photoURL: userData?.photoURL || user.photoURL || '',
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setSent(true);
      setMessage('');
      setTimeout(() => {
        onClose?.();
        setSent(false);
      }, 800);
    } catch (e2) {
      setError(e2?.message || 'Failed to send feedback.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#12121a] shadow-2xl shadow-violet-500/10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h2 className="text-white font-semibold text-lg">Send Feedback</h2>
            <p className="text-gray-400 text-sm">Report bugs, request features, or share ideas.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">✕</button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors"
            >
              <option value="general">General</option>
              <option value="bug">Bug / Issue</option>
              <option value="feature">Feature request</option>
              <option value="content">Content / Bot</option>
              <option value="billing">Billing</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder="Tell us what happened and what you expected…"
              className="w-full resize-none bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
            <div className="mt-2 text-xs text-gray-500 flex justify-between">
              <span>We attach your current page URL to help debug.</span>
              <span>{message.trim().length}/2000</span>
            </div>
          </div>

          {error && <div className="text-red-300 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
          {sent && <div className="text-emerald-200 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">Sent. Thank you!</div>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={sending}
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
