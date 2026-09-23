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
      <ng-container *ngFor="let Item of VisiblePageItems">
        <span *ngIf="Item === 'ellipsis'" class="list-pagination-ellipsis" aria-hidden="true">
          …
        </span>
        <button
          *ngIf="Item !== 'ellipsis'"
          type="button"
          [class.is-active]="Item === CurrentPage"
          [attr.aria-current]="Item === CurrentPage ? 'page' : null"
          (click)="SelectPage(Item)"
        >
          {{ Item }}
        </button>
      </ng-container>
      <button
        type="button"
        class="list-pagination-next"
        [disabled]="CurrentPage === TotalPages"
        (click)="SelectPage(CurrentPage + 1)"
      >
        下一頁
      </button>
      <label class="list-pagination-jump">
        <span>頁碼</span>
        <input
          #targetPage
          type="number"
          inputmode="numeric"
          min="1"
          [max]="TotalPages"
          [value]="CurrentPage"
          aria-label="輸入欲前往的頁碼"
          (keydown.enter)="SelectPageValue(targetPage.value)"
        />
      </label>
      <button
        type="button"
        class="list-pagination-go"
        (click)="SelectPageValue(targetPage.value)"
      >
        前往
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

  get VisiblePageItems(): readonly (number | 'ellipsis')[] {
    const totalPages = Math.max(1, this.TotalPages);
    const currentPage = Math.min(Math.max(1, this.CurrentPage), totalPages);

    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);

    if (currentPage <= 4) {
      start = 2;
      end = 5;
    } else if (currentPage >= totalPages - 3) {
      start = totalPages - 4;
      end = totalPages - 1;
    }

    const items: (number | 'ellipsis')[] = [1];
    if (start > 2) items.push('ellipsis');
    for (let page = start; page <= end; page += 1) items.push(page);
    if (end < totalPages - 1) items.push('ellipsis');
    items.push(totalPages);
    return items;
  }

  SelectPage(Page: number): void {
    if (Page < 1 || Page > this.TotalPages || Page === this.CurrentPage) {
      return;
    }

    this.PageChange.emit(Page);
  }

  SelectPageValue(Value: string): void {
    const page = Number(Value);
    if (!Number.isInteger(page)) return;
    this.SelectPage(page);
  }
}
