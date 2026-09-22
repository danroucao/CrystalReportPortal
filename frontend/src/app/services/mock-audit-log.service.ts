import { Injectable } from '@angular/core';

import { AuthService } from './auth.service';

export type MockAuditLogCategory = 'PermissionChange' | 'ReportAction' | 'SystemManagement' | 'Authentication';
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
  private NextId = 61;
  private readonly Entries: MockAuditLogEntry[] = this.CreateDemoEntries();

  constructor(private readonly Auth: AuthService) {}

  get OperationLogs(): readonly MockAuditLogEntry[] { return this.Entries; }

  RecordPermissionChange(Action: string, Detail: string): void {
    const UserId = this.Auth.BoundBackOfficeUserId;
    if (!this.Auth.CanOperateBackOffice || !UserId) return;
    this.Entries.unshift({
      Id: this.NextId++,
      OccurredAt: new Date().toISOString(),
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

  private CreateDemoEntries(): MockAuditLogEntry[] {
    return [
      this.Entry(13, 0, 'admin@example.com', 'BackOffice', 'SystemManagement', 'PARAMETER_CREATE', '新增報表參數「結帳月份」。', '結帳月份', [
        { Label: '參數類型', Value: '日期區間' },
        { Label: '預設值', Value: '本月', Tone: 'added' },
      ]),
      this.Entry(12, 1, 'admin@example.com', 'BackOffice', 'SystemManagement', 'PARAMETER_UPDATE', '更新報表參數「部門代碼」的選項。', '部門代碼', [
        { Label: '異動欄位', Value: '可選部門' },
        { Label: '更新後', Value: '財務、採購、倉管', Tone: 'added' },
      ]),
      this.Entry(11, 2, 'admin@example.com', 'BackOffice', 'SystemManagement', 'PARAMETER_DELETE', '刪除未使用的報表參數「舊版幣別」。', '舊版幣別', [
        { Label: '刪除原因', Value: '已由幣別代碼取代', Tone: 'removed' },
      ]),
      this.Entry(10, 2, 'admin@example.com', 'BackOffice', 'ReportAction', 'REPORT_CREATE', '新增報表「庫存週轉分析」。', '庫存週轉分析.rpt', [
        { Label: '報表分類', Value: '庫存', Tone: 'added' },
      ]),
      this.Entry(9, 3, 'admin@example.com', 'BackOffice', 'ReportAction', 'REPORT_UPDATE', '更新報表「月結損益表」的資料來源。', '月結損益表.rpt', [
        { Label: '異動欄位', Value: '資料庫連線', Tone: 'added' },
      ]),
      this.Entry(8, 4, 'admin@example.com', 'BackOffice', 'ReportAction', 'REPORT_DELETE', '刪除測試用報表「作廢範例」。', '作廢範例.rpt', [
        { Label: '刪除原因', Value: '測試資料清理', Tone: 'removed' },
      ]),
      this.Entry(7, 4, 'admin@example.com', 'BackOffice', 'PermissionChange', 'CREATE_ROLE', '新增角色「報表稽核人員」。', '報表稽核人員', [
        { Label: '功能權限', Value: '報表管理', Tone: 'added' },
      ]),
      this.Entry(6, 5, 'admin@example.com', 'BackOffice', 'PermissionChange', 'ROLE_UPDATE', '更新角色「財務人員」的報表分類權限。', '財務人員', [
        { Label: '權限異動', Value: '庫存：閱覽、匯出', Tone: 'added' },
      ]),
      this.Entry(5, 6, 'admin@example.com', 'BackOffice', 'PermissionChange', 'DELETE_ROLE', '刪除不再使用的角色「臨時查詢人員」。', '臨時查詢人員', [
        { Label: '刪除原因', Value: '專案結束', Tone: 'removed' },
      ]),
      this.Entry(4, 6, 'admin@example.com', 'BackOffice', 'SystemManagement', 'DATABASE_CREATE', '新增資料庫連線「營運報表唯讀」。', '營運報表唯讀', [
        { Label: '連線類型', Value: 'MSSQL', Tone: 'added' },
      ]),
      this.Entry(3, 7, 'admin@example.com', 'BackOffice', 'SystemManagement', 'DATABASE_UPDATE', '更新資料庫連線「財務資料庫」的連線設定。', '財務資料庫', [
        { Label: '異動欄位', Value: '連線逾時時間' },
      ]),
      this.Entry(2, 225, 'admin@example.com', 'BackOffice', 'SystemManagement', 'DATABASE_DELETE', '刪除已停用的資料庫連線「測試環境」。', '測試環境', [
        { Label: '刪除原因', Value: '環境下線', Tone: 'removed' },
      ]),
      this.Entry(1, 231, 'unknown@example.com', 'FrontOffice', 'Authentication', 'LOGIN_FAILURE', '帳號登入失敗：密碼錯誤。', 'unknown@example.com', [
        { Label: '失敗原因', Value: '帳號或密碼錯誤' },
        { Label: '嘗試次數', Value: '第 3 次' },
      ]),
      this.Entry(30, 1, 'admin@example.com', 'BackOffice', 'SystemManagement', 'PARAMETER_VIEW', '檢視報表參數「結帳月份」的設定。', '結帳月份', [
        { Label: '操作類型', Value: '檢視' },
      ]),
      this.Entry(29, 2, 'admin@example.com', 'BackOffice', 'SystemManagement', 'PARAMETER_IMPORT', '匯入報表參數清單。', '參數清單.xlsx', [
        { Label: '匯入筆數', Value: '12 筆', Tone: 'added' },
      ]),
      this.Entry(28, 3, 'admin@example.com', 'BackOffice', 'ReportAction', 'REPORT_VIEW', '檢視報表「採購訂單明細」設定。', '採購訂單明細.rpt', [
        { Label: '操作類型', Value: '檢視' },
      ]),
      this.Entry(27, 4, 'finance@example.com', 'FrontOffice', 'ReportAction', 'REPORT_PREVIEW', '預覽報表「月結損益表」。', '月結損益表.rpt', [
        { Label: '預覽格式', Value: 'HTML' },
      ]),
      this.Entry(26, 5, 'finance@example.com', 'FrontOffice', 'ReportAction', 'REPORT_DOWNLOAD', '下載報表「月結損益表」。', '月結損益表.rpt', [
        { Label: '下載格式', Value: 'PDF' },
      ]),
      this.Entry(4, 5, 'user@example.com', 'BackOffice', 'PermissionChange', 'UPDATE_ROLE_PERMISSION', '更新角色「財務人員」的功能權限。', '財務人員', [
        { Label: '權限', Value: '報表管理', Tone: 'added' },
      ]),
      this.Entry(3, 225, 'user@example.com', 'BackOffice', 'PermissionChange', 'REVOKE_ROLE', '移除 purchase@example.com 的「採購人員」角色。', 'purchase@example.com', [
        { Label: '角色變更', Value: '採購人員', Tone: 'removed' },
      ]),
      this.Entry(2, 231, 'finance@example.com', 'FrontOffice', 'ReportAction', 'REPORT_EXPORT', '匯出「採購訂單明細.rpt」（Excel）。', '採購訂單明細.rpt', [
        { Label: '匯出格式', Value: 'Excel' },
      ]),
      this.Entry(1, 240, 'user@example.com', 'BackOffice', 'PermissionChange', 'CREATE_ROLE', '建立角色「歷史資料稽核人員」。', '歷史資料稽核人員', [
        { Label: '功能權限', Value: '操作紀錄查詢', Tone: 'added' },
      ]),
    ];
  }

  private CreateArchivedDemoEntries(): MockAuditLogEntry[] {
    const Templates: readonly {
      readonly UserId: string;
      readonly Source: MockAuditLogSource;
      readonly Category: MockAuditLogCategory;
      readonly Action: string;
      readonly Summary: string;
      readonly TargetId: string;
    }[] = [
      {
        UserId: 'admin@example.com',
        Source: 'BackOffice',
        Category: 'PermissionChange',
        Action: 'ROLE_UPDATE',
        Summary: '更新角色「報表稽核人員」的操作紀錄查詢權限。',
        TargetId: '報表稽核人員',
      },
      {
        UserId: 'finance@example.com',
        Source: 'FrontOffice',
        Category: 'ReportAction',
        Action: 'REPORT_PREVIEW',
        Summary: '預覽報表「月結損益表」。',
        TargetId: '月結損益表.rpt',
      },
      {
        UserId: 'admin@example.com',
        Source: 'BackOffice',
        Category: 'SystemManagement',
        Action: 'DATABASE_TEST_CONNECTION',
        Summary: '測試資料庫連線「財務資料庫」。',
        TargetId: '財務資料庫',
      },
      {
        UserId: 'unknown@example.com',
        Source: 'FrontOffice',
        Category: 'Authentication',
        Action: 'LOGIN_FAILURE',
        Summary: '帳號登入失敗：密碼錯誤。',
        TargetId: 'unknown@example.com',
      },
      {
        UserId: 'admin@example.com',
        Source: 'BackOffice',
        Category: 'SystemManagement',
        Action: 'PARAMETER_UPDATE',
        Summary: '更新報表參數「結帳月份」的選項。',
        TargetId: '結帳月份',
      },
      {
        UserId: 'finance@example.com',
        Source: 'FrontOffice',
        Category: 'ReportAction',
        Action: 'REPORT_EXPORT',
        Summary: '匯出報表「庫存週轉分析」。',
        TargetId: '庫存週轉分析.rpt',
      },
    ];

    return Array.from({ length: 30 }, (_, Index) => {
      const Template = Templates[Index % Templates.length];
      const Sequence = String(Index + 1).padStart(2, '0');
      return this.Entry(
        31 + Index,
        190 + Index * 5,
        Template.UserId,
        Template.Source,
        Template.Category,
        Template.Action,
        `${Template.Summary}（封存測試資料 ${Sequence}）`,
        Template.TargetId,
        [
          { Label: '封存狀態', Value: '僅供檢視' },
          { Label: '封存批次', Value: `ARCHIVE-2026-${Sequence}` },
        ],
      );
    });
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
  ): MockAuditLogEntry {
    const OccurredAt = new Date();
    OccurredAt.setDate(OccurredAt.getDate() - DaysAgo);
    return {
      Id,
      OccurredAt: OccurredAt.toISOString(),
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
}
