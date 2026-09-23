import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import { MockCenterNotification } from '../../services/mock-notification-center.service';
import { PortalPaginationComponent } from '../../shared/portal-pagination.component';
import { PortalTab, PortalTabsComponent } from '../../shared/portal-tabs.component';

@Component({
  selector: 'app-notification-center-page',
  standalone: true,
  imports: [CommonModule, PortalPaginationComponent, PortalTabsComponent],
  templateUrl: './notification-center-page.component.html',
  styleUrl: './notification-center-page.component.scss',
})
export class NotificationCenterPageComponent {
  @Input({ required: true }) Tabs: readonly PortalTab[] = [];
  @Input({ required: true }) ActiveTab: 'All' | 'Unread' = 'All';
  @Input({ required: true }) Notifications: readonly MockCenterNotification[] = [];
  @Input({ required: true }) PagedNotifications: readonly MockCenterNotification[] = [];
  @Input({ required: true }) CurrentPage = 1;
  @Input({ required: true }) TotalPages = 1;
  @Input({ required: true }) PageNumbers: readonly number[] = [];

  @Output() readonly TabChange = new EventEmitter<string>();
  @Output() readonly PageChange = new EventEmitter<number>();
  @Output() readonly NotificationOpen = new EventEmitter<MockCenterNotification>();

  TrackNotificationById(_: number, Notification: MockCenterNotification): string {
    return Notification.Id;
  }
}
