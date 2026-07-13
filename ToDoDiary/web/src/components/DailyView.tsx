import { useEffect, useRef, useState } from 'react';
import {
  addTask,
  carryTask,
  deleteTask,
  saveFocusText,
  toggleTask,
  updateTaskText,
  useDayTasks,
  usePage,
} from '../data';
import { addDays, isoWeekId, prettyDate, todayIso } from '../dates';
import type { Task } from '../types';
import { InkCanvas } from './InkCanvas';
import { TaskRow, TaskRowHandlers } from './TaskRow';
import { CarryDialog } from './CarryDialog';

export function DailyView({ uid, date, onDateChange }: {
  uid: string;
  date: string;
  onDateChange: (d: string) => void;
}) {
  const page = usePage(uid, date);
  const tasks = useDayTasks(uid, date);
  const [newTask, setNewTask] = useState('');
  const [carryFor, setCarryFor] = useState<Task | null>(null);

  const handlers: TaskRowHandlers = {
    onToggle: (t) => void toggleTask(uid, t),
    onTextChange: (t, text) => void updateTaskText(uid, t.id, text),
    onCarry: (t) => setCarryFor(t),
    onMoveToWeek: (t) => void carryTask(uid, t, null, isoWeekId(date)),
    onDelete: (t) => void deleteTask(uid, t.id),
  };

  const submitNewTask = () => {
    const text = newTask.trim();
    if (!text) return;
    setNewTask('');
    void addTask(uid, 'DAY', date, null, text);
  };

  return (
    <div className="page">
      <div className="date-nav">
        <button className="icon-btn" onClick={() => onDateChange(addDays(date, -1))} title="Previous day">‹</button>
        <div className="date-title">
          <h2>{prettyDate(date)}</h2>
          <div className="date-tools">
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && onDateChange(e.target.value)}
            />
            <button className="chip" onClick={() => onDateChange(todayIso())}>Today</button>
          </div>
        </div>
        <button className="icon-btn" onClick={() => onDateChange(addDays(date, 1))} title="Next day">›</button>
      </div>

      <FocusLine
        focusText={page?.focusText ?? null}
        focusInkJson={page?.focusInkJson ?? null}
        onSave={(text) => void saveFocusText(uid, date, text)}
      />

      <section>
        <h3 className="section-label">TASKS</h3>
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} handlers={handlers} />
        ))}
        <div className="add-task">
          <input
            value={newTask}
            placeholder="Add a task and press Enter…"
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitNewTask()}
          />
          <button className="chip" onClick={submitNewTask}>Add</button>
        </div>
      </section>

      {page?.notesInkJson && (
        <section>
          <h3 className="section-label">NOTES (written on phone)</h3>
          <div className="notes-ink">
            <InkCanvas inkJson={page.notesInkJson} maxHeight={900} />
          </div>
        </section>
      )}

      {carryFor && (
        <CarryDialog
          title="Carry task to…"
          defaultDate={addDays(todayIso(), 1)}
          onCancel={() => setCarryFor(null)}
          onConfirm={(target) => {
            const t = carryFor;
            setCarryFor(null);
            void carryTask(uid, t, target, null);
          }}
        />
      )}
    </div>
  );
}

function FocusLine({
  focusText,
  focusInkJson,
  onSave,
}: {
  focusText: string | null;
  focusInkJson: string | null;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState(focusText ?? '');
  const [focused, setFocused] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!focused) setText(focusText ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusText]);

  return (
    <section className="focus">
      <h3 className="section-label">FOCUS</h3>
      {focusInkJson ? (
        <InkCanvas inkJson={focusInkJson} maxHeight={90} />
      ) : (
        <input
          className="focus-input"
          value={text}
          placeholder="What matters today?"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            setText(e.target.value);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => onSave(e.target.value), 500);
          }}
        />
      )}
    </section>
  );
}
