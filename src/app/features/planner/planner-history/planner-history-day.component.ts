import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { DateTimeFormatService } from '../../../core/date-time-format/date-time-format.service';
import { ShortDate2Pipe } from '../../../ui/pipes/short-date2.pipe';
import { MsToStringPipe } from '../../../ui/duration/ms-to-string.pipe';
import { parseDbDateStr } from '../../../util/parse-db-date-str';
import { safeFormatDate } from '../../../util/safe-format-date';
import { TagListComponent } from '../../tag/tag-list/tag-list.component';
import { Task } from '../../tasks/task.model';
import { T } from '../../../t.const';
import { PlannerHistoryDay } from './planner-history.util';

@Component({
  selector: 'planner-history-day',
  templateUrl: './planner-history-day.component.html',
  styleUrl: './planner-history-day.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatIcon,
    MatTooltip,
    TranslatePipe,
    ShortDate2Pipe,
    MsToStringPipe,
    TagListComponent,
  ],
  host: {
    // eslint-disable-next-line @typescript-eslint/naming-convention -- Angular host binding syntax
    '[attr.data-day]': 'day().dayDate',
  },
})
export class PlannerHistoryDayComponent {
  private readonly _dateTimeFormatService = inject(DateTimeFormatService);
  readonly T = T;
  readonly day = input.required<PlannerHistoryDay>();
  readonly isToday = input(false);
  readonly taskViewed = output<Task>();
  readonly dayLabel = computed(() => {
    const locale = this._dateTimeFormatService.isoTextLocale();
    return locale
      ? parseDbDateStr(this.day().dayDate).toLocaleDateString(locale, {
          weekday: 'short',
        })
      : safeFormatDate(
          this.day().dayDate,
          'EEE',
          this._dateTimeFormatService.currentLocale(),
        );
  });
}
