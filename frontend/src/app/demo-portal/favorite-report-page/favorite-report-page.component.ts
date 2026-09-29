import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { MockReportKey, MockReportReadModel } from '../../mock/mock-reports';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { ReportService } from '../../services/report.service';

type FavoriteReportSortField = 'ReportName' | 'FavoritedAt' | 'LastUsedAt';
type FavoriteReportSortDirection = 'asc' | 'desc';

interface StoredFavoriteReport {
  readonly FavoritedAt: string;
  readonly LastUsedAt: string | null;
}

@Component({
  selector: 'app-favorite-report-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './favorite-report-page.component.html',
  styleUrl: './favorite-report-page.component.scss',
})
export class FavoriteReportPageComponent implements OnInit {
  readonly AllCategoryFilterValue = 'ALL';
  readonly Auth = inject(AuthService);
  private readonly Notifications = inject(NotificationService);
  private readonly Reports = inject(ReportService);
  private readonly router = inject(Router);
  private FavoriteReportStates: Record<MockReportKey, StoredFavoriteReport> = {};

  SelectedFavoriteCategoryId = this.AllCategoryFilterValue;
  FavoriteSearchText = '';
  IsFavoriteReportSortActive = false;
  FavoriteReportSortField: FavoriteReportSortField = 'LastUsedAt';
  FavoriteReportSortDirection: FavoriteReportSortDirection = 'desc';

  ngOnInit(): void {
    // A browser refresh clears AuthService's in-memory report cache. Reloading
    // here ensures persisted favorite keys can be resolved back to reports.
    this.Reports.GetReports().subscribe({
      next: (Reports) => {
        this.Auth.SetAccessibleReports(Reports);
        this.LoadFavoriteReports();
      },
    });
  }

  get FavoriteReports(): readonly { Report: MockReportReadModel; FavoritedAt: string; LastUsedAt: string | null }[] {
    if (!this.Auth.IsFrontOffice) return [];
    return this.Auth.AccessibleReports
      .filter((Report) => this.FavoriteReportStates[Report.ReportKey] !== undefined)
      .map((Report) => ({
        Report,
        FavoritedAt: this.FavoriteReportStates[Report.ReportKey].FavoritedAt,
        LastUsedAt: this.FavoriteReportStates[Report.ReportKey].LastUsedAt,
      }));
  }

  get FavoriteReportCategories() {
    return [...new Map(
      this.FavoriteReports.map(({ Report }) => [
        Report.CategoryId,
        { CategoryId: Report.CategoryId, CategoryName: Report.CategoryName },
      ]),
    ).values()];
  }

  get DisplayedFavoriteReports(): readonly { Report: MockReportReadModel; FavoritedAt: string; LastUsedAt: string | null }[] {
    const Direction = this.FavoriteReportSortDirection === 'asc' ? 1 : -1;
    const SearchText =
      this.FavoriteSearchText.trim().toLocaleLowerCase('zh-Hant');
    return this.FavoriteReports.filter(
      ({ Report }) =>
        (this.SelectedFavoriteCategoryId === this.AllCategoryFilterValue ||
          Report.CategoryId === this.SelectedFavoriteCategoryId) &&
        (!SearchText ||
          Report.ReportName.toLocaleLowerCase('zh-Hant').includes(SearchText) ||
          Report.Description.toLocaleLowerCase('zh-Hant').includes(SearchText)),
    ).sort((Left, Right) => {
      if (this.FavoriteReportSortField === 'ReportName') {
        return (
          Left.Report.ReportName.localeCompare(
            Right.Report.ReportName,
            'zh-Hant',
          ) * Direction
        );
      }
      const LeftTimestamp =
        this.FavoriteReportSortField === 'FavoritedAt'
          ? Left.FavoritedAt
          : Left.LastUsedAt;
      const RightTimestamp =
        this.FavoriteReportSortField === 'FavoritedAt'
          ? Right.FavoritedAt
          : Right.LastUsedAt;
      if (!LeftTimestamp && !RightTimestamp) {
        return Left.Report.ReportName.localeCompare(
          Right.Report.ReportName,
          'zh-Hant',
        );
      }
      if (!LeftTimestamp) return 1;
      if (!RightTimestamp) return -1;
      return (
        (new Date(LeftTimestamp).getTime() -
          new Date(RightTimestamp).getTime()) *
        Direction
      );
    });
  }

  SetFavoriteCategory(CategoryId: string): void {
    this.SelectedFavoriteCategoryId = CategoryId;
  }

  ToggleFavoriteReportNameSort(): void {
    this.ToggleFavoriteReportSort('ReportName');
  }

  ToggleFavoriteAtSort(): void {
    this.ToggleFavoriteReportSort('FavoritedAt');
  }

  ToggleFavoriteLastUsedSort(): void {
    this.ToggleFavoriteReportSort('LastUsedAt');
  }

  GetFavoriteReportSortIndicator(
    Field: FavoriteReportSortField,
  ): '↕' | '↑' | '↓' {
    if (
      !this.IsFavoriteReportSortActive ||
      this.FavoriteReportSortField !== Field
    ) {
      return '↕';
    }
    return this.FavoriteReportSortDirection === 'asc' ? '↑' : '↓';
  }

  GetFavoriteReportAriaSort(
    Field: FavoriteReportSortField,
  ): 'none' | 'ascending' | 'descending' {
    if (
      !this.IsFavoriteReportSortActive ||
      this.FavoriteReportSortField !== Field
    ) {
      return 'none';
    }
    return this.FavoriteReportSortDirection === 'asc'
      ? 'ascending'
      : 'descending';
  }

  FormatFavoriteLastUsedAt(LastUsedAt: string | null): string {
    if (!LastUsedAt) return '尚未使用';
    const DateValue = new Date(LastUsedAt);
    if (Number.isNaN(DateValue.getTime())) return '尚未使用';
    const Pad = (Value: number) => Value.toString().padStart(2, '0');
    return `${DateValue.getFullYear()}/${Pad(DateValue.getMonth() + 1)}/${Pad(
      DateValue.getDate(),
    )} ${Pad(DateValue.getHours())}:${Pad(DateValue.getMinutes())}`;
  }

  FormatFavoriteAt(FavoritedAt: string | null): string {
    if (!FavoritedAt) return '—';
    return this.FormatFavoriteLastUsedAt(FavoritedAt);
  }

  RemoveFavoriteReport(Favorite: { Report: MockReportReadModel; FavoritedAt: string; LastUsedAt: string | null }): void {
    const reportId = Number(Favorite.Report.ReportKey);
    if (!this.Auth.IsFrontOffice || !Number.isFinite(reportId)) return;
    delete this.FavoriteReportStates[Favorite.Report.ReportKey];
    this.Reports.RemoveFavoriteReport(reportId).subscribe({
      error: () => {
        this.LoadFavoriteReports();
        this.Notifications.ShowSuccess('無法取消收藏，請稍後再試。');
      },
    });
    if (
      this.SelectedFavoriteCategoryId !== this.AllCategoryFilterValue &&
      !this.FavoriteReportCategories.some(
        (Category) => Category.CategoryId === this.SelectedFavoriteCategoryId,
      )
    ) {
      this.SelectedFavoriteCategoryId = this.AllCategoryFilterValue;
    }
    this.Notifications.ShowSuccess(`已取消收藏「${Favorite.Report.ReportName}」。`);
  }

  SelectReportByKey(ReportKey: MockReportKey): void {
    const Report = this.Auth.AccessibleReports.find(
      (Entry) => Entry.ReportKey === ReportKey,
    );
    if (!Report?.Enabled) return;
    this.Auth.SelectReport(ReportKey);
    this.RecordFavoriteUsage(ReportKey);
    void this.router.navigate(['/reports/preview'], {
      state: { ReportPreviewOrigin: 'favorites' },
    });
  }

  BrowseAllReports(): void {
    if (!this.Auth.IsFrontOffice) return;
    void this.router.navigate(['/reports/parameters']);
  }

  private ToggleFavoriteReportSort(Field: FavoriteReportSortField): void {
    if (this.FavoriteReportSortField === Field) {
      this.FavoriteReportSortDirection =
        this.FavoriteReportSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.FavoriteReportSortField = Field;
      this.FavoriteReportSortDirection = 'asc';
    }
    this.IsFavoriteReportSortActive = true;
  }

  private LoadFavoriteReports(): void {
    this.Reports.GetFavoriteReports().subscribe({
      next: (favorites) => this.FavoriteReportStates = Object.fromEntries(favorites.map((favorite) => [
        String(favorite.reportId), { FavoritedAt: favorite.favoritedAt, LastUsedAt: favorite.lastUsedAt },
      ])),
      error: () => this.FavoriteReportStates = {},
    });
  }

  private RecordFavoriteUsage(ReportKey: MockReportKey): void {
    const reportId = Number(ReportKey);
    if (!this.FavoriteReportStates[ReportKey] || !Number.isFinite(reportId)) return;
    this.FavoriteReportStates[ReportKey] = {
      ...this.FavoriteReportStates[ReportKey], LastUsedAt: new Date().toISOString(),
    };
    this.Reports.RecordFavoriteReportUsage(reportId).subscribe();
  }
}
