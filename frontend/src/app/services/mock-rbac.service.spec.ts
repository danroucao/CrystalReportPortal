import {
  MockRbacService,
  MockRoleDraft,
} from './mock-rbac.service';
import {
  IsMockReportCategoryId,
  SystemUncategorizedCategoryId,
} from '../mock/mock-report-categories';

describe('MockRbacService', () => {
  let Service: MockRbacService;

  beforeEach(() => {
    Service = new MockRbacService();
  });

  it('uses Enabled and the effective CanExecute permission for the four required report-list cases', () => {
    Service.SetReportEnabled('DocumentsV2WithSerialAndBatchDetails', true);

    expect(Service.GetAccessibleReports(['FINANCE']).map((Report) => Report.ReportKey)).toEqual([
      'AccountBalance', 'MonthlyRevenue', 'Activity', 'ActivityAttendance', 'CampaignPerformance',
    ]);
    expect(Service.GetAccessibleReports(['PURCHASE']).map((Report) => Report.ReportKey)).toEqual([
      'DocumentsV2WithSerialAndBatchDetails', 'ProductionOrder', 'ProductionYield', 'DocumentArchive',
    ]);
    expect(Service.GetAccessibleReports(['PURCHASE', 'WAREHOUSE']).map((Report) => Report.ReportKey)).toEqual([
      'InventoryTransferHana', 'DocumentsV2WithSerialAndBatchDetails', 'ProductionOrder', 'InventoryAging', 'ProductionYield', 'DocumentArchive',
    ]);
    expect(Service.GetAccessibleReports(['WAREHOUSE']).map((Report) => Report.ReportKey)).toEqual([
      'InventoryTransferHana', 'InventoryAging',
    ]);
  });

  it('provides one enabled report catalog for the all-reports page', () => {
    expect(Service.GetAllEnabledReports()).toHaveSize(12);
    expect(
      Service.GetAllEnabledReports().map((Report) => Report.ReportKey),
    ).toContain('InventoryTransferHana');
    expect(
      Service.GetAllEnabledReports().map((Report) => Report.ReportKey),
    ).not.toContain('DocumentsV2WithSerialAndBatchDetails');

    Service.SetReportEnabled('DocumentsV2WithSerialAndBatchDetails', true);

    expect(Service.GetAllEnabledReports()).toHaveSize(13);
  });

  it('filters favorites through the current user category permissions', () => {
    Service.ToggleFavoriteReport('user@example.com', 'AccountBalance');
    Service.ToggleFavoriteReport('user@example.com', 'InventoryTransferHana');

    expect(
      Service.GetFavoriteReports('user@example.com').map(
        ({ Report }) => Report.ReportKey,
      ),
    ).toEqual(['AccountBalance']);
  });

  it('calculates a union of category permissions across ordinary roles', () => {
    expect(Service.GetEffectiveCategoryPermission(['PURCHASE', 'WAREHOUSE'], 'INVENTORY')).toEqual({
      CanExecute: true,
      CanExport: true,
      CanPrint: true,
    });
    expect(Service.GetEffectiveCategoryPermission(['PURCHASE', 'WAREHOUSE'], 'PRODUCTION').CanExecute).toBeTrue();
    expect(Service.GetEffectiveCategoryPermission(['PURCHASE', 'WAREHOUSE'], 'FINANCE').CanExecute).toBeFalse();
  });

  it('automatically grants a newly added report when its category is already executable', () => {
    const FinanceReports = Service.GetAccessibleReports(['FINANCE']);

    expect(FinanceReports.map((Report) => Report.ReportKey)).toContain('MonthlyRevenue');
    expect(Service.GetCategoryPermission('FINANCE', 'FINANCE').CanExecute).toBeTrue();
  });

  it('clears output permissions whenever CanExecute is removed', () => {
    const Entries = Service.GetCategoryPermissionEntries('FINANCE');
    const Entry = Entries.find((Permission) => Permission.CategoryId === 'FINANCE')!;
    Entry.Permission = { CanExecute: false, CanExport: true, CanPrint: true };

    Service.SaveCategoryPermissions('FINANCE', Entries);

    expect(Service.GetCategoryPermission('FINANCE', 'FINANCE')).toEqual({
      CanExecute: false,
      CanExport: false,
      CanPrint: false,
    });
    expect(Service.GetAccessibleReports(['FINANCE']).map((Report) => Report.ReportKey)).toEqual([
      'Activity', 'ActivityAttendance', 'CampaignPerformance',
    ]);
  });

  it('creates roles and retains only executable category output settings', () => {
    const Permissions = Service.GetEmptyCategoryPermissionEntries();
    Permissions[0].Permission = { CanExecute: true, CanExport: true, CanPrint: false };
    const Draft: MockRoleDraft = {
      DisplayName: '業務人員',
      ManagementPermissions: [],
      Permissions,
    };

    const CreatedRole = Service.CreateRole(Draft);

    expect(CreatedRole?.DisplayName).toBe('業務人員');
    expect(Service.GetCategoryPermission(CreatedRole!.Key, Permissions[0].CategoryId)).toEqual(Permissions[0].Permission);
    expect(Service.CreateRole(Draft)).toBeNull();
  });

  it('deletes only unused custom roles and preserves assigned roles', () => {
    const CreatedRole = Service.CreateRole({
      DisplayName: 'admin123',
      ManagementPermissions: [],
      Permissions: Service.GetEmptyCategoryPermissionEntries(),
    })!;

    expect(Service.DeleteRole('ADMIN')).toBe('not-found');
    expect(Service.DeleteRole('FINANCE')).toBe('role-in-use');
    expect(Service.DeleteRole(CreatedRole.Key)).toBe('deleted');
    expect(Service.Roles.some((Role) => Role.Key === CreatedRole.Key)).toBeFalse();
  });

  it('retains the three supported management permissions when a role is saved', () => {
    const CreatedRole = Service.CreateRole({
      DisplayName: 'management-validation',
      ManagementPermissions: ['RptManagement', 'DatabaseConnection', 'OperationLog'],
      Permissions: Service.GetEmptyCategoryPermissionEntries(),
    })!;

    expect(CreatedRole.ManagementPermissions).toEqual([
      'RptManagement',
      'DatabaseConnection',
      'OperationLog',
    ]);

    const Permissions = Service.GetEmptyCategoryPermissionEntries();
    expect(Service.UpdateRole(CreatedRole.Key, {
      DisplayName: CreatedRole.DisplayName,
      ManagementPermissions: ['OperationLog'],
      Permissions,
    })).toBe('updated');
    expect(Service.GetRole(CreatedRole.Key).ManagementPermissions).toEqual([
      'OperationLog',
    ]);
  });

  it('keeps all reports in management while excluding disabled reports from the normal report list', () => {
    expect(Service.Reports).toHaveSize(13);
    expect(Service.Reports.every((Report) => Report.ReportKey && Report.FileName && Report.CategoryId && Report.CategoryName && Report.Description)).toBeTrue();
    expect(Service.GetAccessibleReports(['PURCHASE']).some((Report) => Report.ReportKey === 'DocumentsV2WithSerialAndBatchDetails')).toBeFalse();

    Service.SetReportEnabled('DocumentsV2WithSerialAndBatchDetails', true);

    expect(Service.GetAccessibleReports(['PURCHASE']).some((Report) => Report.ReportKey === 'DocumentsV2WithSerialAndBatchDetails')).toBeTrue();
  });

  it('uses only CategoryIds that exist in the Category Master', () => {
    expect(Service.Reports.every((Report) => IsMockReportCategoryId(Report.CategoryId))).toBeTrue();
    expect(Service.CreateReport({
      ReportName: 'Missing description',
      Description: '   ',
      CategoryId: 'FINANCE',
      Enabled: true,
      FileName: 'MissingDescription.rpt',
    })).toBeNull();
    expect(Service.CreateReport({
      ReportName: 'Invalid category',
      Description: '無效分類的報表。',
      CategoryId: 'UNKNOWN_CATEGORY',
      Enabled: true,
      FileName: 'InvalidCategory.rpt',
    })).toBeNull();
  });

  it('uses Category Master entries for filter and report-editor options, including zero-report categories', () => {
    const Entries = Service.GetCategoryPermissionEntries('FINANCE');
    Entries.find((Entry) => Entry.CategoryId === 'MARKETING')!.Permission.CanExecute = true;
    Service.SaveCategoryPermissions('FINANCE', Entries);
    expect(Service.GetReportFilterCategories(['FINANCE']).map(
      (Category) => Category.CategoryId,
    )).toContain('MARKETING');
    expect(Service.GetReportFilterCategories(['FINANCE']).map(
      (Category) => Category.CategoryId,
    )).not.toContain(SystemUncategorizedCategoryId);
    expect(Service.GetReportManagementCategories().map(
      (Category) => Category.CategoryId,
    )).toEqual(jasmine.arrayContaining(['MARKETING', SystemUncategorizedCategoryId]));
    expect(Service.GetReportEditorCategories().map(
      (Category) => Category.CategoryId,
    )).toContain('MARKETING');
    expect(Service.GetReportEditorCategories().map(
      (Category) => Category.CategoryId,
    )).not.toContain(SystemUncategorizedCategoryId);
  });

  it('creates an empty category with an immutable generated CategoryId and no ordinary-role permission', () => {
    const Result = Service.CreateCategory('  業務分析  ');

    expect(Result.Status).toBe('created');
    if (Result.Status !== 'created') return;
    expect(Result.Category).toEqual({
      CategoryId: 'CUSTOM_CATEGORY_1',
      CategoryName: '業務分析',
      IsSystemReserved: false,
    });
    expect(Service.GetCategoryUsageCount(Result.Category.CategoryId)).toBe(0);
    expect(Service.GetCategories()).toEqual(
      jasmine.arrayContaining([Result.Category]),
    );
    expect(Service.GetCategoryPermission('FINANCE', Result.Category.CategoryId)).toEqual({
      CanExecute: false,
      CanExport: false,
      CanPrint: false,
    });
  });

  it('rejects empty, duplicate, and system-reserved category names', () => {
    expect(Service.CreateCategory('   ').Status).toBe('invalid-name');
    expect(Service.CreateCategory(' 財務 ').Status).toBe('duplicate-name');
    expect(Service.CreateCategory('未分類').Status).toBe(
      'system-reserved-name',
    );
  });

  it('renames a regular category without changing report or permission CategoryIds', () => {
    const Before = Service.GetCategoryPermission('FINANCE', 'FINANCE');
    const Result = Service.RenameCategory('FINANCE', '財務報表');

    expect(Result.Status).toBe('renamed');
    if (Result.Status !== 'renamed') return;
    expect(Result.Category.CategoryId).toBe('FINANCE');
    expect(Result.Category.CategoryName).toBe('財務報表');
    expect(
      Service.Reports.filter((Report) => Report.ReportKey === 'AccountBalance')[0]
        .CategoryId,
    ).toBe('FINANCE');
    expect(Service.GetCategoryPermission('FINANCE', 'FINANCE')).toEqual(Before);
    expect(Service.GetReport('AccountBalance')?.CategoryName).toBe('財務報表');
  });

  it('rejects a rename of the system-reserved category', () => {
    expect(
      Service.RenameCategory(SystemUncategorizedCategoryId, '重新命名').Status,
    ).toBe('system-reserved');
  });

  it('deletes an empty category and removes its role permission reference', () => {
    const Created = Service.CreateCategory('暫存分類');
    if (Created.Status !== 'created') {
      fail('應建立暫存分類');
      return;
    }
    const CreatedCategory = Created.Category;
    const Entries = Service.GetCategoryPermissionEntries('FINANCE');
    const Entry = Entries.find(
      (Permission) => Permission.CategoryId === CreatedCategory.CategoryId,
    )!;
    Entry.Permission = { CanExecute: true, CanExport: true, CanPrint: true };
    Service.SaveCategoryPermissions('FINANCE', Entries);

    const Result = Service.DeleteCategory(CreatedCategory.CategoryId);
    const PermissionStore = (
      Service as unknown as {
        PermissionStore: Record<string, Record<string, unknown>>;
      }
    ).PermissionStore;

    expect(Result).toEqual({
      Status: 'deleted',
      DeletedCategoryName: '暫存分類',
      MovedReportCount: 0,
    });
    expect(Service.GetCategories().some(
      (Category) => Category.CategoryId === CreatedCategory.CategoryId,
    )).toBeFalse();
    expect(PermissionStore['FINANCE'][CreatedCategory.CategoryId]).toBeUndefined();
  });

  it('moves reports to the reserved category, clears permissions, and deletes a used category', () => {
    const Result = Service.DeleteCategory('FINANCE');
    const PermissionStore = (
      Service as unknown as {
        PermissionStore: Record<string, Record<string, unknown>>;
      }
    ).PermissionStore;

    expect(Result).toEqual({
      Status: 'deleted',
      DeletedCategoryName: '財務',
      MovedReportCount: 2,
    });
    expect(Service.Reports.filter(
      (Report) => ['AccountBalance', 'MonthlyRevenue'].includes(Report.ReportKey),
    ).every(
      (Report) => Report.CategoryId === SystemUncategorizedCategoryId,
    )).toBeTrue();
    expect(Service.GetCategories().some(
      (Category) => Category.CategoryId === 'FINANCE',
    )).toBeFalse();
    expect(PermissionStore['FINANCE']['FINANCE']).toBeUndefined();
  });

  it('rejects deletion of the system-reserved category', () => {
    expect(Service.DeleteCategory(SystemUncategorizedCategoryId)).toEqual({
      Status: 'system-reserved',
      DeletedCategoryName: null,
      MovedReportCount: 0,
    });
  });

  it('excludes the reserved category from ordinary-role permissions and report visibility', () => {
    const Report = Service.CreateReport({
      ReportName: 'Needs recategorization',
      Description: '需要重新分類的報表。',
      CategoryId: SystemUncategorizedCategoryId,
      Enabled: true,
      FileName: 'NeedsRecategorization.rpt',
    });

    expect(Report).not.toBeNull();
    expect(Service.GetCategoryPermissionEntries('FINANCE').some(
      (Entry) => Entry.CategoryId === SystemUncategorizedCategoryId,
    )).toBeFalse();
    expect(Service.GetCategoryPermission('FINANCE', SystemUncategorizedCategoryId)).toEqual({
      CanExecute: false,
      CanExport: false,
      CanPrint: false,
    });
    expect(Service.GetAccessibleReports(['FINANCE']).some(
      (Entry) => Entry.ReportKey === Report!.ReportKey,
    )).toBeFalse();
    expect(Service.GetAccessibleReports(['ADMIN']).some(
      (Entry) => Entry.ReportKey === Report!.ReportKey,
    )).toBeFalse();
  });

  it('updates only role assignments without changing external account identity', () => {
    const Before = Service.GetUser('warehouse@example.com')!;

    expect(Service.SaveUserEdit('warehouse@example.com', {
      Roles: ['PURCHASE', 'WAREHOUSE'],
    })).toBe('updated');

    const Updated = Service.GetUser('warehouse@example.com')!;
    expect(Updated.Account).toBe(Before.Account);
    expect(Updated.DisplayName).toBe(Before.DisplayName);
    expect(Updated.Roles).toEqual(['PURCHASE', 'WAREHOUSE']);
  });

  it('updates the recent login time after a successful external-account demo login', () => {
    const Before = Service.GetUser('warehouse@example.com')!.LastLoginAt;

    expect(Service.Authenticate('warehouse@example.com', 'warehouse123')).not.toBeNull();
    expect(Service.GetUser('warehouse@example.com')!.LastLoginAt).not.toBe(Before);
  });
});
