import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';

@Component({
  selector: 'app-portal-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav *ngIf="TotalPages > 1" class="list-pagination" [attr.aria-label]="AriaLabel">
      <div class="list-pagination__controls">
        <button
          type="button"
          class="list-pagination__direction"
          [disabled]="CurrentPage === 1"
          (click)="SelectPage(CurrentPage - 1)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
          <span>上一頁</span>
        </button>
        <button
          *ngFor="let Page of PageNumbers"
          type="button"
          class="list-pagination__page"
          [class.is-active]="Page === CurrentPage"
          [attr.aria-current]="Page === CurrentPage ? 'page' : null"
          [attr.aria-label]="'第 ' + Page + ' 頁'"
          (click)="SelectPage(Page)"
        >
          {{ Page }}
        </button>
        <button
          type="button"
          class="list-pagination__direction"
          [disabled]="CurrentPage === TotalPages"
          (click)="SelectPage(CurrentPage + 1)"
        >
          <span>下一頁</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg>
        </button>
      </div>
      <form class="list-pagination__jump" (submit)="GoToRequestedPage(); $event.preventDefault()">
        <label>
          <span>頁碼</span>
          <input
            type="number"
            min="1"
            [max]="TotalPages"
            inputmode="numeric"
            aria-label="輸入頁碼"
            [value]="JumpPage"
            (input)="OnJumpPageInput($event)"
          />
        </label>
        <button type="submit">前往</button>
      </form>
    </nav>
  `,
  styleUrl: './portal-pagination.component.scss',
})
export class PortalPaginationComponent implements OnChanges {
  @Input({ required: true }) CurrentPage = 1;
  @Input({ required: true }) TotalPages = 1;
  @Input({ required: true }) PageNumbers: readonly number[] = [];
  @Input({ required: true }) AriaLabel = '';
  @Output() readonly PageChange = new EventEmitter<number>();
  JumpPage = 1;

  ngOnChanges(Changes: SimpleChanges): void {
    if (Changes['CurrentPage']) this.JumpPage = this.CurrentPage;
    if (Changes['TotalPages']) this.JumpPage = this.ClampPage(this.JumpPage);
  }

  SelectPage(Page: number): void {
    if (Page < 1 || Page > this.TotalPages || Page === this.CurrentPage) {
      return;
    }

    this.PageChange.emit(Page);
  }

  OnJumpPageInput(Event: Event): void {
    this.JumpPage = Number((Event.target as HTMLInputElement).value);
  }

  GoToRequestedPage(): void {
    this.JumpPage = this.ClampPage(this.JumpPage);
    this.SelectPage(this.JumpPage);
  }

  private ClampPage(Page: number): number {
    if (!Number.isFinite(Page)) return this.CurrentPage;
    return Math.min(Math.max(1, Math.trunc(Page)), this.TotalPages);
  }
}
