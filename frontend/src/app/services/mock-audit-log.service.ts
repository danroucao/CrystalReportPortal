import { Injectable } from '@angular/core';

import { AuthService } from './auth.service';

export interface MockAuditLogEntry {
  readonly Id: number;
  readonly OccurredAt: string;
  readonly UserId: string;
  readonly Action: string;
  readonly Detail: string;
}

@Injectable({ providedIn: 'root' })
export class MockAuditLogService {
  private NextId = 1;
  private readonly Entries: MockAuditLogEntry[] = [];

  constructor(private readonly Auth: AuthService) {}

  get OperationLogs(): readonly MockAuditLogEntry[] { return this.Entries; }

  RecordBackOfficeAction(Action: string, Detail: string): void {
    const UserId = this.Auth.BoundBackOfficeUserId;
    if (!this.Auth.CanOperateBackOffice || !UserId) return;
    this.Entries.unshift({
      Id: this.NextId++,
      OccurredAt: new Date().toLocaleString('zh-TW', { hour12: false }),
      UserId,
      Action,
      Detail,
    });
  }
}
