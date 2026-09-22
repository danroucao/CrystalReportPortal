import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';

@Component({
  selector: 'app-unsaved-changes-dialog',
  standalone: true,
  template: `
    <section class="modal-backdrop unsaved-changes-backdrop" role="presentation">
      <section
        class="edit-user-modal unsaved-changes-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        aria-describedby="unsaved-changes-description"
      >
        <h2 id="unsaved-changes-title">捨棄未儲存變更？</h2>
      <p id="unsaved-changes-description">你已修改{{ subject ? subject : '' }}資料。離開後無法還原。</p>
        <div class="modal-actions">
          <button #continueButton type="button" class="secondary-button" (click)="continueEditing.emit()">繼續編輯</button>
          <button type="button" class="danger-button" (click)="discardChanges.emit()">捨棄變更</button>
        </div>
      </section>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnsavedChangesDialogComponent {
  @ViewChild('continueButton') private continueButton?: ElementRef<HTMLButtonElement>;
  @Input() subject = '';
  @Output() readonly continueEditing = new EventEmitter<void>();
  @Output() readonly discardChanges = new EventEmitter<void>();

  FocusContinueButton(): void {
    this.continueButton?.nativeElement.focus();
  }
}
