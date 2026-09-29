import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, of } from 'rxjs';

import { API_BASE_URL } from './api.config';

export interface CenterNotification {
  readonly Id: string;
  readonly Title: string;
  readonly Summary: string;
  readonly Detail: string;
  readonly TargetPath: string | null;
  readonly CreatedAt: string;
  ReadAt: string | null;
}

interface ApiNotification {
  notificationId: number;
  title: string;
  summary: string;
  detail: string;
  targetPath: string | null;
  createdAt: string;
  readAt: string | null;
}

/** Database-backed notification cache for the currently authenticated user. */
@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  private notifications: CenterNotification[] = [];

  constructor(private readonly http: HttpClient) {}

  getAll(): readonly CenterNotification[] {
    return [...this.notifications].sort(
      (left, right) => right.CreatedAt.localeCompare(left.CreatedAt),
    );
  }

  getUnreadCount(): number {
    return this.notifications.filter((item) => !item.ReadAt).length;
  }

  GetNotifications(_account: string): readonly CenterNotification[] {
    return this.getAll();
  }

  GetUnreadNotificationCount(_account: string): number {
    return this.getUnreadCount();
  }

  refresh(): void {
    this.http.get<ApiNotification[]>(`${API_BASE_URL}/notifications`)
      .pipe(catchError(() => of<ApiNotification[] | null>(null)))
      .subscribe((response) => {
        if (response === null) return;
        this.notifications = response.map((item) => ({
          Id: String(item.notificationId),
          Title: item.title,
          Summary: item.summary,
          Detail: item.detail,
          TargetPath: item.targetPath,
          CreatedAt: item.createdAt,
          ReadAt: item.readAt,
        }));
      });
  }

  RefreshFromApi(_account: string): void {
    this.refresh();
  }

  markRead(id: string): void {
    const notification = this.notifications.find((item) => item.Id === id);
    if (!notification || notification.ReadAt) return;

    notification.ReadAt = new Date().toISOString();
    this.http.put<void>(`${API_BASE_URL}/notifications/${id}/read`, {})
      .pipe(catchError(() => {
        notification.ReadAt = null;
        return of(void 0);
      }))
      .subscribe();
  }

  MarkNotificationRead(id: string, _account: string): void {
    this.markRead(id);
  }

  markAllRead(): void {
    const unread = this.notifications.filter((item) => !item.ReadAt);
    if (!unread.length) return;

    const readAt = new Date().toISOString();
    unread.forEach((item) => item.ReadAt = readAt);
    this.http.put<void>(`${API_BASE_URL}/notifications/read-all`, {})
      .pipe(catchError(() => {
        unread.forEach((item) => item.ReadAt = null);
        return of(void 0);
      }))
      .subscribe();
  }

  MarkAllNotificationsRead(_account: string): void {
    this.markAllRead();
  }

  clearRead(): void {
    const previous = this.notifications;
    this.notifications = previous.filter((item) => !item.ReadAt);
    if (previous.length === this.notifications.length) return;

    this.http.delete<void>(`${API_BASE_URL}/notifications/read`)
      .pipe(catchError(() => {
        this.notifications = previous;
        return of(void 0);
      }))
      .subscribe();
  }

  ClearReadNotifications(_account: string): void {
    this.clearRead();
  }

}
