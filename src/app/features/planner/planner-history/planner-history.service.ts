import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import {
  catchError,
  filter,
  firstValueFrom,
  from,
  Observable,
  of,
  startWith,
  switchMap,
  take,
} from 'rxjs';
import { DataInitStateService } from '../../../core/data-init/data-init-state.service';
import { DateService } from '../../../core/date/date.service';
import { TaskArchiveService } from '../../archive/task-archive.service';
import { Task } from '../../tasks/task.model';
import { selectTaskFeatureState } from '../../tasks/store/task.selectors';
import { buildPlannerHistoryDays, PlannerHistoryDay } from './planner-history.util';

export type PlannerHistoryLoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      days: PlannerHistoryDay[];
      entities: Readonly<Record<string, Task | undefined>>;
    };

@Injectable()
export class PlannerHistoryService {
  private readonly _store = inject(Store);
  private readonly _archiveService = inject(TaskArchiveService);
  private readonly _dataInitStateService = inject(DataInitStateService);
  private readonly _dateService = inject(DateService);

  loadWeek$(weekStart: string): Observable<PlannerHistoryLoadState> {
    return this._dataInitStateService.isAllDataLoadedInitially$.pipe(
      filter(Boolean),
      take(1),
      switchMap(() => from(this._loadWeek(weekStart))),
      catchError(() => of<PlannerHistoryLoadState>({ status: 'error' })),
      startWith<PlannerHistoryLoadState>({ status: 'loading' }),
    );
  }

  private async _loadWeek(weekStart: string): Promise<PlannerHistoryLoadState> {
    const archive = await this._archiveService.load();
    // Read active state after the archive has loaded, so restored/reopened tasks
    // take precedence over any older archived copy of the same task.
    const active = await firstValueFrom(this._store.select(selectTaskFeatureState));
    const entities = { ...archive.entities, ...active.entities };
    return {
      status: 'ready',
      entities,
      days: buildPlannerHistoryDays(
        entities,
        weekStart,
        this._dateService.getStartOfNextDayDiffMs(),
      ),
    };
  }
}
