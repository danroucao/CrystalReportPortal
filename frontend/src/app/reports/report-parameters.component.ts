import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ReportParameter, ReportService } from '../services/report.service';
import { PortalLayoutComponent } from './portal-layout.component';

@Component({
  selector: 'app-report-parameters',
  standalone: true,
  imports: [CommonModule, FormsModule, PortalLayoutComponent],
  template: `
    <app-portal-layout><main class="report-page">
      <h1>報表參數</h1>
      <p *ngIf="!report">請先從報表清單選擇報表。</p>
      <ng-container *ngIf="report">
        <h2>{{ report.reportName }}</h2>
        <p *ngIf="loading">載入參數中…</p>
        <p *ngIf="error" class="error">{{ error }}</p>
        <form *ngIf="!loading" (ngSubmit)="execute()">
          <label *ngFor="let parameter of visibleParameters">
            {{ parameter.displayName }} <span *ngIf="parameter.required">*</span>
            <select *ngIf="isSelect(parameter)" [(ngModel)]="values[parameter.parameterId]" [name]="parameter.name" [multiple]="parameter.multiple">
              <option value="">請選擇</option>
              <option *ngFor="let option of options[parameter.parameterId] || []" [value]="option.value">{{ option.label }}</option>
            </select>
            <input *ngIf="!isSelect(parameter)" [type]="inputType(parameter)" [(ngModel)]="values[parameter.parameterId]" [name]="parameter.name" />
          </label>
          <p *ngIf="validationError" class="error">{{ validationError }}</p>
          <button type="submit" [disabled]="!report.permissions.canExecute">執行報表</button>
        </form>
      </ng-container>
    </main></app-portal-layout>
  `,
  styles: ['.report-page{max-width:760px;margin:0 auto;padding:0 1rem}.report-page h1{margin-top:0}label{display:block;margin:1rem 0}input,select{display:block;width:100%;max-width:420px;margin-top:.35rem;padding:.45rem}.error{color:#b42318}button{padding:.55rem 1rem}'],
})
export class ReportParametersComponent implements OnInit {
  private readonly reportsApi = inject(ReportService);
  private readonly router = inject(Router);
  readonly report = this.reportsApi.selectedReport;
  parameters: ReportParameter[] = [];
  options: Record<number, { value: string; label: string }[]> = {};
  values: Record<number, string> = {};
  loading = !!this.report;
  error = '';
  validationError = '';

  ngOnInit(): void {
    if (!this.report) return;
    this.reportsApi.getParameters(this.report.reportId).subscribe({
      next: response => {
        this.parameters = response.data;
        this.loading = false;
        for (const parameter of this.parameters.filter(this.isSelect)) {
          this.reportsApi.getParameterOptions(this.report!.reportId, parameter.parameterId).subscribe({
            next: options => this.options[parameter.parameterId] = options.data,
          });
        }
      },
      error: () => { this.error = '無法載入報表參數。'; this.loading = false; },
    });
  }

  get visibleParameters(): ReportParameter[] { return this.parameters.filter(parameter => parameter.visible); }
  isSelect = (parameter: ReportParameter): boolean => parameter.inputType === 'Select' || parameter.inputType === 'MultiSelect';
  inputType(parameter: ReportParameter): string { return parameter.dataType === 'Date' ? 'date' : parameter.dataType === 'Number' ? 'number' : 'text'; }

  execute(): void {
    const missing = this.visibleParameters.find(parameter => parameter.required && !this.values[parameter.parameterId]);
    if (missing) { this.validationError = `請輸入「${missing.displayName}」。`; return; }
    this.validationError = '';
    void this.router.navigate(['/reports/preview']);
  }
}
