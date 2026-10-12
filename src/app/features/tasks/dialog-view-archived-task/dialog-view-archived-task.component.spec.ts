import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { DateTimeFormatService } from '../../../core/date-time-format/date-time-format.service';
import { TaskArchiveService } from '../../archive/task-archive.service';
import { IssueService } from '../../issue/issue.service';
import { TaskRepeatCfgService } from '../../task-repeat-cfg/task-repeat-cfg.service';
import { DEFAULT_TASK, Task } from '../task.model';
import {
  DialogViewArchivedTaskComponent,
  ViewArchivedTaskData,
} from './dialog-view-archived-task.component';

describe('DialogViewArchivedTaskComponent', () => {
  const parent: Task = {
    ...DEFAULT_TASK,
    id: 'parent',
    projectId: 'p',
    subTaskIds: ['child'],
    repeatCfgId: 'repeat',
  };
  const child: Task = {
    ...DEFAULT_TASK,
    id: 'child',
    projectId: 'p',
    parentId: 'parent',
    title: 'Child task',
  };
  let archive: jasmine.SpyObj<TaskArchiveService>;
  let dialog: jasmine.SpyObj<MatDialog>;

  const create = (
    data: ViewArchivedTaskData,
  ): ComponentFixture<DialogViewArchivedTaskComponent> => {
    TestBed.configureTestingModule({
      imports: [DialogViewArchivedTaskComponent, TranslateModule.forRoot()],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialog, useValue: dialog },
        { provide: TaskArchiveService, useValue: archive },
        { provide: IssueService, useValue: {} },
        { provide: DateTimeFormatService, useValue: { currentLocale: signal('en') } },
        {
          provide: TaskRepeatCfgService,
          useValue: { getTaskRepeatCfgByIdAllowUndefined$: () => of(undefined) },
        },
      ],
    });
    return TestBed.createComponent(DialogViewArchivedTaskComponent);
  };

  beforeEach(() => {
    archive = jasmine.createSpyObj<TaskArchiveService>('TaskArchiveService', ['load']);
    archive.load.and.resolveTo({ ids: ['child'], entities: { child } });
    dialog = jasmine.createSpyObj('MatDialog', ['open']);
  });

  it('shows supplied subtasks without reloading archived copies', () => {
    const fixture = create({ task: parent, subTasks: [child], readOnly: true });
    fixture.detectChanges();
    expect(fixture.componentInstance.subTasks()).toEqual([child]);
    expect(fixture.nativeElement.textContent).toContain('Child task');
    expect(archive.load).not.toHaveBeenCalled();
  });

  it('keeps repeat configuration read-only in Planner History', () => {
    const fixture = create({ task: parent, subTasks: [], readOnly: true });
    fixture.componentInstance.repeatCfgLabel.set('Every day');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Every day');
    expect(fixture.nativeElement.querySelector('.repeat-value')).toBeNull();
    fixture.componentInstance.openRepeatCfg();
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('preserves archive loading and repeat editing for existing History callers', async () => {
    const fixture = create({ task: parent });
    await fixture.whenStable();
    expect(fixture.componentInstance.subTasks()).toEqual([child]);
    expect(archive.load).toHaveBeenCalled();
    fixture.componentInstance.openRepeatCfg();
    expect(dialog.open).toHaveBeenCalled();
  });
});
