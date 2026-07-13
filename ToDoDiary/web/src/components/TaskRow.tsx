import { useEffect, useRef, useState } from 'react';
import type { Task } from '../types';
import { InkCanvas } from './InkCanvas';
import { shortDate } from '../dates';

export interface TaskRowHandlers {
  onToggle: (task: Task) => void;
  onTextChange: (task: Task, text: string) => void;
  onCarry: (task: Task) => void;
  onMoveToWeek?: (task: Task) => void;
  onAssignToDay?: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export function TaskRow({ task, handlers }: { task: Task; handlers: TaskRowHandlers }) {
  const carried = task.status === 'CARRIED';
  const done = task.status === 'DONE';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  return (
    <div className={`task-row ${carried ? 'carried' : ''}`}>
      <button
        className={`check ${done ? 'done' : ''}`}
        title={done ? 'Mark open' : 'Mark done'}
        onClick={() => !carried && handlers.onToggle(task)}
      >
        {done ? '✓' : carried ? '→' : ''}
      </button>

      <div className="task-content">
        {task.inputType === 'TEXT' ? (
          <TextContent task={task} done={done} carried={carried} onTextChange={handlers.onTextChange} />
        ) : (
          <div className={`ink-lane ${done ? 'struck' : ''}`}>
            <InkCanvas inkJson={task.inkJson} maxHeight={72} />
            {!task.inkJson && <span className="ink-hint">handwritten on phone</span>}
          </div>
        )}
      </div>

      {carried && task.carriedToDate && (
        <span className="carried-tag">
          → {task.carriedToDate.includes('W') ? task.carriedToDate : shortDate(task.carriedToDate)}
        </span>
      )}

      <div className="row-menu" ref={menuRef}>
        <button className="icon-btn" onClick={() => setMenuOpen((v) => !v)} title="Task actions">
          ⋮
        </button>
        {menuOpen && (
          <div className="menu">
            {task.status === 'OPEN' && (
              <>
                <button onClick={() => { setMenuOpen(false); handlers.onCarry(task); }}>Carry forward…</button>
                {handlers.onMoveToWeek && (
                  <button onClick={() => { setMenuOpen(false); handlers.onMoveToWeek!(task); }}>Move to week</button>
                )}
                {handlers.onAssignToDay && (
                  <button onClick={() => { setMenuOpen(false); handlers.onAssignToDay!(task); }}>Assign to a day…</button>
                )}
              </>
            )}
            <button className="danger" onClick={() => { setMenuOpen(false); handlers.onDelete(task); }}>Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}

function TextContent({
  task,
  done,
  carried,
  onTextChange,
}: {
  task: Task;
  done: boolean;
  carried: boolean;
  onTextChange: (task: Task, text: string) => void;
}) {
  const [text, setText] = useState(task.textContent ?? '');
  const [focused, setFocused] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  // Accept remote edits only while not typing here.
  useEffect(() => {
    if (!focused && task.textContent !== null && task.textContent !== text) {
      setText(task.textContent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.textContent, focused]);

  return (
    <input
      className={`task-text ${done ? 'struck' : ''}`}
      value={text}
      placeholder="Task…"
      readOnly={carried}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => onTextChange(task, v), 500);
      }}
    />
  );
}
