import { Injectable } from '@angular/core';

import { AuthService } from './auth.service';

export type MockAuditLogCategory =
  | 'PermissionChange'
  | 'DataSourceManagement'
  | 'ReportAction'
  | 'AccountManagement';
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
  private NextId = 16;
  private readonly Entries: MockAuditLogEntry[] = this.CreateSeedEntries();

  constructor(private readonly Auth: AuthService) {}

  get OperationLogs(): readonly MockAuditLogEntry[] { return this.Entries; }

  RecordBackOfficeAction(Action: string, Detail: string): void {
    const UserId = this.Auth.BoundBackOfficeUserId;
    if (!this.Auth.CanOperateBackOffice || !UserId) return;
    this.Entries.unshift({
      Id: this.NextId++, OccurredAt: new Date().toISOString(), UserId,
      Source: 'BackOffice', Category: 'AccountManagement', Action,
      Summary: Detail, TargetId: '—', IpAddress: '10.20.8.34',
      Details: [{ Label: '操作類型', Value: Action }, { Label: '操作內容', Value: Detail }],
    });
  }

  private CreateSeedEntries(): MockAuditLogEntry[] {
    return [
      this.Entry(11, 12, 16, 42, 'user@example.com', 'FrontOffice', 'ReportAction', 'REPORT_DOWNLOAD', '下載「月結損益表.rpt」（PDF）', '月結損益表.rpt', '203.0.113.18', [
        { Label: '報表名稱', Value: '月結損益表.rpt' }, { Label: '下載格式', Value: 'PDF' }, { Label: '帶入篩選條件', Value: '期間：2026-09；部門：Sales' },
      ]),
      this.Entry(15, 12, 15, 24, 'user@example.com', 'BackOffice', 'AccountManagement', 'CREATE_FRONT_OFFICE_USER', '建立前台使用者 123。', '123', '10.20.8.34', [
        { Label: '受影響帳號', Value: '123', Tone: 'added' }, { Label: '帳號狀態', Value: '已啟用', Tone: 'added' },
      ]),
      this.Entry(14, 12, 15, 22, 'user@example.com', 'BackOffice', 'AccountManagement', 'UPDATE_ROLE', '更新角色 會計人員 的功能或報表分類權限。', '會計人員', '10.20.8.34', [
        { Label: '受影響角色', Value: '會計人員' }, { Label: '變更內容', Value: '功能與報表分類權限', Tone: 'added' },
      ]),
      this.Entry(13, 12, 15, 21, 'user@example.com', 'BackOffice', 'AccountManagement', 'CREATE_ROLE', '建立角色 ABC。', 'ABC', '10.20.8.34', [
        { Label: '受影響角色', Value: 'ABC', Tone: 'added' }, { Label: '角色狀態', Value: '已建立', Tone: 'added' },
      ]),
      this.Entry(12, 12, 15, 20, 'user@example.com', 'BackOffice', 'AccountManagement', 'BACKOFFICE_BINDING', '完成後台操作 session 的前台身分驗證。', 'user@example.com', '10.20.8.34', [
        { Label: '綁定帳號', Value: 'user@example.com' }, { Label: '驗證結果', Value: '成功', Tone: 'added' },
      ]),
      this.Entry(10, 12, 14, 8, 'user@example.com', 'BackOffice', 'PermissionChange', 'GRANT_ROLE', '授予 inventory@example.com「倉管人員」角色', 'inventory@example.com', '10.20.8.34', [
        { Label: '受影響對象', Value: 'inventory@example.com' }, { Label: '變更前', Value: '無角色', Tone: 'neutral' }, { Label: '變更後', Value: '倉管人員', Tone: 'added' },
      ]),
      this.Entry(9, 11, 15, 26, 'finance@example.com', 'FrontOffice', 'ReportAction', 'REPORT_PREVIEW', '預覽「應收帳款明細.rpt」', '應收帳款明細.rpt', '198.51.100.42', [
        { Label: '報表名稱', Value: '應收帳款明細.rpt' }, { Label: '操作類型', Value: '預覽報表' }, { Label: '帶入篩選條件', Value: '截止日：2026-09-11' },
      ]),
      this.Entry(8, 11, 11, 5, 'user@example.com', 'BackOffice', 'AccountManagement', 'CREATE_USER', '建立使用者 audit-demo@example.com', 'audit-demo@example.com', '10.20.8.34', [
        { Label: '受影響帳號', Value: 'audit-demo@example.com' }, { Label: '帳號狀態', Value: '已啟用', Tone: 'added' }, { Label: '指派角色', Value: '採購人員' },
      ]),
      this.Entry(7, 10, 17, 10, 'user@example.com', 'BackOffice', 'PermissionChange', 'UPDATE_ROLE_PERMISSION', '更新「財務人員」的報表管理權限', '財務人員', '10.20.8.34', [
        { Label: '受影響角色', Value: '財務人員' }, { Label: '變更前', Value: '報表管理：未授予', Tone: 'neutral' }, { Label: '變更後', Value: '報表管理：已授予', Tone: 'added' },
      ]),
      this.Entry(6, 9, 9, 35, 'purchase@example.com', 'FrontOffice', 'ReportAction', 'REPORT_EXPORT', '匯出「採購訂單彙總.rpt」（Excel）', '採購訂單彙總.rpt', '203.0.113.57', [
        { Label: '報表名稱', Value: '採購訂單彙總.rpt' }, { Label: '匯出格式', Value: 'Excel' }, { Label: '帶入篩選條件', Value: '採購日期：2026-09-01 至 2026-09-08' },
      ]),
      this.Entry(5, 8, 8, 14, 'user@example.com', 'BackOffice', 'AccountManagement', 'DISABLE_USER', '停用使用者 legacy@example.com', 'legacy@example.com', '10.20.8.34', [
        { Label: '受影響帳號', Value: 'legacy@example.com' }, { Label: '變更前', Value: '帳號狀態：啟用', Tone: 'neutral' }, { Label: '變更後', Value: '帳號狀態：停用', Tone: 'removed' },
      ]),
      this.Entry(4, 8, 16, 48, 'warehouse@example.com', 'FrontOffice', 'ReportAction', 'REPORT_PRINT', '列印「庫存異動明細.rpt」', '庫存異動明細.rpt', '198.51.100.9', [
        { Label: '報表名稱', Value: '庫存異動明細.rpt' }, { Label: '操作類型', Value: '列印報表' }, { Label: '帶入篩選條件', Value: '倉別：A01' },
      ]),
      this.Entry(3, 7, 10, 3, 'user@example.com', 'BackOffice', 'PermissionChange', 'REVOKE_ROLE', '移除 purchase@example.com「採購人員」角色', 'purchase@example.com', '10.20.8.34', [
        { Label: '受影響對象', Value: 'purchase@example.com' }, { Label: '變更前', Value: '採購人員', Tone: 'neutral' }, { Label: '變更後', Value: '無角色', Tone: 'removed' },
      ]),
      this.Entry(2, 7, 13, 21, 'user@example.com', 'BackOffice', 'AccountManagement', 'UPDATE_USER', '更新使用者 finance@example.com 的顯示名稱', 'finance@example.com', '10.20.8.34', [
        { Label: '受影響帳號', Value: 'finance@example.com' }, { Label: '變更前', Value: '顯示名稱：財務部', Tone: 'neutral' }, { Label: '變更後', Value: '顯示名稱：財務專員', Tone: 'added' },
      ]),
      this.Entry(1, 6, 8, 56, 'finance@example.com', 'FrontOffice', 'ReportAction', 'REPORT_DOWNLOAD', '下載「資產負債表.rpt」（PDF）', '資產負債表.rpt', '203.0.113.71', [
        { Label: '報表名稱', Value: '資產負債表.rpt' }, { Label: '下載格式', Value: 'PDF' }, { Label: '帶入篩選條件', Value: '期間：2026-08' },
      ]),
    ];
  }

  private Entry(Id: number, Day: number, Hour: number, Minute: number, UserId: string, Source: MockAuditLogSource, Category: MockAuditLogCategory, Action: string, Summary: string, TargetId: string, IpAddress: string, Details: readonly MockAuditLogDetailItem[]): MockAuditLogEntry {
    const OccurredAt = new Date(2026, 8, Day, Hour, Minute, 0, 0);
    return { Id, OccurredAt: OccurredAt.toISOString(), UserId, Source, Category, Action, Summary, TargetId, IpAddress, Details };
  }
}
