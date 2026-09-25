import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { MockReportKey } from '../../mock/mock-reports';
import { AuthService } from '../../services/auth.service';
import {
  MockFavoriteReport,
  MockRbacService,
} from '../../services/mock-rbac.service';
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
  private readonly MockRbac = inject(MockRbacService);
  private readonly Notifications = inject(NotificationService);
  private readonly Reports = inject(ReportService);
  private readonly router = inject(Router);

  SelectedFavoriteCategoryId = this.AllCategoryFilterValue;
  FavoriteSearchText = '';
  IsFavoriteReportSortActive = false;
  FavoriteReportSortField: FavoriteReportSortField = 'LastUsedAt';
  FavoriteReportSortDirection: FavoriteReportSortDirection = 'desc';

  ngOnInit(): void {
    // A browser refresh clears AuthService's in-memory report cache. Reloading
    // here ensures persisted favorite keys can be resolved back to reports.
    this.Reports.GetReports().subscribe({
      next: (Reports) => this.Auth.SetAccessibleReports(Reports),
      error: () => {
        // Keep the existing in-memory/mock list as a graceful fallback.
      },
    });
  }

  get FavoriteReports(): readonly MockFavoriteReport[] {
    const Account = this.Auth.CurrentUser?.Account;
    if (!Account || !this.Auth.IsFrontOffice) return [];

    // Reports loaded from the API have numeric report keys, so they are not
    // part of the legacy mock RBAC favorite store. Prefer the same per-user
    // session store used by the all-reports page whenever it exists.
    const StoredFavorites = this.GetStoredFavoriteReports(Account);
    if (StoredFavorites !== null) {
      return this.Auth.AccessibleReports
        .filter((Report) => StoredFavorites[Report.ReportKey] !== undefined)
        .map((Report) => ({
          Report,
          FavoritedAt: StoredFavorites[Report.ReportKey].FavoritedAt,
          LastUsedAt: StoredFavorites[Report.ReportKey].LastUsedAt,
        }));
    }

    return this.MockRbac.GetFavoriteReports(Account);
  }

  get FavoriteReportCategories() {
    return [...new Map(
      this.FavoriteReports.map(({ Report }) => [
        Report.CategoryId,
        { CategoryId: Report.CategoryId, CategoryName: Report.CategoryName },
      ]),
    ).values()];
  }

  get DisplayedFavoriteReports(): readonly MockFavoriteReport[] {
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

  RemoveFavoriteReport(Favorite: MockFavoriteReport): void {
    const Account = this.Auth.CurrentUser?.Account;
    if (!Account || !this.Auth.IsFrontOffice) return;

    const StoredFavorites = this.GetStoredFavoriteReports(Account);
    if (StoredFavorites !== null) {
      delete StoredFavorites[Favorite.Report.ReportKey];
      sessionStorage.setItem(
        this.GetFavoriteStorageKey(Account),
        JSON.stringify(StoredFavorites),
      );
    } else if (!this.MockRbac.RemoveFavoriteReport(Account, Favorite.Report.ReportKey)) {
      return;
    }
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
    const Account = this.Auth.CurrentUser?.Account;
    if (Account) {
      this.MockRbac.RecordReportExecution(Account, ReportKey);
      this.RecordFavoriteUsage(Account, ReportKey);
    }
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

  private GetStoredFavoriteReports(
    Account: string,
  ): Record<MockReportKey, StoredFavoriteReport> | null {
    const Serialized = sessionStorage.getItem(this.GetFavoriteStorageKey(Account));
    if (Serialized === null) return null;

    try {
      const Parsed = JSON.parse(Serialized) as unknown;
      if (Array.isArray(Parsed)) {
        const FavoritedAt = new Date().toISOString();
        const Migrated = Object.fromEntries(
          Parsed
            .filter((Value): Value is string => typeof Value === 'string')
            .map((ReportKey) => [ReportKey, { FavoritedAt, LastUsedAt: null }]),
        ) as Record<MockReportKey, StoredFavoriteReport>;
        sessionStorage.setItem(this.GetFavoriteStorageKey(Account), JSON.stringify(Migrated));
        return Migrated;
      }
      if (!Parsed || typeof Parsed !== 'object') return {};
      return Object.fromEntries(
        Object.entries(Parsed).flatMap(([ReportKey, Value]) => {
          if (!Value || typeof Value !== 'object') return [];
          const State = Value as Partial<StoredFavoriteReport>;
          return typeof State.FavoritedAt === 'string'
            ? [[ReportKey, {
                FavoritedAt: State.FavoritedAt,
                LastUsedAt: typeof State.LastUsedAt === 'string' ? State.LastUsedAt : null,
              }]]
            : [];
        }),
      ) as Record<MockReportKey, StoredFavoriteReport>;
    } catch {
      return {};
    }
  }

  private RecordFavoriteUsage(Account: string, ReportKey: MockReportKey): void {
    const Favorites = this.GetStoredFavoriteReports(Account);
    const Favorite = Favorites?.[ReportKey];
    if (!Favorites || !Favorite) return;
    Favorites[ReportKey] = { ...Favorite, LastUsedAt: new Date().toISOString() };
    sessionStorage.setItem(this.GetFavoriteStorageKey(Account), JSON.stringify(Favorites));
  }

  private GetFavoriteStorageKey(Account: string): string {
    return `crystal-report-favorites:${Account}`;
  }
}
