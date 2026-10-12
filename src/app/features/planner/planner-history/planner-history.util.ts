import { Task } from '../../tasks/task.model';
import { getDbDateStr, isValidDBDateStr } from '../../../util/get-db-date-str';
import { parseDbDateStr } from '../../../util/parse-db-date-str';
import { buildDayWindow } from '../util/build-day-window';

export interface PlannerHistoryDay {
  dayDate: string;
  tasks: Task[];
}

export const normalizePlannerHistoryWeek = (
  requestedDate: string | null,
  today: string,
  firstDayOfWeek: number,
): string => {
  const date = parseDbDateStr(
    requestedDate && isValidDBDateStr(requestedDate) && requestedDate <= today
      ? requestedDate
      : today,
  );
  // Calendar-day arithmetic at midday keeps week boundaries stable across DST.
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() - firstDayOfWeek + 7) % 7));
  return getDbDateStr(date);
};

export const buildPlannerHistoryDays = (
  entities: Readonly<Record<string, Task | undefined>>,
  weekStart: string,
  startOfNextDayDiffMs: number,
): PlannerHistoryDay[] => {
  const days = buildDayWindow(
    parseDbDateStr(weekStart),
    7,
    [0, 1, 2, 3, 4, 5, 6],
    getDbDateStr,
  ).map((dayDate) => ({ dayDate, tasks: [] as Task[] }));
  const daysByDate = new Map(days.map((day) => [day.dayDate, day]));

  for (const task of Object.values(entities)) {
    if (
      !task?.isDone ||
      task.parentId ||
      typeof task.doneOn !== 'number' ||
      !Number.isFinite(task.doneOn)
    ) {
      continue;
    }
    const completionDay = getDbDateStr(task.doneOn - startOfNextDayDiffMs);
    daysByDate.get(completionDay)?.tasks.push(task);
  }
  for (const day of days) {
    day.tasks.sort(
      (a, b) => (a.doneOn ?? 0) - (b.doneOn ?? 0) || a.id.localeCompare(b.id),
    );
  }
  return days;
};
