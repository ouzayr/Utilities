import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  documentId,
} from 'firebase/firestore';
import { db } from './firebase';
import type { DiaryPage, InputType, Task, TaskScope } from './types';
import { isoWeekId } from './dates';

// Firestore layout shared with the Android app:
//   users/{uid}/pages/{yyyy-MM-dd}
//   users/{uid}/tasks/{autoId}
//   users/{uid}/carryLinks/{autoId}

const pagesCol = (uid: string) => collection(db, 'users', uid, 'pages');
const tasksCol = (uid: string) => collection(db, 'users', uid, 'tasks');
const carryCol = (uid: string) => collection(db, 'users', uid, 'carryLinks');

function toTask(id: string, data: Record<string, unknown>): Task {
  return {
    id,
    scope: (data.scope as TaskScope) ?? 'DAY',
    pageDate: (data.pageDate as string) ?? null,
    weekId: (data.weekId as string) ?? null,
    rowIndex: (data.rowIndex as number) ?? 0,
    status: (data.status as Task['status']) ?? 'OPEN',
    inputType: (data.inputType as InputType) ?? 'TEXT',
    textContent: (data.textContent as string) ?? null,
    inkJson: (data.inkJson as string) ?? null,
    carriedToDate: (data.carriedToDate as string) ?? null,
    createdAt: (data.createdAt as number) ?? 0,
    updatedAt: (data.updatedAt as number) ?? 0,
  };
}

export function usePage(uid: string, date: string): DiaryPage | null {
  const [page, setPage] = useState<DiaryPage | null>(null);
  useEffect(() => {
    setPage(null);
    return onSnapshot(doc(pagesCol(uid), date), (snap) => {
      const d = snap.data();
      setPage(
        d
          ? {
              date,
              focusInkJson: (d.focusInkJson as string) ?? null,
              focusText: (d.focusText as string) ?? null,
              notesInkJson: (d.notesInkJson as string) ?? null,
              template: (d.template as DiaryPage['template']) ?? 'DIARY',
              updatedAt: (d.updatedAt as number) ?? 0,
            }
          : { date, focusInkJson: null, focusText: null, notesInkJson: null, template: 'DIARY', updatedAt: 0 },
      );
    });
  }, [uid, date]);
  return page;
}

export function useDayTasks(uid: string, date: string): Task[] {
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => {
    setTasks([]);
    const q = query(tasksCol(uid), where('pageDate', '==', date));
    return onSnapshot(q, (snap) => {
      setTasks(snap.docs.map((d) => toTask(d.id, d.data())).sort((a, b) => a.rowIndex - b.rowIndex));
    });
  }, [uid, date]);
  return tasks;
}

export function useWeekTasks(uid: string, weekId: string): Task[] {
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => {
    setTasks([]);
    const q = query(tasksCol(uid), where('weekId', '==', weekId), where('scope', '==', 'WEEK'));
    return onSnapshot(q, (snap) => {
      setTasks(snap.docs.map((d) => toTask(d.id, d.data())).sort((a, b) => a.rowIndex - b.rowIndex));
    });
  }, [uid, weekId]);
  return tasks;
}

/** All day tasks for a set of dates (weekly overview). Max 10 dates. */
export function useTasksForDates(uid: string, dates: string[]): Task[] {
  const [tasks, setTasks] = useState<Task[]>([]);
  const key = dates.join(',');
  useEffect(() => {
    setTasks([]);
    if (dates.length === 0) return;
    const q = query(tasksCol(uid), where('pageDate', 'in', dates));
    return onSnapshot(q, (snap) => {
      setTasks(snap.docs.map((d) => toTask(d.id, d.data())));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, key]);
  return tasks;
}

export function usePagesForDates(uid: string, dates: string[]): Record<string, DiaryPage> {
  const [pages, setPages] = useState<Record<string, DiaryPage>>({});
  const key = dates.join(',');
  useEffect(() => {
    setPages({});
    if (dates.length === 0) return;
    const q = query(pagesCol(uid), where(documentId(), 'in', dates));
    return onSnapshot(q, (snap) => {
      const map: Record<string, DiaryPage> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        map[d.id] = {
          date: d.id,
          focusInkJson: (data.focusInkJson as string) ?? null,
          focusText: (data.focusText as string) ?? null,
          notesInkJson: (data.notesInkJson as string) ?? null,
          template: (data.template as DiaryPage['template']) ?? 'DIARY',
          updatedAt: (data.updatedAt as number) ?? 0,
        };
      });
      setPages(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, key]);
  return pages;
}

// ---- mutations ----

export async function saveFocusText(uid: string, date: string, text: string): Promise<void> {
  await setDoc(doc(pagesCol(uid), date), { focusText: text, updatedAt: Date.now() }, { merge: true });
}

export async function addTask(
  uid: string,
  scope: TaskScope,
  pageDate: string | null,
  weekId: string | null,
  text: string,
): Promise<void> {
  const t = Date.now();
  await setDoc(doc(tasksCol(uid)), {
    scope,
    pageDate,
    weekId: weekId ?? (pageDate ? isoWeekId(pageDate) : null),
    rowIndex: t,
    status: 'OPEN',
    inputType: 'TEXT',
    textContent: text,
    inkJson: null,
    carriedToDate: null,
    createdAt: t,
    updatedAt: t,
  });
}

export async function updateTaskText(uid: string, taskId: string, text: string): Promise<void> {
  await updateDoc(doc(tasksCol(uid), taskId), { textContent: text, updatedAt: Date.now() });
}

export async function toggleTask(uid: string, task: Task): Promise<void> {
  const status = task.status === 'DONE' ? 'OPEN' : 'DONE';
  await updateDoc(doc(tasksCol(uid), task.id), { status, updatedAt: Date.now() });
}

export async function deleteTask(uid: string, taskId: string): Promise<void> {
  await deleteDoc(doc(tasksCol(uid), taskId));
}

/**
 * Carry a task to another day (targetDate) or week (targetWeekId): copy the
 * content, mark the source CARRIED, record a CarryLink — one atomic batch.
 * Mirrors DiaryRepository.carryTask on Android.
 */
export async function carryTask(
  uid: string,
  task: Task,
  targetDate: string | null,
  targetWeekId: string | null,
): Promise<void> {
  const t = Date.now();
  const targetKey = targetDate ?? targetWeekId;
  if (!targetKey) throw new Error('carryTask: no target');
  const batch = writeBatch(db);
  batch.set(doc(tasksCol(uid)), {
    scope: targetDate ? 'DAY' : 'WEEK',
    pageDate: targetDate,
    weekId: targetDate ? isoWeekId(targetDate) : targetWeekId,
    rowIndex: t,
    status: 'OPEN',
    inputType: task.inputType,
    textContent: task.textContent,
    inkJson: task.inkJson,
    carriedToDate: null,
    createdAt: t,
    updatedAt: t,
  });
  batch.update(doc(tasksCol(uid), task.id), {
    status: 'CARRIED',
    carriedToDate: targetKey,
    updatedAt: t,
  });
  batch.set(doc(carryCol(uid)), {
    sourceTaskId: task.id,
    sourceScopeKey: task.pageDate ?? task.weekId ?? '',
    targetKey,
    createdAt: t,
  });
  await batch.commit();
}
