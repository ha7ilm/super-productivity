import { DEFAULT_TASK, Task } from '../../tasks/task.model';
import { getDbDateStr } from '../../../util/get-db-date-str';
import {
  buildPlannerHistoryDays,
  normalizePlannerHistoryWeek,
} from './planner-history.util';

describe('Planner history dates', () => {
  const task = (id: string, changes: Partial<Task> = {}): Task => ({
    ...DEFAULT_TASK,
    id,
    projectId: 'project',
    isDone: true,
    doneOn: new Date(2026, 5, 17, 12).getTime(),
    ...changes,
  });

  it('normalizes any selected day to the configured week start', () => {
    expect(normalizePlannerHistoryWeek('2026-05-07', '2026-06-17', 1)).toBe('2026-05-04');
    expect(normalizePlannerHistoryWeek('2026-05-07', '2026-06-17', 0)).toBe('2026-05-03');
  });

  it('defaults absent, invalid and future selections to the current week', () => {
    for (const selection of [null, '', 'invalid', '2026-02-30', '2026-06-18']) {
      expect(normalizePlannerHistoryWeek(selection, '2026-06-17', 1)).toBe('2026-06-15');
    }
  });

  it('handles weeks spanning years and leap days', () => {
    expect(normalizePlannerHistoryWeek('2026-01-01', '2026-06-17', 1)).toBe('2025-12-29');
    const days = buildPlannerHistoryDays({}, '2024-02-26', 0);
    expect(days.map((day) => day.dayDate)).toEqual([
      '2024-02-26',
      '2024-02-27',
      '2024-02-28',
      '2024-02-29',
      '2024-03-01',
      '2024-03-02',
      '2024-03-03',
    ]);
  });

  it('keeps all seven calendar days across spring and autumn DST transitions', () => {
    for (const week of ['2026-03-02', '2026-03-23', '2026-10-19', '2026-10-26']) {
      const days = buildPlannerHistoryDays({}, week, 0);
      expect(days.length).toBe(7);
      expect(new Set(days.map((day) => day.dayDate)).size).toBe(7);
      expect(days[0].dayDate).toBe(week);
      const end = new Date(week + 'T12:00:00');
      end.setDate(end.getDate() + 6);
      expect(days[6].dayDate).toBe(getDbDateStr(end));
    }
  });

  it('uses completion dates rather than planned or tracked dates and includes zero time', () => {
    const completed = task('completed', {
      dueDay: '2026-05-01',
      timeSpent: 0,
      timeSpentOnDay: {},
    });
    const trackedEarlier = task('tracked', { timeSpentOnDay: { ['2026-05-01']: 60000 } });
    const days = buildPlannerHistoryDays({ completed, trackedEarlier }, '2026-06-15', 0);
    expect(days[2].tasks).toEqual([completed, trackedEarlier]);
    expect(days.filter((day) => day.tasks.length)).toHaveSize(1);
  });

  it('shows only completed main tasks with a saved completion date in the selected week', () => {
    const tasks = [
      task('parent', { subTaskIds: ['sub'] }),
      task('sub', { parentId: 'parent' }),
      task('undone', { isDone: false }),
      task('missing', { doneOn: undefined }),
      task('invalid', { doneOn: NaN }),
      task('older', { doneOn: new Date(2026, 4, 1, 12).getTime() }),
    ];
    const days = buildPlannerHistoryDays(
      Object.fromEntries(tasks.map((t) => [t.id, t])),
      '2026-06-15',
      0,
    );
    expect(days.flatMap((day) => day.tasks).map((t) => t.id)).toEqual(['parent']);
  });

  it('places early-morning completions on the preceding logical day', () => {
    const completed = task('early', { doneOn: new Date(2026, 5, 15, 2, 30).getTime() });
    const offset = 4 * 60 * 60 * 1000;
    expect(buildPlannerHistoryDays({ completed }, '2026-06-15', offset)[0].tasks).toEqual(
      [],
    );
    expect(buildPlannerHistoryDays({ completed }, '2026-06-08', offset)[6].tasks).toEqual(
      [completed],
    );
    expect(buildPlannerHistoryDays({ completed }, '2026-06-15', 0)[0].tasks).toEqual([
      completed,
    ]);
  });

  it('orders by completion time without mutating input tasks', () => {
    const later = Object.freeze(
      task('later', { doneOn: new Date(2026, 5, 17, 15).getTime() }),
    );
    const earlyB = Object.freeze(task('b'));
    const earlyA = Object.freeze(task('a'));
    const entities = Object.freeze({ later, earlyB, earlyA });
    const days = buildPlannerHistoryDays(entities, '2026-06-15', 0);
    expect(days[2].tasks).toEqual([earlyA, earlyB, later]);
    expect(entities.later).toBe(later);
  });

  it('returns only the selected seven days from a large retained history', () => {
    const entities: Record<string, Task> = {};
    const date = new Date(2015, 0, 1, 12);
    for (let i = 0; i < 10000; i++) {
      const id = `retained-${i}`;
      entities[id] = task(id, { doneOn: date.getTime() });
      date.setDate(date.getDate() + 1);
    }
    const days = buildPlannerHistoryDays(entities, '2026-06-15', 0);
    expect(days).toHaveSize(7);
    expect(days.every((day) => day.tasks.length === 1)).toBeTrue();
    expect(days.flatMap((day) => day.tasks)).toHaveSize(7);
  });
});
