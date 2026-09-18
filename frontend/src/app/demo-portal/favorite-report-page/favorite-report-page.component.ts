import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { MockReportKey } from '../../mock/mock-reports';
import { AuthService } from '../../services/auth.service';
import {
  MockFavoriteReport,
  MockRbacService,
} from '../../services/mock-rbac.service';
import { NotificationService } from '../../services/notification.service';

type FavoriteReportSortField = 'ReportName' | 'FavoritedAt' | 'LastUsedAt';
type FavoriteReportSortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-favorite-report-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './favorite-report-page.component.html',
  styleUrl: './favorite-report-page.component.scss',
})
export class FavoriteReportPageComponent {
  readonly AllCategoryFilterValue = 'ALL';
  readonly Auth = inject(AuthService);
  private readonly MockRbac = inject(MockRbacService);
  private readonly Notifications = inject(NotificationService);
  private readonly router = inject(Router);

  SelectedFavoriteCategoryId = this.AllCategoryFilterValue;
  FavoriteSearchText = '';
  IsFavoriteReportSortActive = false;
  FavoriteReportSortField: FavoriteReportSortField = 'LastUsedAt';
  FavoriteReportSortDirection: FavoriteReportSortDirection = 'desc';

  get FavoriteReports(): readonly MockFavoriteReport[] {
    const Account = this.Auth.CurrentUser?.Account;
    return Account && this.Auth.IsFrontOffice
      ? this.MockRbac.GetFavoriteReports(Account)
      : [];
  }

  get FavoriteReportCategories() {
    const CategoryIds = new Set(
      this.FavoriteReports.map(({ Report }) => Report.CategoryId),
    );
    return this.MockRbac.GetCategories().filter((Category) =>
      CategoryIds.has(Category.CategoryId),
    );
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
    if (
      !this.MockRbac.RemoveFavoriteReport(Account, Favorite.Report.ReportKey)
    ) {
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
    if (Account) this.MockRbac.RecordReportExecution(Account, ReportKey);
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
}
