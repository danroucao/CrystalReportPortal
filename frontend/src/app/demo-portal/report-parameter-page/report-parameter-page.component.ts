import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { Router } from '@angular/router';

import {
  MockLovStatus,
  MockParameterDefaultValue,
  MockParameterInputType,
  MockReportParameterDefinition,
} from '../../mock/mock-report-parameters';
import { MockReportKey } from '../../mock/mock-reports';
import { AuthService } from '../../services/auth.service';
import { MockRbacService } from '../../services/mock-rbac.service';
import { ReportParameterService } from '../../services/mock-report-parameter.service';
import { NotificationService } from '../../services/notification.service';
import { ReportService } from '../../services/report.service';
import { ReportExecutionRequest } from '../../services/report-api.models';
import { PortalPaginationComponent } from '../../shared/portal-pagination.component';

type MockParameterFormValue =
  | string
  | number
  | boolean
  | string[]
  | { Start: string | number | null; End: string | number | null }
  | null;

type ParameterReportSortField = 'ReportName' | 'CreatedAt' | 'UpdatedAt';
type ParameterReportSortDirection = 'asc' | 'desc';

interface ParameterReportCategoryTab {
  readonly CategoryId: string;
  readonly CategoryName: string;
  readonly Count: number;
}

interface ParameterReportSearchState {
  readonly CategoryId: string;
  readonly SearchText: string;
  readonly SortField: ParameterReportSortField | null;
  readonly SortDirection: ParameterReportSortDirection;
  readonly StartDate: string;
  readonly EndDate: string;
}

/**
 * Report discovery and dynamic parameter entry for the front-office portal.
 * The parent shell continues to own navigation, access guards, and page chrome.
 */
@Component({
  selector: 'app-report-parameter-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PortalPaginationComponent,
  ],
  templateUrl: './report-parameter-page.component.html',
  styleUrl: './report-parameter-page.component.scss',
})
export class ReportParameterPageComponent implements OnInit {
  readonly PaginationPageSize = 10;
  readonly AllCategoryFilterValue = 'ALL';
  readonly Auth = inject(AuthService);
  private readonly MockRbac = inject(MockRbacService);
  private readonly ReportParameters = inject(ReportParameterService);
  private readonly Notifications = inject(NotificationService);
  private readonly Reports = inject(ReportService);
  private readonly router = inject(Router);

  SelectedParameterReportCategoryId = this.AllCategoryFilterValue;
  ParameterReportStartDate = '';
  ParameterReportEndDate = '';
  ParameterReportDateNotice = '';
  ParameterReportSelectionNotice = '';
  ParameterReportSearchText = '';
  ParameterReportSortField: ParameterReportSortField | null = null;
  ParameterReportSortDirection: ParameterReportSortDirection = 'asc';
  ParameterReportCurrentPage = 1;
  IsReportParameterMode = false;
  ReportParameterDefinitions: MockReportParameterDefinition[] = [];
  ReportParameterForm = new FormGroup({});
  readonly ParameterRangeErrors: Record<string, string> = {};
  LastMockExecutionParameters: Readonly<
    Record<string, MockParameterFormValue>
  > | null = null;
  IsLoadingReports = false;
  IsLoadingReportParameters = false;
  ReportLoadError = '';
  private FavoriteReportKeys = new Set<MockReportKey>();

  @ViewChild('parameterReportSearchInput')
  private parameterReportSearchInput?: ElementRef<HTMLInputElement>;

  ngOnInit(): void {
    this.LoadFavoriteReports();
    this.LoadReports();
    const NavigationState =
      this.router.getCurrentNavigation()?.extras.state ?? history.state;
    this.RestoreParameterSearchState(NavigationState?.['ParameterSearchState']);
    this.ParameterReportSelectionNotice = NavigationState?.[
      'ReportSelectionRequired'
    ]
      ? '請先選擇報表。'
      : '';
    this.IsReportParameterMode =
      NavigationState?.['OpenReportParameters'] === true;
    if (this.IsReportParameterMode) this.LoadReportParameterForm();
  }

  get ParameterReports() {
    return this.Auth.AccessibleReports;
  }

  get ParameterReportCategoryTabs(): readonly ParameterReportCategoryTab[] {
    const Reports = this.ParameterReports;
    const Categories = new Map<string, string>();
    Reports.forEach((Report) =>
      Categories.set(Report.CategoryId, Report.CategoryName),
    );
    return [
      {
        CategoryId: this.AllCategoryFilterValue,
        CategoryName: '全部',
        Count: Reports.length,
      },
      ...Array.from(Categories.entries()).map(
        ([CategoryId, CategoryName]) => ({
          CategoryId,
          CategoryName,
          Count: Reports.filter(
            (Report) => Report.CategoryId === CategoryId,
          ).length,
        }),
      ),
    ];
  }

  get ParameterReportCategories() {
    return this.ParameterReportCategoryTabs.slice(1);
  }

  get ParameterReportDateValidationMessage(): string {
    return this.ParameterReportDateNotice;
  }

  get DisplayedParameterReports() {
    const SearchText =
      this.ParameterReportSearchText.trim().toLocaleLowerCase();
    const Reports = this.ParameterReports.filter(
      (Report) =>
        (this.SelectedParameterReportCategoryId ===
          this.AllCategoryFilterValue ||
          Report.CategoryId === this.SelectedParameterReportCategoryId) &&
        (!SearchText ||
          `${Report.ReportName} ${Report.CategoryName} ${Report.Description}`
            .toLocaleLowerCase()
            .includes(SearchText)),
    );
    if (!this.ParameterReportSortField) return Reports;

    const SortField = this.ParameterReportSortField;
    const Direction = this.ParameterReportSortDirection === 'asc' ? 1 : -1;
    return [...Reports].sort((Left, Right) => {
      if (SortField === 'ReportName') {
        return (
          Left.ReportName.localeCompare(Right.ReportName, 'zh-Hant') * Direction
        );
      }
      return (
        (new Date(Left[SortField]).getTime() -
          new Date(Right[SortField]).getTime()) *
        Direction
      );
    });
  }

  get HasParameterReportSearchText(): boolean {
    return Boolean(this.ParameterReportSearchText.trim());
  }

  get HasParameterReportFilters(): boolean {
    return (
      this.HasParameterReportSearchText ||
      Boolean(this.ParameterReportStartDate) ||
      Boolean(this.ParameterReportEndDate) ||
      this.SelectedParameterReportCategoryId !== this.AllCategoryFilterValue
    );
  }

  get ParameterReportFilterSummary(): string {
    const Filters: string[] = [];
    if (this.HasParameterReportSearchText) {
      Filters.push(`關鍵字「${this.ParameterReportSearchText.trim()}」`);
    }
    const Category = this.ParameterReportCategories.find(
      (Item) => Item.CategoryId === this.SelectedParameterReportCategoryId,
    );
    if (Category) Filters.push(`分類「${Category.CategoryName}」`);
    if (this.ParameterReportStartDate || this.ParameterReportEndDate) {
      Filters.push(
        `資料期間 ${this.ParameterReportStartDate || '不限'} 至 ${this.ParameterReportEndDate || '不限'}`,
      );
    }
    return Filters.join('、');
  }

  get ParameterReportTotalPages(): number {
    return this.GetTotalPages(this.DisplayedParameterReports.length);
  }

  get ParameterReportPageNumbers(): readonly number[] {
    return this.GetPageNumbers(this.ParameterReportTotalPages);
  }

  get PagedParameterReports() {
    return this.GetPagedItems(
      this.DisplayedParameterReports,
      this.ParameterReportCurrentPage,
    );
  }

  get VisibleReportParameters(): readonly MockReportParameterDefinition[] {
    return this.ReportParameterDefinitions.filter(
      (Definition) => Definition.IsVisible,
    ).sort((Left, Right) => Left.DisplayOrder - Right.DisplayOrder);
  }

  get SelectedReportKey(): MockReportKey | null {
    return this.Auth.SelectedReport?.ReportKey ?? null;
  }

  get CanGenerateReport(): boolean {
    return Boolean(
      this.Auth.SelectedReportCategoryPermission.CanExecute &&
      this.SelectedReportKey &&
      this.ReportParameterForm.valid &&
      this.VisibleReportParameters.every(
        (Definition) =>
          !this.UsesLov(Definition) ||
          this.GetLovStatus(Definition) === 'success',
      ),
    );
  }

  SetParameterReportCategory(CategoryId: string): void {
    this.SelectedParameterReportCategoryId = CategoryId;
    this.ResetParameterReportPagination();
  }

  OnParameterReportDateChange(): void {
    this.ResetParameterReportPagination();
    this.ParameterReportDateNotice = '';
    if (
      this.ParameterReportStartDate &&
      this.ParameterReportEndDate &&
      this.IsDateOnlyBefore(
        this.ParameterReportEndDate,
        this.ParameterReportStartDate,
      )
    ) {
      this.ParameterReportEndDate = this.ParameterReportStartDate;
      this.ParameterReportDateNotice =
        '結束日期不得早於開始日期，已同步為開始日期，請重新選擇。';
    }
  }

  OnParameterReportSearchChange(): void {
    this.ResetParameterReportPagination();
  }

  ClearParameterReportSearch(): void {
    if (!this.ParameterReportSearchText) return;
    this.ParameterReportSearchText = '';
    this.OnParameterReportSearchChange();
    this.parameterReportSearchInput?.nativeElement.focus();
  }

  ClearParameterReportFilters(): void {
    this.ParameterReportSearchText = '';
    this.ParameterReportStartDate = '';
    this.ParameterReportEndDate = '';
    this.SelectedParameterReportCategoryId = this.AllCategoryFilterValue;
    this.ParameterReportDateNotice = '';
    this.ResetParameterReportPagination();
    this.parameterReportSearchInput?.nativeElement.focus();
  }

  GoToParameterReportPage(Page: number): void {
    this.ParameterReportCurrentPage = this.ClampPage(
      Page,
      this.DisplayedParameterReports.length,
    );
  }

  PreviousParameterReportPage(): void {
    this.GoToParameterReportPage(this.ParameterReportCurrentPage - 1);
  }

  NextParameterReportPage(): void {
    this.GoToParameterReportPage(this.ParameterReportCurrentPage + 1);
  }

  ToggleParameterReportSort(Field: ParameterReportSortField): void {
    this.ResetParameterReportPagination();
    if (this.ParameterReportSortField === Field) {
      this.ParameterReportSortDirection =
        this.ParameterReportSortDirection === 'asc' ? 'desc' : 'asc';
      return;
    }
    this.ParameterReportSortField = Field;
    this.ParameterReportSortDirection = 'asc';
  }

  GetParameterReportSortIndicator(
    Field: ParameterReportSortField,
  ): '↕' | '↑' | '↓' {
    if (this.ParameterReportSortField !== Field) return '↕';
    return this.ParameterReportSortDirection === 'asc' ? '↑' : '↓';
  }

  GetParameterReportAriaSort(
    Field: ParameterReportSortField,
  ): 'ascending' | 'descending' | 'none' {
    if (this.ParameterReportSortField !== Field) return 'none';
    return this.ParameterReportSortDirection === 'asc'
      ? 'ascending'
      : 'descending';
  }

  IsFavoriteReport(ReportKey: MockReportKey): boolean {
    return this.FavoriteReportKeys.has(ReportKey);
  }

  ToggleFavoriteReport(ReportKey: MockReportKey): void {
    const Account = this.Auth.CurrentUser?.Account;
    if (!Account || !this.Auth.IsFrontOffice) return;
    const IsFavorite = !this.FavoriteReportKeys.has(ReportKey);
    if (IsFavorite) this.FavoriteReportKeys.add(ReportKey);
    else this.FavoriteReportKeys.delete(ReportKey);
    sessionStorage.setItem(
      this.GetFavoriteStorageKey(Account),
      JSON.stringify([...this.FavoriteReportKeys]),
    );
    const Report = this.Auth.AccessibleReports.find(
      (Entry) => Entry.ReportKey === ReportKey,
    );
    if (!Report) return;
    this.Notifications.ShowSuccess(
      IsFavorite
        ? `已收藏「${Report.ReportName}」。`
        : `已取消收藏「${Report.ReportName}」。`,
    );
  }

  GetControlKind(
    Definition: MockReportParameterDefinition,
  ): 'range' | 'textarea' | 'checkbox' | 'select' | 'input' {
    if (Definition.AllowRangeValues) return 'range';
    if (Definition.InputType === 'LongText') return 'textarea';
    if (Definition.InputType === 'Checkbox') return 'checkbox';
    if (
      Definition.InputType === 'SingleSelect' ||
      Definition.InputType === 'MultiSelect'
    ) {
      return 'select';
    }
    return 'input';
  }

  GetInputHtmlType(Definition: MockReportParameterDefinition): string {
    const TypeByInputType: Readonly<
      Partial<Record<MockParameterInputType, string>>
    > = {
      Date: 'date',
      DateTime: 'datetime-local',
      Number: 'number',
      Text: 'text',
    };
    return TypeByInputType[Definition.InputType] ?? 'text';
  }

  UsesLov(Definition: MockReportParameterDefinition): boolean {
    return Definition.ValueSourceType === 'SqlLov';
  }

  GetLovStatus(Definition: MockReportParameterDefinition): MockLovStatus {
    const ReportKey = this.SelectedReportKey;
    return ReportKey
      ? this.ReportParameters.GetLovStatus(ReportKey, Definition.ParameterName)
      : 'error';
  }

  GetLovOptions(Definition: MockReportParameterDefinition) {
    const ReportKey = this.SelectedReportKey;
    if (!ReportKey) return [];
    return Definition.ValueSourceType === 'SqlLov'
      ? this.ReportParameters.GetLovOptions(ReportKey, Definition.ParameterName)
      : (Definition.Options ?? []);
  }

  RetryLov(Definition: MockReportParameterDefinition): void {
    const ReportKey = this.SelectedReportKey;
    if (!ReportKey) return;
    this.ReportParameters.RetryLov(ReportKey, Definition.ParameterName);
    this.ReportParameterForm.updateValueAndValidity();
  }

  GetLovErrorMessage(Definition: MockReportParameterDefinition): string {
    const ReportKey = this.SelectedReportKey;
    if (!ReportKey) return '無法載入選項，請重試。';

    return this.ReportParameters.GetLovErrorMessage(
      ReportKey,
      Definition.ParameterName,
    );
  }

  OnRangeValueChange(Definition: MockReportParameterDefinition): void {
    if (Definition.DataType !== 'Date') return;
    const RangeControl = this.GetRangeControl(Definition);
    if (!RangeControl) return;

    const Start = RangeControl.controls['Start'].value;
    const End = RangeControl.controls['End'].value;
    if (!this.IsDateOnlyBefore(End, Start)) {
      delete this.ParameterRangeErrors[Definition.ParameterName];
      return;
    }

    RangeControl.controls['End'].setValue(Start);
    this.ParameterRangeErrors[Definition.ParameterName] =
      '結束日期不得早於開始日期，已同步為開始日期，請重新選擇。';
  }

  GetRangeStartValue(Definition: MockReportParameterDefinition): string | null {
    if (Definition.DataType !== 'Date') return null;
    const RangeControl = this.GetRangeControl(Definition);
    const StartValue = RangeControl?.controls['Start'].value;
    return typeof StartValue === 'string' && StartValue ? StartValue : null;
  }

  ResetReportParameters(): void {
    this.ReportParameterForm = this.BuildParameterForm(
      this.VisibleReportParameters,
    );
    Object.keys(this.ParameterRangeErrors).forEach(
      (Key) => delete this.ParameterRangeErrors[Key],
    );
    this.LastMockExecutionParameters = null;
  }

  GetParameterError(Definition: MockReportParameterDefinition): string {
    const Control = this.ReportParameterForm.get(Definition.ParameterName);
    if (!Control || !(Control.touched || Control.dirty)) return '';
    if (this.ParameterRangeErrors[Definition.ParameterName]) {
      return this.ParameterRangeErrors[Definition.ParameterName];
    }
    const ErrorControl = this.GetErrorControl(Control);
    if (ErrorControl.hasError('required')) return '此欄位為必填。';
    if (ErrorControl.hasError('integer')) return '請輸入整數。';
    if (ErrorControl.hasError('number')) return '請輸入有效數字。';
    if (ErrorControl.hasError('date')) return '請輸入有效日期。';
    if (ErrorControl.hasError('dateTime')) return '請輸入有效日期時間。';
    if (Control.hasError('range')) {
      return Definition.DataType === 'Date'
        ? '結束日期不得早於開始日期。'
        : '結束值不得小於開始值。';
    }
    return '';
  }

  SelectReportForParameters(ReportKey: MockReportKey): void {
    const Report = this.ParameterReports.find(
      (Entry) => Entry.ReportKey === ReportKey,
    );
    if (!Report) return;
    this.Auth.SelectReport(ReportKey);
    this.IsReportParameterMode = true;
    this.LoadReportParameterForm();
  }

  SelectReportForPreview(ReportKey: MockReportKey): void {
    const Report = this.ParameterReports.find(
      (Entry) => Entry.ReportKey === ReportKey,
    );
    if (!Report) return;
    this.Auth.SelectReport(
      ReportKey,
      this.ParameterReportStartDate && this.ParameterReportEndDate
        ? {
            StartDate: this.ParameterReportStartDate,
            EndDate: this.ParameterReportEndDate,
          }
        : null,
    );
    const Account = this.Auth.CurrentUser?.Account;
    if (Account) this.MockRbac.RecordReportExecution(Account, ReportKey);
    void this.router.navigate(['/reports/preview'], {
      state: {
        ReportPreviewOrigin: 'all',
        ParameterSearchState: this.CreateParameterSearchState(),
      },
    });
  }

  ReturnToParameterReportSearch(): void {
    this.IsReportParameterMode = false;
  }

  ExecuteReport(): void {
    if (!this.CanGenerateReport) {
      this.ReportParameterForm.markAllAsTouched();
      return;
    }
    const Report = this.Auth.SelectedReport;
    if (!Report) return;

    const ExecutionRequest: ReportExecutionRequest = {
      parameters: this.VisibleReportParameters
        .filter((Definition): Definition is MockReportParameterDefinition & { ParameterId: number } =>
          typeof Definition.ParameterId === 'number',
        )
        .map((Definition) => ({
          parameterId: Definition.ParameterId,
          values: this.ToExecutionValues(
            this.ReportParameterForm.get(Definition.ParameterName)?.value,
          ),
        })),
    };
    this.LastMockExecutionParameters = this.SerializeReportParameters();
    const Account = this.Auth.CurrentUser?.Account;
    if (Account) this.MockRbac.RecordReportExecution(Account, Report.ReportKey);
    void this.router.navigate(['/reports/preview'], {
      state: {
        ReportExecutionRequest: ExecutionRequest,
      },
    });
  }

  LoadReports(): void {
    this.IsLoadingReports = true;
    this.ReportLoadError = '';

    this.Reports.GetReports().subscribe({
      next: (Reports) => {
        this.Auth.SetAccessibleReports(Reports);
        this.IsLoadingReports = false;
        this.ParameterReportCurrentPage = 1;
      },
      error: () => {
        this.Auth.SetAccessibleReports([]);
        this.IsLoadingReports = false;
        this.ReportLoadError =
          '目前無法取得報表清單，請確認後端服務後再試一次。';
      },
    });
  }

  private LoadFavoriteReports(): void {
    const Account = this.Auth.CurrentUser?.Account;
    if (!Account) return;

    try {
      const Stored = JSON.parse(
        sessionStorage.getItem(this.GetFavoriteStorageKey(Account)) ?? '[]',
      ) as unknown;
      this.FavoriteReportKeys = new Set(
        Array.isArray(Stored)
          ? Stored.filter((Value): Value is string => typeof Value === 'string')
          : [],
      );
    } catch {
      this.FavoriteReportKeys.clear();
    }
  }

  private GetFavoriteStorageKey(Account: string): string {
    return `crystal-report-favorites:${Account}`;
  }

  private LoadReportParameterForm(): void {
    const Report = this.Auth.SelectedReport;
    const ReportKey = Report?.ReportKey;
    if (!ReportKey || !Report?.ReportId) {
      this.ReportParameterDefinitions = [];
      this.ReportParameterForm = new FormGroup({});
      return;
    }
    this.IsLoadingReportParameters = true;
    this.ReportParameters.LoadDefinitions(Report.ReportId, ReportKey).subscribe({
      next: (Definitions) => {
        this.ReportParameterDefinitions = Definitions;
        this.ReportParameterForm = this.BuildParameterForm(this.VisibleReportParameters);
        this.IsLoadingReportParameters = false;
      },
      error: () => {
        this.ReportParameterDefinitions = [];
        this.ReportParameterForm = new FormGroup({});
        this.IsLoadingReportParameters = false;
        this.ParameterReportSelectionNotice = '目前無法載入報表參數，請稍後再試。';
      },
    });
    Object.keys(this.ParameterRangeErrors).forEach(
      (Key) => delete this.ParameterRangeErrors[Key],
    );
    this.LastMockExecutionParameters = null;
  }

  private BuildParameterForm(
    Definitions: readonly MockReportParameterDefinition[],
  ): FormGroup {
    const Form = new FormGroup({});
    Definitions.forEach((Definition) => {
      if (Definition.AllowRangeValues) {
        const DefaultValue = this.GetRangeDefaultValue(Definition.DefaultValue);
        Form.addControl(
          Definition.ParameterName,
          new FormGroup(
            {
              Start: new FormControl(
                DefaultValue.Start,
                this.GetValueValidators(Definition),
              ),
              End: new FormControl(
                DefaultValue.End,
                this.GetValueValidators(Definition),
              ),
            },
            { validators: this.CreateRangeValidator(Definition) },
          ),
        );
        return;
      }

      Form.addControl(
        Definition.ParameterName,
        new FormControl(
          this.GetDefaultValue(Definition),
          this.GetValueValidators(Definition),
        ),
      );
    });
    return Form;
  }

  private GetDefaultValue(
    Definition: MockReportParameterDefinition,
  ): string | number | boolean | string[] | null {
    const DefaultValue = Definition.DefaultValue;
    if (Definition.AllowMultipleValues) {
      return Array.isArray(DefaultValue) ? [...DefaultValue] : [];
    }
    if (Definition.DataType === 'Boolean') return DefaultValue === true;
    if (Definition.DataType === 'Integer' || Definition.DataType === 'Float') {
      return typeof DefaultValue === 'number' ? DefaultValue : null;
    }
    return typeof DefaultValue === 'string' ? DefaultValue : '';
  }

  private GetRangeDefaultValue(DefaultValue: MockParameterDefaultValue): {
    Start: string | number | null;
    End: string | number | null;
  } {
    if (
      typeof DefaultValue === 'object' &&
      DefaultValue !== null &&
      !Array.isArray(DefaultValue) &&
      'Start' in DefaultValue &&
      'End' in DefaultValue
    ) {
      return { Start: DefaultValue.Start, End: DefaultValue.End };
    }
    return { Start: null, End: null };
  }

  private GetValueValidators(
    Definition: MockReportParameterDefinition,
  ): ValidatorFn[] {
    const Validators: ValidatorFn[] = [];
    if (Definition.IsRequired) Validators.push(this.RequiredParameterValidator);
    if (Definition.DataType === 'Integer') Validators.push(this.IntegerValidator);
    if (Definition.DataType === 'Float') Validators.push(this.NumberValidator);
    if (Definition.DataType === 'Date') Validators.push(this.DateValidator);
    if (Definition.DataType === 'DateTime') Validators.push(this.DateTimeValidator);
    return Validators;
  }

  private readonly RequiredParameterValidator: ValidatorFn = (
    Control: AbstractControl,
  ): ValidationErrors | null => {
    const Value = Control.value;
    return Value === null ||
      Value === undefined ||
      Value === '' ||
      (Array.isArray(Value) && Value.length === 0)
      ? { required: true }
      : null;
  };

  private readonly IntegerValidator: ValidatorFn = (
    Control: AbstractControl,
  ): ValidationErrors | null => {
    const Value = Control.value;
    if (Value === null || Value === '') return null;
    return Number.isInteger(Number(Value)) ? null : { integer: true };
  };

  private readonly NumberValidator: ValidatorFn = (
    Control: AbstractControl,
  ): ValidationErrors | null => {
    const Value = Control.value;
    if (Value === null || Value === '') return null;
    return Number.isFinite(Number(Value)) ? null : { number: true };
  };

  private readonly DateValidator: ValidatorFn = (
    Control: AbstractControl,
  ): ValidationErrors | null => {
    const Value = Control.value;
    if (Value === null || Value === '') return null;
    return this.ParseDateOnly(String(Value)) ? null : { date: true };
  };

  private readonly DateTimeValidator: ValidatorFn = (
    Control: AbstractControl,
  ): ValidationErrors | null => {
    const Value = Control.value;
    if (Value === null || Value === '') return null;
    return Number.isNaN(Date.parse(String(Value))) ? { dateTime: true } : null;
  };

  private CreateRangeValidator(
    Definition: MockReportParameterDefinition,
  ): ValidatorFn {
    return (Control: AbstractControl): ValidationErrors | null => {
      const RangeValue = Control.value as {
        Start?: string | number | null;
        End?: string | number | null;
      };
      if (
        RangeValue?.Start === null ||
        RangeValue?.Start === '' ||
        RangeValue?.End === null ||
        RangeValue?.End === ''
      ) {
        return null;
      }

      if (Definition.DataType === 'Date') {
        const Start = this.ParseDateOnly(String(RangeValue.Start));
        const End = this.ParseDateOnly(String(RangeValue.End));
        return !Start || !End || Start.getTime() <= End.getTime()
          ? null
          : { range: true };
      }

      const Start = Number(RangeValue.Start);
      const End = Number(RangeValue.End);
      return !Number.isFinite(Start) || !Number.isFinite(End) || Start <= End
        ? null
        : { range: true };
    };
  }

  private GetRangeControl(
    Definition: MockReportParameterDefinition,
  ): FormGroup | null {
    const Control = this.ReportParameterForm.get(Definition.ParameterName);
    return Control instanceof FormGroup ? Control : null;
  }

  private GetErrorControl(Control: AbstractControl): AbstractControl {
    if (!(Control instanceof FormGroup)) return Control;
    return (
      Object.values(Control.controls).find((Child) => Child.invalid) ?? Control
    );
  }

  private SerializeReportParameters(): Readonly<
    Record<string, MockParameterFormValue>
  > {
    return Object.fromEntries(
      this.VisibleReportParameters.map((Definition) => [
        Definition.ParameterName,
        this.SerializeParameterValue(
          Definition,
          this.ReportParameterForm.get(Definition.ParameterName)?.value,
        ),
      ]),
    );
  }

  private SerializeParameterValue(
    Definition: MockReportParameterDefinition,
    Value: unknown,
  ): MockParameterFormValue {
    if (Definition.AllowRangeValues) {
      const RangeValue = Value as {
        Start: string | number | null;
        End: string | number | null;
      };
      return {
        Start: this.SerializeScalarValue(Definition, RangeValue.Start),
        End: this.SerializeScalarValue(Definition, RangeValue.End),
      } as { Start: string | number | null; End: string | number | null };
    }
    if (Definition.AllowMultipleValues) {
      return Array.isArray(Value) ? Value.map(String) : [];
    }
    return this.SerializeScalarValue(Definition, Value);
  }

  private ToExecutionValues(Value: unknown): string[] {
    if (Value === null || Value === undefined || Value === '') return [];
    if (Array.isArray(Value)) return Value.map(String);
    if (typeof Value === 'object' && Value !== null && 'Start' in Value && 'End' in Value) {
      const RangeValue = Value as { Start: unknown; End: unknown };
      return [RangeValue.Start, RangeValue.End]
        .filter((Item) => Item !== null && Item !== undefined && Item !== '')
        .map(String);
    }
    return [String(Value)];
  }

  private SerializeScalarValue(
    Definition: MockReportParameterDefinition,
    Value: unknown,
  ): string | number | boolean | null {
    if (Value === null || Value === '') return null;
    if (Definition.DataType === 'Boolean') return Boolean(Value);
    if (Definition.DataType === 'Integer' || Definition.DataType === 'Float') {
      return Number(Value);
    }
    return String(Value);
  }

  private IsDateOnlyBefore(
    EndDateValue: unknown,
    StartDateValue: unknown,
  ): boolean {
    const EndDate = this.ParseDateOnly(String(EndDateValue ?? ''));
    const StartDate = this.ParseDateOnly(String(StartDateValue ?? ''));
    return Boolean(
      EndDate && StartDate && EndDate.getTime() < StartDate.getTime(),
    );
  }

  private ParseDateOnly(DateValue: string): Date | null {
    const Match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(DateValue);
    if (!Match) return null;

    const Year = Number(Match[1]);
    const Month = Number(Match[2]);
    const Day = Number(Match[3]);
    const DateValueAsDate = new Date(Year, Month - 1, Day);
    return DateValueAsDate.getFullYear() === Year &&
      DateValueAsDate.getMonth() === Month - 1 &&
      DateValueAsDate.getDate() === Day
      ? DateValueAsDate
      : null;
  }

  private CreateParameterSearchState(): ParameterReportSearchState {
    return {
      CategoryId: this.SelectedParameterReportCategoryId,
      SearchText: this.ParameterReportSearchText,
      SortField: this.ParameterReportSortField,
      SortDirection: this.ParameterReportSortDirection,
      StartDate: this.ParameterReportStartDate,
      EndDate: this.ParameterReportEndDate,
    };
  }

  private GetTotalPages(ItemCount: number): number {
    return Math.max(1, Math.ceil(ItemCount / this.PaginationPageSize));
  }

  private GetPageNumbers(TotalPages: number): readonly number[] {
    return Array.from({ length: TotalPages }, (_, Index) => Index + 1);
  }

  private GetPagedItems<T>(
    Items: readonly T[],
    CurrentPage: number,
  ): readonly T[] {
    const StartIndex = (CurrentPage - 1) * this.PaginationPageSize;
    return Items.slice(StartIndex, StartIndex + this.PaginationPageSize);
  }

  private ClampPage(RequestedPage: number, ItemCount: number): number {
    return Math.min(Math.max(1, RequestedPage), this.GetTotalPages(ItemCount));
  }

  private ResetParameterReportPagination(): void {
    this.ParameterReportCurrentPage = 1;
  }

  private RestoreParameterSearchState(State: unknown): void {
    const SearchState = this.ToParameterSearchState(State);
    if (!SearchState) return;
    this.SelectedParameterReportCategoryId = SearchState.CategoryId;
    this.ParameterReportSearchText = SearchState.SearchText;
    this.ParameterReportSortField = SearchState.SortField;
    this.ParameterReportSortDirection = SearchState.SortDirection;
    this.ParameterReportStartDate = SearchState.StartDate;
    this.ParameterReportEndDate = SearchState.EndDate;
  }

  private ToParameterSearchState(
    State: unknown,
  ): ParameterReportSearchState | null {
    if (!State || typeof State !== 'object') return null;
    const Value = State as Partial<ParameterReportSearchState>;
    if (
      typeof Value.CategoryId !== 'string' ||
      typeof Value.SearchText !== 'string' ||
      (Value.SortField !== null &&
        Value.SortField !== 'ReportName' &&
        Value.SortField !== 'CreatedAt' &&
        Value.SortField !== 'UpdatedAt') ||
      (Value.SortDirection !== 'asc' && Value.SortDirection !== 'desc') ||
      typeof Value.StartDate !== 'string' ||
      typeof Value.EndDate !== 'string'
    ) {
      return null;
    }
    return {
      CategoryId: Value.CategoryId,
      SearchText: Value.SearchText,
      SortField: Value.SortField,
      SortDirection: Value.SortDirection,
      StartDate: Value.StartDate,
      EndDate: Value.EndDate,
    };
  }
}
