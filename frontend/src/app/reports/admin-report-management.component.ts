import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminReport, AdminReportService, CategoryOption, CreateReportRequest, DataSourceOption } from '../services/admin-report.service';
import { PortalLayoutComponent } from './portal-layout.component';

@Component({
  selector: 'app-admin-report-management', standalone: true, imports: [CommonModule, FormsModule, PortalLayoutComponent],
  template: `<app-portal-layout><main class="page"><h1>RPT Report Management</h1><p class="error" *ngIf="error">{{ error }}</p><form (ngSubmit)="save()"><h2>Create report</h2><input [(ngModel)]="draft.reportCode" name="code" placeholder="Report code" required><input [(ngModel)]="draft.reportName" name="name" placeholder="Report name" required><input [(ngModel)]="draft.description" name="description" placeholder="Description"><select [(ngModel)]="draft.categoryId" name="category" required><option [ngValue]="0">Select category</option><option *ngFor="let c of categories" [ngValue]="c.categoryId">{{ c.categoryName }}</option></select><select [(ngModel)]="draft.dataSourceId" name="source" required><option [ngValue]="0">Select data source</option><option *ngFor="let s of dataSources" [ngValue]="s.dataSourceId">{{ s.dataSourceName }}</option></select><input type="file" accept=".rpt" (change)="selectFile($any($event.target).files[0])"><button [disabled]="saving">{{ saving ? 'Saving...' : 'Create and upload RPT' }}</button></form><h2>Reports</h2><table><tr><th>Code</th><th>Name</th><th>RPT</th><th>Status</th></tr><tr *ngFor="let report of reports"><td>{{ report.reportCode }}</td><td>{{ report.reportName }}</td><td>{{ report.rptFileName || 'Not uploaded' }}</td><td>{{ report.isEnabled ? 'Enabled' : 'Disabled' }}</td></tr></table></main></app-portal-layout>`,
  styles: ['.page{max-width:1000px;margin:0 auto}.page h1{margin-top:0}form{display:grid;gap:.7rem;max-width:520px;padding:1rem;border:1px solid #ddd;background:#fff}input,select,button{padding:.55rem}.error{color:#b42318}table{width:100%;margin-top:1rem;border-collapse:collapse;background:#fff}th,td{padding:.7rem;text-align:left;border-bottom:1px solid #ddd}'],
})
export class AdminReportManagementComponent implements OnInit {
  private readonly api = inject(AdminReportService);
  reports: AdminReport[] = []; categories: CategoryOption[] = []; dataSources: DataSourceOption[] = []; file: File | null = null; saving = false; error = '';
  draft: CreateReportRequest = { reportCode: '', reportName: '', description: '', categoryId: 0, dataSourceId: 0, credentialType: 'ReadOnly' };
  ngOnInit(): void { this.load(); this.api.getCategories().subscribe({ next: data => this.categories = data, error: () => this.error = 'Unable to load categories.' }); this.api.getDataSources().subscribe({ next: data => this.dataSources = data, error: () => this.error = 'Unable to load data sources.' }); }
  selectFile(file: File | undefined): void { this.file = file ?? null; }
  load(): void { this.api.getReports().subscribe({ next: data => this.reports = data, error: () => this.error = 'Unable to load reports. Restart the API and try again.' }); }
  save(): void {
    if (!this.file) { this.error = 'Select an RPT file.'; return; }
    if (!this.draft.categoryId || !this.draft.dataSourceId) { this.error = 'Select a category and data source.'; return; }
    this.saving = true; this.error = '';
    this.api.create(this.draft).subscribe({
      next: report => this.api.uploadRtp(report.reportId, this.file!).subscribe({
        next: () => { this.saving = false; this.file = null; this.draft = { reportCode: '', reportName: '', description: '', categoryId: 0, dataSourceId: 0, credentialType: 'ReadOnly' }; this.load(); },
        error: response => { this.saving = false; this.error = response.error?.message ?? 'RPT upload failed.'; },
      }),
      error: response => { this.saving = false; this.error = response.error?.message ?? 'Report creation failed.'; },
    });
  }
}