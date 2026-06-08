'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { dataClient } from '@/lib/supabase/dataClient';
import type { DealComment } from '@/lib/sim';

export function ConversationPanel({
  dealId,
  dealName,
  onClose,
}: {
  dealId: string;
  dealName: string;
  onClose: () => void;
}) {
  const { commentsOf, addComment, toggleLike } = useApp();
  const all = commentsOf(dealId);
  const topLevel = all.filter((c) => !c.parentId);
  const repliesOf = (id: string) => all.filter((c) => c.parentId === id);

  // real teammates to @mention (from profiles)
  const [team, setTeam] = useState<string[]>([]);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    (async () => {
      try {
        const { data } = await dataClient().from('profiles').select('full_name,email');
        if (!active || !data) return;
        const handles = (data as { full_name: string | null; email: string }[])
          .map((p) => (p.full_name?.trim() || p.email.split('@')[0]))
          .filter(Boolean);
        setTeam(Array.from(new Set(handles)));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">💬 Conversation</div>
            <div className="text-xs text-slate-500">{dealName}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {topLevel.length === 0 && (
            <p className="text-xs text-slate-400">
              No messages yet. Anyone with view access can post here. @mention a teammate to loop them in.
            </p>
          )}
          {topLevel.map((c) => (
            <Thread key={c.id} comment={c} replies={repliesOf(c.id)} dealId={dealId} addComment={addComment} toggleLike={toggleLike} team={team} />
          ))}
        </div>

        <div className="border-t border-slate-100 p-3">
          <Composer placeholder="Start a new thread…  @mention to tag" team={team} onSubmit={(text) => addComment(dealId, text)} />
        </div>
      </aside>
    </>
  );
}

function Thread({
  comment,
  replies,
  dealId,
  addComment,
  toggleLike,
  team,
}: {
  comment: DealComment;
  replies: DealComment[];
  dealId: string;
  addComment: ReturnType<typeof useApp>['addComment'];
  toggleLike: ReturnType<typeof useApp>['toggleLike'];
  team: string[];
}) {
  const [replying, setReplying] = useState(false);
  return (
    <div className="rounded-lg border border-slate-200">
      <Bubble c={comment} dealId={dealId} toggleLike={toggleLike} />
      {replies.length > 0 && (
        <div className="ml-3 space-y-1.5 border-l-2 border-slate-100 pb-2 pl-2">
          {replies.map((r) => (
            <Bubble key={r.id} c={r} dealId={dealId} toggleLike={toggleLike} small />
          ))}
        </div>
      )}
      <div className="px-3 pb-2">
        {replying ? (
          <Composer
            placeholder="Reply…"
            small
            team={team}
            onSubmit={(text) => {
              addComment(dealId, text, { parentId: comment.id });
              setReplying(false);
            }}
          />
        ) : (
          <button onClick={() => setReplying(true)} className="text-xs text-slate-500 hover:text-slate-900">↳ Reply</button>
        )}
      </div>
    </div>
  );
}

function Bubble({
  c,
  dealId,
  toggleLike,
  small,
}: {
  c: DealComment;
  dealId: string;
  toggleLike: ReturnType<typeof useApp>['toggleLike'];
  small?: boolean;
}) {
  const likes = c.likes ?? [];
  const likedByMe = likes.includes('You');
  return (
    <div className={`px-3 ${small ? 'py-1.5' : 'py-2'}`}>
      <div className="flex items-center gap-1.5">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
          {c.author.slice(0, 1)}
        </span>
        <span className="text-xs font-semibold text-slate-700">{c.author}</span>
      </div>
      <p className="mt-1 text-sm text-slate-700">{renderMentions(c.text)}</p>
      <div className="mt-1 flex items-center gap-2">
        <button
          onClick={() => toggleLike(dealId, c.id)}
          title={likes.length ? `Liked by ${likes.join(', ')}` : 'Acknowledge / like'}
          className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] ${
            likedByMe ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-400 hover:text-slate-700'
          }`}
        >
          👍{likes.length > 0 && <span className="font-semibold">{likes.length}</span>}
        </button>
      </div>
    </div>
  );
}

function renderMentions(text: string) {
  return text.split(/(@\w+)/g).map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="font-semibold text-sky-600">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function Composer({
  onSubmit,
  placeholder,
  small,
  team,
}: {
  onSubmit: (text: string) => void;
  placeholder: string;
  small?: boolean;
  team: string[];
}) {
  const [text, setText] = useState('');
  const [showTag, setShowTag] = useState(false);
  const suggestions = team.length ? team : ['(no other users yet)'];
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const t = text.trim();
        if (t) {
          onSubmit(t);
          setText('');
          setShowTag(false);
        }
      }}
      className="mt-1"
    >
      <div className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className={`flex-1 rounded-md border border-slate-300 px-2 text-sm focus:border-slate-900 focus:outline-none ${small ? 'py-1' : 'py-1.5'}`}
        />
        <button type="button" onClick={() => setShowTag((v) => !v)} title="Tag teammate" className="text-slate-400 hover:text-sky-600">@</button>
        <button className={`rounded-md bg-slate-900 px-2.5 font-medium text-white hover:bg-slate-800 ${small ? 'py-1 text-xs' : 'py-1.5 text-sm'}`}>Post</button>
      </div>
      {showTag && (
        <div className="mt-1 flex flex-wrap gap-1">
          {suggestions.map((u) => (
            <button
              key={u}
              type="button"
              disabled={u.startsWith('(')}
              onClick={() => {
                setText((t) => `${t}${t.endsWith(' ') || t === '' ? '' : ' '}@${u} `);
                setShowTag(false);
              }}
              className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-100 disabled:text-slate-300"
            >
              {u.startsWith('(') ? u : `@${u}`}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
