import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { filter, firstValueFrom, ReplaySubject } from 'rxjs';
import { DataInitStateService } from '../../../core/data-init/data-init-state.service';
import { DateService } from '../../../core/date/date.service';
import { TaskArchiveService } from '../../archive/task-archive.service';
import { DEFAULT_TASK, Task, TaskArchive } from '../../tasks/task.model';
import { initialTaskState } from '../../tasks/store/task.reducer';
import { selectTaskFeatureState } from '../../tasks/store/task.selectors';
import {
  PlannerHistoryLoadState,
  PlannerHistoryService,
} from './planner-history.service';

describe('PlannerHistoryService', () => {
  let service: PlannerHistoryService;
  let initialized$: ReplaySubject<boolean>;
  let archive: jasmine.SpyObj<TaskArchiveService>;
  let store: MockStore;
  const task = (id: string, changes: Partial<Task> = {}): Task => ({
    ...DEFAULT_TASK,
    id,
    projectId: 'p',
    isDone: true,
    doneOn: new Date(2026, 5, 17, 12).getTime(),
    ...changes,
  });
  const setActive = (tasks: Task[]): void => {
    store.overrideSelector(selectTaskFeatureState, {
      ...initialTaskState,
      ids: tasks.map((t) => t.id),
      entities: Object.fromEntries(tasks.map((t) => [t.id, t])),
    });
    store.refreshState();
  };
  const result = (): Promise<PlannerHistoryLoadState> =>
    firstValueFrom(
      service.loadWeek$('2026-06-15').pipe(filter((state) => state.status !== 'loading')),
    );

  beforeEach(() => {
    initialized$ = new ReplaySubject<boolean>(1);
    archive = jasmine.createSpyObj<TaskArchiveService>('TaskArchiveService', ['load']);
    archive.load.and.resolveTo({ ids: [], entities: {} });
    TestBed.configureTestingModule({
      providers: [
        PlannerHistoryService,
        provideMockStore(),
        {
          provide: DataInitStateService,
          useValue: { isAllDataLoadedInitially$: initialized$ },
        },
        { provide: TaskArchiveService, useValue: archive },
        { provide: DateService, useValue: { getStartOfNextDayDiffMs: () => 0 } },
      ],
    });
    store = TestBed.inject(MockStore);
    setActive([]);
    service = TestBed.inject(PlannerHistoryService);
  });

  it('waits for hydration and never dispatches a state change', async () => {
    const dispatch = spyOn(store, 'dispatch');
    const states: PlannerHistoryLoadState[] = [];
    const subscription = service
      .loadWeek$('2026-06-15')
      .subscribe((state) => states.push(state));
    expect(states).toEqual([{ status: 'loading' }]);
    expect(archive.load).not.toHaveBeenCalled();
    initialized$.next(true);
    await result();
    expect(states.at(-1)?.status).toBe('ready');
    expect(dispatch).not.toHaveBeenCalled();
    subscription.unsubscribe();
  });

  it('includes all archived and active main tasks across projects with active precedence', async () => {
    const archived = task('archived', { projectId: 'old-project' });
    const completed = task('active', { projectId: 'new-project' });
    const reopened = task('reopened', { isDone: false, doneOn: undefined });
    archive.load.and.resolveTo({
      ids: ['archived', 'active', 'reopened'],
      entities: { archived, active: task('active'), reopened: task('reopened') },
    });
    setActive([completed, reopened]);
    initialized$.next(true);
    const state = await result();
    expect(state.status).toBe('ready');
    if (state.status !== 'ready') fail('Expected ready');
    else {
      expect(state.days[2].tasks).toEqual([completed, archived]);
      expect(state.entities['reopened']).toBe(reopened);
      expect(state.entities['active']).toBe(completed);
    }
  });

  it('reads the latest active state after an archive request completes', async () => {
    let finishArchive!: (state: TaskArchive) => void;
    archive.load.and.returnValue(
      new Promise((resolve) => {
        finishArchive = resolve;
      }),
    );
    initialized$.next(true);
    const loading = result();
    const current = task('current');
    setActive([current]);
    finishArchive({ ids: [], entities: {} });
    const state = await loading;
    if (state.status === 'ready') expect(state.days[2].tasks).toEqual([current]);
    else fail('Expected ready');
  });

  it('returns an error rather than an empty week and permits retrying', async () => {
    initialized$.next(true);
    archive.load.and.rejectWith(new Error('Archive unavailable'));
    expect(await result()).toEqual({ status: 'error' });
    archive.load.and.resolveTo({ ids: [], entities: {} });
    expect((await result()).status).toBe('ready');
  });
});
