import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-portal-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav *ngIf="TotalPages > 1" class="list-pagination" [attr.aria-label]="AriaLabel">
      <button
        type="button"
        class="list-pagination-previous"
        [disabled]="CurrentPage === 1"
        (click)="SelectPage(CurrentPage - 1)"
      >
        上一頁
      </button>
      <button
        *ngFor="let Page of PageNumbers"
        type="button"
        [class.is-active]="Page === CurrentPage"
        [attr.aria-current]="Page === CurrentPage ? 'page' : null"
        (click)="SelectPage(Page)"
      >
        {{ Page }}
      </button>
      <button
        type="button"
        class="list-pagination-next"
        [disabled]="CurrentPage === TotalPages"
        (click)="SelectPage(CurrentPage + 1)"
      >
        下一頁
      </button>
    </nav>
  `,
})
export class PortalPaginationComponent {
  @Input({ required: true }) CurrentPage = 1;
  @Input({ required: true }) TotalPages = 1;
  @Input({ required: true }) PageNumbers: readonly number[] = [];
  @Input({ required: true }) AriaLabel = '';
  @Output() readonly PageChange = new EventEmitter<number>();

  SelectPage(Page: number): void {
    if (Page < 1 || Page > this.TotalPages || Page === this.CurrentPage) {
      return;
    }

    this.PageChange.emit(Page);
  }
}
