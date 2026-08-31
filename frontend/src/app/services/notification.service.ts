import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  SuccessMessage = '';
  private SuccessTimer: ReturnType<typeof setTimeout> | null = null;

  ShowSuccess(Message: string): void {
    this.SuccessMessage = Message;
    if (this.SuccessTimer) clearTimeout(this.SuccessTimer);
    this.SuccessTimer = setTimeout(() => {
      this.SuccessMessage = '';
      this.SuccessTimer = null;
    }, 3000);
  }

  ClearSuccess(): void {
    if (this.SuccessTimer) clearTimeout(this.SuccessTimer);
    this.SuccessTimer = null;
    this.SuccessMessage = '';
  }
}
