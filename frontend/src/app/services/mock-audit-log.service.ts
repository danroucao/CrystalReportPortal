import { Injectable } from '@angular/core';

import { AuthService } from './auth.service';

export type MockAuditLogCategory = 'PermissionChange' | 'ReportAction';
export type MockAuditLogSource = 'BackOffice' | 'FrontOffice';
export type MockAuditLogDetailTone = 'added' | 'removed' | 'neutral';

export interface MockAuditLogDetailItem {
  readonly Label: string;
  readonly Value: string;
  readonly Tone?: MockAuditLogDetailTone;
}

export interface MockAuditLogEntry {
  readonly Id: number;
  readonly OccurredAt: string;
  readonly ArchivedAt: string | null;
  readonly UserId: string;
  readonly Source: MockAuditLogSource;
  readonly Category: MockAuditLogCategory;
  readonly Action: string;
  readonly Summary: string;
  readonly TargetId: string;
  readonly IpAddress: string;
  readonly Details: readonly MockAuditLogDetailItem[];
}

@Injectable({ providedIn: 'root' })
export class MockAuditLogService {
  private NextId = 7;
  private readonly Entries: MockAuditLogEntry[] = this.CreateSeedEntries();

  constructor(private readonly Auth: AuthService) {}

  get OperationLogs(): readonly MockAuditLogEntry[] { return this.Entries; }

  RecordPermissionChange(Action: string, Detail: string): void {
    const UserId = this.Auth.BoundBackOfficeUserId;
    if (!this.Auth.CanOperateBackOffice || !UserId) return;
    this.Entries.unshift({
      Id: this.NextId++,
      OccurredAt: new Date().toISOString(),
      ArchivedAt: null,
      UserId,
      Source: 'BackOffice',
      Category: 'PermissionChange',
      Action,
      Summary: Detail,
      TargetId: '—',
      IpAddress: '10.20.8.34',
      Details: [
        { Label: '操作類型', Value: Action },
        { Label: '操作內容', Value: Detail },
      ],
    });
  }

  RecordBackOfficeAction(Action: string, Detail: string): void {
    this.RecordPermissionChange(Action, Detail);
  }

  private CreateSeedEntries(): MockAuditLogEntry[] {
    return [
      this.Entry(6, 1, 'user@example.com', 'BackOffice', 'PermissionChange', 'UPDATE_USER_ROLES', '更新使用者 finance-supervisor@example.com 的系統角色。', 'finance-supervisor@example.com', [
        { Label: '角色變更', Value: '財務人員', Tone: 'added' },
      ]),
      this.Entry(5, 3, 'user@example.com', 'FrontOffice', 'ReportAction', 'REPORT_DOWNLOAD', '下載「月結損益表.rpt」（PDF）。', '月結損益表.rpt', [
        { Label: '下載格式', Value: 'PDF' },
      ]),
      this.Entry(4, 5, 'user@example.com', 'BackOffice', 'PermissionChange', 'UPDATE_ROLE_PERMISSION', '更新角色「財務人員」的功能權限。', '財務人員', [
        { Label: '權限', Value: '檢視已封存操作紀錄', Tone: 'added' },
      ]),
      this.Entry(3, 225, 'user@example.com', 'BackOffice', 'PermissionChange', 'REVOKE_ROLE', '移除 purchase@example.com 的「採購人員」角色。', 'purchase@example.com', [
        { Label: '角色變更', Value: '採購人員', Tone: 'removed' },
      ], true),
      this.Entry(2, 231, 'finance@example.com', 'FrontOffice', 'ReportAction', 'REPORT_EXPORT', '匯出「採購訂單明細.rpt」（Excel）。', '採購訂單明細.rpt', [
        { Label: '匯出格式', Value: 'Excel' },
      ], true),
      this.Entry(1, 240, 'user@example.com', 'BackOffice', 'PermissionChange', 'CREATE_ROLE', '建立角色「歷史資料稽核人員」。', '歷史資料稽核人員', [
        { Label: '功能權限', Value: '操作紀錄查詢', Tone: 'added' },
      ], true),
    ];
  }

  private Entry(
    Id: number,
    DaysAgo: number,
    UserId: string,
    Source: MockAuditLogSource,
    Category: MockAuditLogCategory,
    Action: string,
    Summary: string,
    TargetId: string,
    Details: readonly MockAuditLogDetailItem[],
    IsArchived = false,
  ): MockAuditLogEntry {
    const OccurredAt = new Date();
    OccurredAt.setDate(OccurredAt.getDate() - DaysAgo);
    const ArchivedAt = IsArchived ? this.ToArchiveTimestamp(OccurredAt) : null;
    return {
      Id,
      OccurredAt: OccurredAt.toISOString(),
      ArchivedAt,
      UserId,
      Source,
      Category,
      Action,
      Summary,
      TargetId,
      IpAddress: Source === 'BackOffice' ? '10.20.8.34' : '203.0.113.18',
      Details,
    };
  }

  private ToArchiveTimestamp(OccurredAt: Date): string {
    const ArchiveDate = new Date(OccurredAt);
    ArchiveDate.setDate(ArchiveDate.getDate() + 180);
    ArchiveDate.setHours(0, 0, 0, 0);
    return ArchiveDate.toISOString();
  }
}
