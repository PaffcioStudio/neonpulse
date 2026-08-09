import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListOrdered, X, Volume2, GripVertical, Trash2 } from 'lucide-react';
import { formatTime, getCoverSrc } from '../utils';

export default function QueuePanel({ queue, queueIndex, currentSong, onSelect, onClose, onRemove, onReorder, animationsEnabled = true, isClosing = false }) {
  const { t } = useTranslation(['player', 'common']);
  const dragIdx  = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  const onDragStart = (e, idx) => {
    dragIdx.current = idx;
    e.dataTransfer.effectAllowed = 'move';
    requestAnimationFrame(() => e.target.closest('[data-row]')?.classList.add('opacity-40'));
  };

  const onDragEnd = (e) => {
    e.target.closest('[data-row]')?.classList.remove('opacity-40');
    setDragOver(null);
    dragIdx.current = null;
  };

  const onDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIdx.current !== null && dragIdx.current !== idx) setDragOver(idx);
  };

  const onDrop = (e, idx) => {
    e.preventDefault();
    if (dragIdx.current !== null && dragIdx.current !== idx) {
      onReorder(dragIdx.current, idx);
    }
    setDragOver(null);
    dragIdx.current = null;
  };

  return (
    <div className={`absolute right-4 bottom-28 w-80 max-h-[28rem] bg-zinc-950/98 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-40 backdrop-blur ${
      animationsEnabled ? (isClosing ? 'np-slide-up-exit' : 'np-slide-up-enter') : ''
    }`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
          <ListOrdered size={14} />
          {t('queue', { ns: 'player' })} ({queue.length})
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors">
          <X size={15} />
        </button>
      </div>

      {queue.length === 0 ? (
        <div className="text-xs text-zinc-600 text-center py-10">{t('queueEmpty', { ns: 'player' })}</div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {queue.map((s, idx) => {
            const isCurrent = idx === queueIndex;
            const isOver    = dragOver === idx;
            return (
              <div
                key={`${s.id}-${idx}`}
                data-row=""
                draggable
                onDragStart={e => onDragStart(e, idx)}
                onDragEnd={onDragEnd}
                onDragOver={e => onDragOver(e, idx)}
                onDrop={e => onDrop(e, idx)}
                className={[
                  'flex items-center gap-2 px-3 py-2 transition-colors group select-none',
                  isCurrent ? 'bg-white/[0.06]' : 'hover:bg-zinc-800/50',
                ].join(' ')}
                style={isOver ? { borderTop: '2px solid var(--accent-from, #a855f7)' } : { borderTop: '2px solid transparent' }}
              >
                <span className="text-zinc-700 cursor-grab active:cursor-grabbing flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical size={13} />
                </span>
                <span className="w-5 flex-shrink-0 flex items-center justify-center">
                  {isCurrent
                    ? <Volume2 size={12} className="accent-text animate-pulse" />
                    : <span className="text-[10px] text-zinc-500">{idx + 1}</span>
                  }
                </span>
                <button onClick={() => onSelect(s, idx)} className="flex-1 min-w-0 text-left">
                  <div className={`truncate text-xs font-medium ${isCurrent ? 'accent-text' : 'text-zinc-100'}`}>{s.title}</div>
                  <div className="text-[10px] text-zinc-500 truncate">{s.artist}</div>
                </button>
                <span className="text-[10px] text-zinc-600 flex-shrink-0 tabular-nums mr-1">{formatTime(s.duration)}</span>
                <button
                  onClick={e => { e.stopPropagation(); onRemove(idx); }}
                  className="flex-shrink-0 text-zinc-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  title={t('remove', { ns: 'common' })}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
