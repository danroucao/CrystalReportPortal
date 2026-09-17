import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MockReportCategory } from '../../mock/mock-report-categories';
import { ReportEditorDraft } from './report-editor-form.model';

@Component({
  selector: 'app-report-editor-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './report-editor-form.component.html',
  styleUrl: './report-editor-form.component.scss',
})
export class ReportEditorFormComponent {
  @Input({ required: true }) variant!: 'modal' | 'upload-page';
  @Input({ required: true }) draft!: Readonly<ReportEditorDraft>;
  @Input({ required: true }) categories!: readonly MockReportCategory[];
  @Input() isEditing = false;
  @Input() selectedFileName = '';
  @Input() error = '';
  @Input() canAddCategory = false;
  @Input() quickAddOpen = false;
  @Input() quickAddName = '';
  @Input() quickAddError = '';

  @Output() readonly draftChange = new EventEmitter<ReportEditorDraft>();
  @Output() readonly quickAddNameChange = new EventEmitter<string>();
  @Output() readonly submitRequested = new EventEmitter<void>();
  @Output() readonly cancelRequested = new EventEmitter<void>();
  @Output() readonly quickAddRequested = new EventEmitter<void>();
  @Output() readonly quickAddCancelled = new EventEmitter<void>();
  @Output() readonly quickAddSubmitted = new EventEmitter<void>();
  @Output() readonly fileSelected = new EventEmitter<Event>();

  get IsUploadPage(): boolean {
    return this.variant === 'upload-page';
  }

  get IdPrefix(): string {
    return this.IsUploadPage ? 'report-upload' : 'report-editor';
  }

  get QuickAddInputId(): string {
    return this.IsUploadPage ? 'report-upload-category-add' : 'report-category-quick-add-name';
  }

  get QuickAddLabelId(): string {
    return this.IsUploadPage ? 'report-upload-category-add-label' : 'report-category-quick-add-label';
  }

  UpdateDraft<K extends keyof ReportEditorDraft>(Field: K, Value: ReportEditorDraft[K]): void {
    this.draftChange.emit({ ...this.draft, [Field]: Value });
  }

  OnQuickAddEnter(Event: Event): void {
    // The upload page retains its native form submission; only the modal consumes Enter.
    if (this.IsUploadPage) return;
    Event.preventDefault();
    this.quickAddSubmitted.emit();
  }

  TrackCategoryById(_: number, Category: MockReportCategory): string {
    return Category.CategoryId;
  }
}
