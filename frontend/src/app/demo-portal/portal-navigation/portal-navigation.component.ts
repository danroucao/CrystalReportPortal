import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { MockNotificationCenterService } from '../../services/mock-notification-center.service';
import { BoringAvatarComponent } from '../../shared/boring-avatar.component';

@Component({
  selector: 'app-portal-navigation',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, BoringAvatarComponent],
  templateUrl: './portal-navigation.component.html',
  styleUrl: './portal-navigation.component.scss',
})
export class PortalNavigationComponent implements AfterViewChecked {
  readonly Auth = inject(AuthService);
  readonly NotificationCenter = inject(MockNotificationCenterService);

  @Input() IsCompactLayout = false;
  @Input() IsDrawerOpen = false;
  @Output() readonly CloseRequested = new EventEmitter<void>();
  @Output() readonly LogoutRequested = new EventEmitter<void>();
  @ViewChild('drawerCloseButton')
  private drawerCloseButton?: ElementRef<HTMLButtonElement>;

  private ShouldFocusDrawerClose = false;
  private WasDrawerOpen = false;

  get IsNavigationInert(): boolean {
    return (
      this.Auth.RequiresBackOfficeIdentityBinding ||
      (this.IsCompactLayout && !this.IsDrawerOpen)
    );
  }

  get NotificationBadgeCount(): number {
    const Account = this.Auth.CurrentIdentity?.Account;
    return Account
      ? this.NotificationCenter.GetUnreadNotificationCount(Account)
      : 0;
  }

  ngAfterViewChecked(): void {
    if (this.IsDrawerOpen && !this.WasDrawerOpen) {
      this.ShouldFocusDrawerClose = true;
    }
    this.WasDrawerOpen = this.IsDrawerOpen;

    if (this.ShouldFocusDrawerClose && this.drawerCloseButton) {
      this.drawerCloseButton.nativeElement.focus();
      this.ShouldFocusDrawerClose = false;
    }
  }

  RequestClose(): void {
    this.CloseRequested.emit();
  }

  HandleNavigationClick(Event: MouseEvent): void {
    if ((Event.target as HTMLElement).closest('a')) this.RequestClose();
  }

  RequestLogout(): void {
    this.LogoutRequested.emit();
  }
}
