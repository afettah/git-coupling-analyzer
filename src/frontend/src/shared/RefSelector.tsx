import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, GitBranch, Tag, X } from 'lucide-react';
import { getGitRefs, type GitRef } from '../api/git';

interface RefSelectorProps {
  repoId: string | null;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function RefSelector({
  repoId,
  value,
  onChange,
  placeholder = 'HEAD',
  className = '',
}: RefSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [refs, setRefs] = useState<GitRef[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const fetchRefs = useCallback(
    (q: string) => {
      if (!repoId) return;
      setLoading(true);
      getGitRefs(repoId, { q, limit: 50 })
        .then(setRefs)
        .catch(() => setRefs([]))
        .finally(() => setLoading(false));
    },
    [repoId],
  );

  useEffect(() => {
    if (!open || !repoId) return;
    clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(() => fetchRefs(query), 250);
    return () => clearTimeout(fetchTimer.current);
  }, [open, query, repoId, fetchRefs]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (name: string) => {
    onChange(name);
    setQuery('');
    setOpen(false);
  };

  const handleInputChange = (text: string) => {
    setQuery(text);
    onChange(text || 'HEAD');
  };

  const handleClear = () => {
    onChange('HEAD');
    setQuery('');
  };

  const branches = refs.filter((r) => r.kind === 'branch');
  const tags = refs.filter((r) => r.kind === 'tag');

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 cursor-pointer"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <GitBranch size={13} className="text-slate-500 shrink-0" />
        {open ? (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query) {
                handleSelect(query);
              }
              if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            placeholder={placeholder}
            className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-slate-600 text-sm"
            autoComplete="off"
          />
        ) : (
          <span className="flex-1 min-w-0 truncate">{value || placeholder}</span>
        )}
        {value && value !== 'HEAD' && !open && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="text-slate-500 hover:text-slate-300"
          >
            <X size={12} />
          </button>
        )}
        <ChevronDown size={13} className="text-slate-500 shrink-0" />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
          {loading && (
            <div className="px-3 py-2 text-xs text-slate-500">Loading...</div>
          )}

          {!loading && refs.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-500">
              {repoId ? 'No refs found' : 'Select a repository first'}
            </div>
          )}

          {branches.length > 0 && (
            <>
              <div className="sticky top-0 bg-slate-900 px-3 py-1 text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
                Branches
              </div>
              {branches.map((ref) => (
                <button
                  key={`b-${ref.name}`}
                  type="button"
                  onClick={() => handleSelect(ref.name)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-800 ${
                    value === ref.name ? 'bg-sky-500/10 text-sky-300' : 'text-slate-300'
                  }`}
                >
                  <GitBranch size={12} className="shrink-0 text-slate-500" />
                  <span className="flex-1 truncate">{ref.name}</span>
                  <span className="text-[10px] text-slate-600">{ref.short_sha}</span>
                </button>
              ))}
            </>
          )}

          {tags.length > 0 && (
            <>
              <div className="sticky top-0 bg-slate-900 px-3 py-1 text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
                Tags
              </div>
              {tags.map((ref) => (
                <button
                  key={`t-${ref.name}`}
                  type="button"
                  onClick={() => handleSelect(ref.name)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-800 ${
                    value === ref.name ? 'bg-sky-500/10 text-sky-300' : 'text-slate-300'
                  }`}
                >
                  <Tag size={12} className="shrink-0 text-slate-500" />
                  <span className="flex-1 truncate">{ref.name}</span>
                  <span className="text-[10px] text-slate-600">{ref.short_sha}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
