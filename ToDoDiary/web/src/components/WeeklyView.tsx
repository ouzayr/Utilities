import { useState } from 'react';
import {
  addTask,
  carryTask,
  deleteTask,
  toggleTask,
  updateTaskText,
  usePagesForDates,
  useTasksForDates,
  useWeekTasks,
} from '../data';
import { addDays, displayWeekDates, dow, isoWeekId, todayIso, weekHeader } from '../dates';
import type { Task } from '../types';
import { TaskRow, TaskRowHandlers } from './TaskRow';
import { CarryDialog } from './CarryDialog';

export function WeeklyView({ uid, anchor, onAnchorChange, onOpenDay }: {
  uid: string;
  anchor: string;
  onAnchorChange: (d: string) => void;
  onOpenDay: (d: string) => void;
}) {
  const dates = displayWeekDates(anchor);
  const weekId = isoWeekId(dates[3]);
  const pages = usePagesForDates(uid, dates);
  const dayTasks = useTasksForDates(uid, dates);
  const weekTasks = useWeekTasks(uid, weekId);
  const [newTask, setNewTask] = useState('');
  const [assignFor, setAssignFor] = useState<Task | null>(null);
  const today = todayIso();

  const handlers: TaskRowHandlers = {
    onToggle: (t) => void toggleTask(uid, t),
    onTextChange: (t, text) => void updateTaskText(uid, t.id, text),
    onCarry: (t) => void carryTask(uid, t, null, isoWeekId(addDays(dates[3], 7))),
    onAssignToDay: (t) => setAssignFor(t),
    onDelete: (t) => void deleteTask(uid, t.id),
  };

  const submitNewTask = () => {
    const text = newTask.trim();
    if (!text) return;
    setNewTask('');
    void addTask(uid, 'WEEK', null, weekId, text);
  };

  return (
    <div className="page">
      <div className="date-nav">
        <button className="icon-btn" onClick={() => onAnchorChange(addDays(anchor, -7))} title="Previous week">‹</button>
        <div className="date-title">
          <h2>{weekHeader(anchor)}</h2>
          <div className="date-tools">
            <button className="chip" onClick={() => onAnchorChange(today)}>This week</button>
          </div>
        </div>
        <button className="icon-btn" onClick={() => onAnchorChange(addDays(anchor, 7))} title="Next week">›</button>
      </div>

      <section className="week-grid">
        {dates.map((d) => {
          const t = dayTasks.filter((x) => x.pageDate === d);
          const open = t.filter((x) => x.status === 'OPEN').length;
          const done = t.filter((x) => x.status === 'DONE').length;
          const page = pages[d];
          const focus = page?.focusText || (page?.focusInkJson ? '✎ focus in ink' : '');
          return (
            <button key={d} className={`day-cell ${d === today ? 'today' : ''}`} onClick={() => onOpenDay(d)}>
              <span className="day-cell-dow">{dow(d)}</span>
              <span className="day-cell-num">{Number(d.slice(8))}</span>
              <span className="day-cell-focus">{focus}</span>
              <span className="day-cell-counts">{open} open · {done} done</span>
            </button>
          );
        })}
      </section>

      <section>
        <h3 className="section-label">THIS WEEK</h3>
        <p className="hint">Tasks for the whole week — assign to a day when you're ready.</p>
        {weekTasks.map((t) => (
          <TaskRow key={t.id} task={t} handlers={handlers} />
        ))}
        <div className="add-task">
          <input
            value={newTask}
            placeholder="Add a week task and press Enter…"
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitNewTask()}
          />
          <button className="chip" onClick={submitNewTask}>Add</button>
        </div>
      </section>

      {assignFor && (
        <CarryDialog
          title="Assign task to a day…"
          defaultDate={today}
          onCancel={() => setAssignFor(null)}
          onConfirm={(target) => {
            const t = assignFor;
            setAssignFor(null);
            void carryTask(uid, t, target, null);
          }}
        />
      )}
    </div>
  );
}
