import { useMemo, useState } from 'react';
import { normalizeTag, uniqueTags } from '../utils/tagUtils';

export default function TagInput({ value = [], onChange, placeholder = 'Add a tag and press Enter' }) {
  const [draft, setDraft] = useState('');

  const tags = useMemo(() => uniqueTags(value), [value]);

  const commit = (raw) => {
    const t = normalizeTag(raw);
    if (!t) return;
    const next = uniqueTags([...(tags || []), t]);
    onChange?.(next);
  };

  const remove = (t) => {
    const next = (tags || []).filter(x => x.toLowerCase() !== t.toLowerCase());
    onChange?.(next);
  };

  return (
    <div className="bg-[#0f0f16] border border-white/10 rounded-2xl p-3">
      <div className="flex flex-wrap gap-2">
        {tags.map(t => (
          <span
            key={t.toLowerCase()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs bg-white/5 border border-white/10 text-gray-200"
            title={t}
          >
            <span className="max-w-[12rem] truncate">{t}</span>
            <button
              type="button"
              onClick={() => remove(t)}
              className="material-icons-outlined text-[16px] text-gray-400 hover:text-gray-200"
              aria-label={`Remove ${t}`}
            >
              close
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              commit(draft);
              setDraft('');
            } else if (e.key === 'Backspace' && !draft && tags.length) {
              remove(tags[tags.length - 1]);
            }
          }}
          onBlur={() => {
            if (draft.trim()) {
              commit(draft);
              setDraft('');
            }
          }}
          placeholder={tags.length ? '' : placeholder}
          className="flex-1 min-w-[10rem] bg-transparent outline-none text-sm text-gray-100 placeholder:text-gray-500 py-1"
        />
      </div>

      <p className="mt-2 text-[11px] text-gray-500">
        Tips: press <span className="text-gray-300">Enter</span> to add, use commas, or type <span className="text-gray-300">#tag</span>.
      </p>
    </div>
  );
}
