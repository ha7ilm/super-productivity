import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { DateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { GlobalTrackingIntervalService } from '../../../core/global-tracking-interval/global-tracking-interval.service';
import { DEFAULT_TASK, Task } from '../../tasks/task.model';
import { PlannerHistoryComponent } from './planner-history.component';
import {
  PlannerHistoryLoadState,
  PlannerHistoryService,
} from './planner-history.service';

describe('PlannerHistoryComponent', () => {
  let fixture: ComponentFixture<PlannerHistoryComponent>;
  let component: PlannerHistoryComponent;
  let params$: BehaviorSubject<ParamMap>;
  let history: jasmine.SpyObj<PlannerHistoryService>;
  let router: jasmine.SpyObj<Router>;
  let dialog: jasmine.SpyObj<MatDialog>;
  const ready: PlannerHistoryLoadState = { status: 'ready', days: [], entities: {} };
  const render = (): void => {
    fixture = TestBed.createComponent(PlannerHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    TestBed.tick();
  };

  beforeEach(() => {
    params$ = new BehaviorSubject(convertToParamMap({}));
    history = jasmine.createSpyObj('PlannerHistoryService', ['loadWeek$']);
    history.loadWeek$.and.returnValue(of(ready));
    router = jasmine.createSpyObj('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    dialog = jasmine.createSpyObj('MatDialog', ['open']);
    TestBed.configureTestingModule({
      imports: [PlannerHistoryComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: params$,
            snapshot: { queryParamMap: params$.value },
          },
        },
        { provide: Router, useValue: router },
        { provide: DateAdapter, useValue: { getFirstDayOfWeek: () => 1 } },
        { provide: MatDialog, useValue: dialog },
        {
          provide: GlobalTrackingIntervalService,
          useValue: { todayDateStr: signal('2026-06-17') },
        },
      ],
    }).overrideComponent(PlannerHistoryComponent, {
      set: {
        template: '',
        imports: [],
        providers: [{ provide: PlannerHistoryService, useValue: history }],
      },
    });
  });

  it('opens on the current week with forward navigation disabled', () => {
    render();
    expect(component.weekStart()).toBe('2026-06-15');
    expect(component.weekEnd()).toBe('2026-06-21');
    expect(component.isCurrentWeek()).toBeTrue();
    expect(history.loadWeek$).toHaveBeenCalledWith('2026-06-15');
  });

  it('jumps to arbitrary older weeks and moves by seven calendar days', () => {
    render();
    component.selectDate(new Date(2026, 4, 7));
    expect(router.navigate.calls.mostRecent().args[1]?.queryParams).toEqual({
      week: '2026-05-04',
    });
    params$.next(convertToParamMap({ week: '2026-05-04' }));
    TestBed.tick();
    expect(component.isCurrentWeek()).toBeFalse();
    component.moveWeek(-1);
    expect(router.navigate.calls.mostRecent().args[1]?.queryParams).toEqual({
      week: '2026-04-27',
    });
    component.moveWeek(1);
    expect(router.navigate.calls.mostRecent().args[1]?.queryParams).toEqual({
      week: '2026-05-11',
    });
  });

  it('ignores results from a previous selection and reloads after retry', () => {
    const current$ = new Subject<PlannerHistoryLoadState>();
    const past$ = new Subject<PlannerHistoryLoadState>();
    history.loadWeek$.and.callFake((week) => (week === '2026-06-15' ? current$ : past$));
    render();
    params$.next(convertToParamMap({ week: '2026-05-04' }));
    TestBed.tick();
    current$.next(ready);
    expect(component.loadState().status).toBe('loading');
    past$.next({ status: 'error' });
    expect(component.loadState().status).toBe('error');
    component.retry();
    expect(history.loadWeek$).toHaveBeenCalledTimes(3);
    past$.next(ready);
    expect(component.loadState()).toEqual(ready);
  });

  it('supplies active and archived subtasks to read-only task details', () => {
    const parent: Task = {
      ...DEFAULT_TASK,
      id: 'parent',
      projectId: 'p',
      subTaskIds: ['child', 'missing'],
    };
    const child: Task = {
      ...DEFAULT_TASK,
      id: 'child',
      projectId: 'p',
      parentId: 'parent',
    };
    history.loadWeek$.and.returnValue(
      of({ status: 'ready', days: [], entities: { parent, child } }),
    );
    render();
    component.viewTask(parent);
    expect(dialog.open.calls.mostRecent().args[1]?.data).toEqual({
      task: parent,
      subTasks: [child],
      readOnly: true,
    });
  });
});
