import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ReportService, ReportSummary } from '../services/report.service';
import { PortalLayoutComponent } from './portal-layout.component';

@Component({
  selector: 'app-report-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PortalLayoutComponent],
  template: `
    <app-portal-layout><main class="report-page">
      <h1>報表清單</h1>
      <p *ngIf="loading">載入報表中…</p>
      <p *ngIf="error" class="error">{{ error }}</p>
      <label>搜尋 <input [(ngModel)]="search" /></label>
      <table *ngIf="!loading">
        <thead><tr><th>報表</th><th>分類</th><th>說明</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let report of filteredReports">
            <td>{{ report.reportName }}</td>
            <td>{{ report.category.categoryName }}</td>
            <td>{{ report.description || '—' }}</td>
            <td><button type="button" (click)="select(report)">選擇</button></td>
          </tr>
          <tr *ngIf="!filteredReports.length"><td colspan="4">目前沒有可執行的報表。</td></tr>
        </tbody>
      </table>
    </main></app-portal-layout>
  `,
  styles: ['.report-page{max-width:1100px;margin:0 auto;padding:0 1rem}.report-page h1{margin-top:0}table{width:100%;margin-top:1rem;border-collapse:collapse;background:#fff}th,td{padding:.75rem;border-bottom:1px solid #ddd;text-align:left}.error{color:#b42318}input{margin-left:.5rem}'],
})
export class ReportListComponent implements OnInit {
  private readonly reportsApi = inject(ReportService);
  private readonly router = inject(Router);
  reports: ReportSummary[] = [];
  search = '';
  loading = true;
  error = '';

  ngOnInit(): void {
    this.reportsApi.getReports().subscribe({
      next: response => { this.reports = response.reports; this.loading = false; },
      error: () => { this.error = '無法載入報表，請重新登入後再試。'; this.loading = false; },
    });
  }

  get filteredReports(): ReportSummary[] {
    const query = this.search.trim().toLowerCase();
    return !query ? this.reports : this.reports.filter(report =>
      `${report.reportName} ${report.reportCode} ${report.description ?? ''}`.toLowerCase().includes(query));
  }

  select(report: ReportSummary): void {
    this.reportsApi.selectReport(report);
    void this.router.navigate(['/reports/parameters']);
  }
}
