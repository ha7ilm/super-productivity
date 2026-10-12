import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Action } from '@ngrx/store';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { MatDialog } from '@angular/material/dialog';
import { PlannerDayComponent } from './planner-day.component';
import { PlannerDay } from '../planner.model';
import { TaskService } from '../../tasks/task.service';
import { DateService } from '../../../core/date/date.service';
import { LayoutService } from '../../../core-ui/layout/layout.service';
import { DateTimeFormatService } from '../../../core/date-time-format/date-time-format.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DEFAULT_TASK, TaskCopy } from '../../tasks/task.model';
import { tagReducer } from '../../tag/store/tag.reducer';
import { TODAY_TAG } from '../../tag/tag.const';
import { taskSharedSchedulingMetaReducer } from '../../../root-store/meta/task-shared-meta-reducers/task-shared-scheduling.reducer';
import { createStateWithExistingTasks } from '../../../root-store/meta/task-shared-meta-reducers/test-utils';
import { RootState } from '../../../root-store/root-state';

describe('PlannerDayComponent', () => {
  const createComponent = (
    currentLocale: string,
    isoTextLocale: string | null,
  ): PlannerDayComponent => {
    TestBed.configureTestingModule({
      imports: [PlannerDayComponent],
      providers: [
        provideMockStore(),
        { provide: MatDialog, useValue: jasmine.createSpyObj('MatDialog', ['open']) },
        { provide: TaskService, useValue: {} },
        { provide: DateService, useValue: {} },
        { provide: LayoutService, useValue: { isXs: signal(false) } },
        {
          provide: DateTimeFormatService,
          useValue: {
            currentLocale: signal(currentLocale),
            isoTextLocale: signal(isoTextLocale),
          },
        },
      ],
    });
    TestBed.overrideComponent(PlannerDayComponent, { set: { template: '' } });
    const component = TestBed.createComponent(PlannerDayComponent).componentInstance;
    component.day = { dayDate: '2026-05-11' } as PlannerDay;
    return component;
  };

  const getDayLabel = (component: PlannerDayComponent): string =>
    (
      component as unknown as {
        dayLabel: () => string;
      }
    ).dayLabel();

  const createRenderedComponent = (): ComponentFixture<PlannerDayComponent> => {
    TestBed.configureTestingModule({
      imports: [PlannerDayComponent, TranslateModule.forRoot()],
      providers: [
        provideMockStore(),
        { provide: MatDialog, useValue: jasmine.createSpyObj('MatDialog', ['open']) },
        { provide: TaskService, useValue: {} },
        { provide: DateService, useValue: {} },
        { provide: LayoutService, useValue: { isXs: signal(false) } },
        {
          provide: DateTimeFormatService,
          useValue: {
            currentLocale: signal('en'),
            isoTextLocale: signal('en'),
          },
        },
      ],
    });
    const translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', {
      F: {
        PLANNER: {
          DAY_LOAD: 'Planned: {{planned}} / Available: {{available}}',
          NO_TASKS: 'No tasks',
        },
      },
      G: { ADD: 'Add' },
    });
    translateService.use('en');

    const fixture = TestBed.createComponent(PlannerDayComponent);
    fixture.componentInstance.day = {
      dayDate: '2026-05-11',
      timeEstimate: 0,
      timeLimit: 0,
      itemsTotal: 0,
      tasks: [],
      deadlineTasks: [],
      noStartTimeRepeatProjections: [],
      allDayEvents: [],
      scheduledIItems: [],
      availableHours: 7 * 60 * 60 * 1000,
      progressPercentage: 0,
    };
    fixture.detectChanges();
    return fixture;
  };

  beforeAll(() => registerLocaleData(localeDe, 'de-DE'));

  it('uses the UI language for the weekday label with ISO formatting enabled', () => {
    const component = createComponent('sv', 'de');

    expect(getDayLabel(component)).toBe('Mo');
  });

  it('preserves Angular weekday formatting for non-ISO locales', () => {
    const component = createComponent('de-DE', null);

    expect(getDayLabel(component)).toBe('Mo.');
  });

  it('labels planned and available time and displays an explicit zero', () => {
    const fixture = createRenderedComponent();
    const dayLoad = fixture.nativeElement.querySelector('.day-load');

    expect(dayLoad?.textContent.trim()).toBe('Planned: 0m / Available: 7h');
  });

  describe('reordering Today tasks', () => {
    const cases = [
      { fromIndex: 0, toIndex: 2, isDone: false, expected: ['B', 'C', 'A'] },
      { fromIndex: 0, toIndex: 1, isDone: false, expected: ['B', 'A', 'C'] },
      { fromIndex: 2, toIndex: 1, isDone: false, expected: ['A', 'C', 'B'] },
      { fromIndex: 2, toIndex: 0, isDone: false, expected: ['C', 'A', 'B'] },
      { fromIndex: 2, toIndex: 0, isDone: true, expected: ['C', 'A', 'B'] },
    ];

    for (const { fromIndex, toIndex, isDone, expected } of cases) {
      it(`moves a ${isDone ? 'completed' : 'pending'} task from index ${fromIndex} to ${toIndex}`, () => {
        const component = createComponent('en', 'en');
        const tasks: TaskCopy[] = ['A', 'B', 'C'].map((id) => ({
          ...DEFAULT_TASK,
          id,
          projectId: 'INBOX',
          dueDay: component.day.dayDate,
          isDone,
        }));
        component.day = { ...component.day, isToday: true, tasks };
        const store = TestBed.inject(MockStore);
        const dispatch = spyOn(store, 'dispatch');
        const container = { data: component.day.dayDate } as CdkDropList<string>;
        const event: CdkDragDrop<string, string, TaskCopy> = {
          previousIndex: fromIndex,
          currentIndex: toIndex,
          item: { data: tasks[fromIndex] } as CdkDrag<TaskCopy>,
          container,
          previousContainer: container,
          isPointerOverContainer: true,
          distance: { x: 0, y: 0 },
          dropPoint: { x: 0, y: 0 },
          event: new MouseEvent('mouseup'),
        };

        component.drop('TODO', tasks, event);

        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch).toHaveBeenCalledWith(
          jasmine.objectContaining({ src: 'UNDONE', target: 'UNDONE' }),
        );
        const reducer = taskSharedSchedulingMetaReducer((state, action) => ({
          ...(state as RootState),
          tag: tagReducer((state as RootState).tag, action),
        }));
        const initialState = createStateWithExistingTasks(
          ['A', 'B', 'C'],
          [],
          [],
          ['A', 'B', 'C'],
        );
        initialState.tasks.entities = Object.fromEntries(
          tasks.map((task) => [task.id, task]),
        );
        const state = reducer(
          initialState,
          dispatch.calls.mostRecent().args[0] as unknown as Action,
        ) as RootState;
        expect(state.tag.entities[TODAY_TAG.id]?.taskIds).toEqual(expected);
        expect(state.tasks).toBe(initialState.tasks);
        expect(tasks.map((task) => task.id)).toEqual(['A', 'B', 'C']);
      });
    }
  });
});
