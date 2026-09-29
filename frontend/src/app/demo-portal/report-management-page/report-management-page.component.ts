import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';

import { CommonParameterTemplatePageComponent } from '../common-parameter-template-page/common-parameter-template-page.component';
import { ManagedReportPageComponent } from '../managed-report-page/managed-report-page.component';

/** Hosts the two database-backed report administration tools. */
@Component({
  selector: 'app-report-management-page',
  standalone: true,
  imports: [CommonModule, CommonParameterTemplatePageComponent, ManagedReportPageComponent],
  templateUrl: './report-management-page.component.html',
  styleUrl: './report-management-page.component.scss',
})
export class ReportManagementPageComponent {
  ActiveManagementTab: 'reports' | 'common-parameters' = 'reports';

  @ViewChild(ManagedReportPageComponent)
  private managedReportPage?: ManagedReportPageComponent;

  OpenCreate(): void {
    this.ActiveManagementTab = 'reports';
    this.managedReportPage?.openCreate();
  }

  OpenManagedCategoryManagement(): void {
    this.ActiveManagementTab = 'reports';
    this.managedReportPage?.openCategoryManagement();
  }
}
