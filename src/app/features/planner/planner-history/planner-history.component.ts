import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DateAdapter } from '@angular/material/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatTooltip } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { combineLatest, Subject, startWith, switchMap } from 'rxjs';
import { GlobalTrackingIntervalService } from '../../../core/global-tracking-interval/global-tracking-interval.service';
import { DatePickerInputComponent } from '../../../ui/date-picker-input/date-picker-input.component';
import { ShortDate2Pipe } from '../../../ui/pipes/short-date2.pipe';
import { getDbDateStr } from '../../../util/get-db-date-str';
import { parseDbDateStr } from '../../../util/parse-db-date-str';
import { Task } from '../../tasks/task.model';
import { DialogViewArchivedTaskComponent } from '../../tasks/dialog-view-archived-task/dialog-view-archived-task.component';
import { T } from '../../../t.const';
import { PlannerHistoryDayComponent } from './planner-history-day.component';
import {
  PlannerHistoryLoadState,
  PlannerHistoryService,
} from './planner-history.service';
import { normalizePlannerHistoryWeek } from './planner-history.util';

@Component({
  selector: 'planner-history',
  templateUrl: './planner-history.component.html',
  styleUrl: './planner-history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PlannerHistoryService],
  imports: [
    RouterLink,
    FormsModule,
    MatButton,
    MatIconButton,
    MatIcon,
    MatTooltip,
    MatProgressSpinner,
    TranslatePipe,
    DatePickerInputComponent,
    ShortDate2Pipe,
    PlannerHistoryDayComponent,
  ],
})
export class PlannerHistoryComponent {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _dateAdapter = inject(DateAdapter);
  private readonly _historyService = inject(PlannerHistoryService);
  private readonly _matDialog = inject(MatDialog);
  private readonly _globalTrackingIntervalService = inject(GlobalTrackingIntervalService);
  private readonly _queryParams = toSignal(this._route.queryParamMap, {
    initialValue: this._route.snapshot.queryParamMap,
  });
  private readonly _retry$ = new Subject<void>();

  readonly T = T;
  readonly today = this._globalTrackingIntervalService.todayDateStr;
  readonly weekStart = computed(() =>
    normalizePlannerHistoryWeek(
      this._queryParams().get('week'),
      this.today(),
      this._dateAdapter.getFirstDayOfWeek(),
    ),
  );
  readonly weekEnd = computed(() => {
    const date = parseDbDateStr(this.weekStart());
    date.setDate(date.getDate() + 6);
    return getDbDateStr(date);
  });
  readonly isCurrentWeek = computed(
    () =>
      this.weekStart() ===
      normalizePlannerHistoryWeek(
        null,
        this.today(),
        this._dateAdapter.getFirstDayOfWeek(),
      ),
  );
  readonly loadState = toSignal(
    combineLatest([
      toObservable(this.weekStart),
      this._retry$.pipe(startWith(undefined)),
    ]).pipe(switchMap(([week]) => this._historyService.loadWeek$(week))),
    { initialValue: { status: 'loading' } as PlannerHistoryLoadState },
  );

  moveWeek(direction: -1 | 1): void {
    const date = parseDbDateStr(this.weekStart());
    const dayOffset = direction * 7;
    date.setDate(date.getDate() + dayOffset);
    this.selectDate(date);
  }

  selectDate(date: Date | null): void {
    if (!date || Number.isNaN(date.getTime())) return;
    const week = normalizePlannerHistoryWeek(
      getDbDateStr(date),
      this.today(),
      this._dateAdapter.getFirstDayOfWeek(),
    );
    void this._router.navigate([], {
      relativeTo: this._route,
      queryParams: { week },
      queryParamsHandling: 'merge',
    });
  }

  retry(): void {
    this._retry$.next();
  }

  viewTask(task: Task): void {
    const state = this.loadState();
    if (state.status !== 'ready') return;
    this._matDialog.open(DialogViewArchivedTaskComponent, {
      restoreFocus: true,
      data: {
        task,
        subTasks: task.subTaskIds
          .map((id) => state.entities[id])
          .filter((subTask): subTask is Task => !!subTask),
        readOnly: true,
      },
    });
  }
}
