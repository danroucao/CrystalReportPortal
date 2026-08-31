import {
  MockRbacService,
  MockRoleDraft,
  MockUserDraft,
} from './mock-rbac.service';

describe('MockRbacService', () => {
  let Service: MockRbacService;

  beforeEach(() => {
    Service = new MockRbacService();
  });

  it('limits each business role to reports granted CanView', () => {
    expect(
      Service.GetAccessibleReports('FINANCE').map((Report) => Report.ReportKey),
    ).toEqual(['AccountBalance', 'Activity']);
    expect(
      Service.GetAccessibleReports('WAREHOUSE').map((Report) => Report.ReportKey),
    ).toEqual(['InventoryTransferHana']);
  });

  it('updates the in-memory report permission matrix', () => {
    const Entries = Service.GetReportPermissionEntries('FINANCE');
    const InventoryPermission = Entries.find(
      (Entry) => Entry.ReportKey === 'InventoryTransferHana',
    )!;

    InventoryPermission.Permission = {
      CanView: true,
      CanExecute: true,
      CanExportPdf: false,
      CanPrint: false,
    };
    Service.SaveReportPermissions('FINANCE', Entries);

    expect(
      Service.GetAccessibleReports('FINANCE').map((Report) => Report.ReportKey),
    ).toEqual(['AccountBalance', 'Activity', 'InventoryTransferHana']);
    expect(Service.GetReportPermission('FINANCE', 'InventoryTransferHana')).toEqual(
      InventoryPermission.Permission,
    );
  });

  it('creates new Mock users as disabled and updates general-user details directly', () => {
    const Draft: MockUserDraft = {
      Account: 'warehouse@example.com',
      DisplayName: '倉管測試使用者',
      InitialPassword: 'warehouse123',
      Role: 'WAREHOUSE',
      Enabled: false,
    };

    expect(Service.CreateUser(Draft)).toBeTrue();
    expect(
      Service.Users.find((User) => User.Account === Draft.Account)?.Enabled,
    ).toBeFalse();
    expect(
      Service.Authenticate(Draft.Account, Draft.InitialPassword),
    ).toBeNull();

    Service.SetUserEnabled(Draft.Account, true);
    expect(
      Service.Authenticate(Draft.Account, Draft.InitialPassword)?.Role,
    ).toBe('WAREHOUSE');

    const EditedDraft = {
      Account: Draft.Account,
      DisplayName: '倉管測試使用者（已編輯）',
      Role: 'PURCHASING' as const,
      Enabled: false,
    };
    expect(
      Service.SaveUserEdit(Draft.Account, EditedDraft, 'admin@example.com'),
    ).toBe('updated');
    expect(
      Service.Authenticate(Draft.Account, Draft.InitialPassword),
    ).toBeNull();
    expect(Service.GetUser(Draft.Account)?.DisplayName).toBe(
      EditedDraft.DisplayName,
    );
    expect(Service.GetUser(Draft.Account)?.Role).toBe('PURCHASING');
  });

  it('uses the selected enabled status when creating a Mock user', () => {
    const Draft: MockUserDraft = {
      Account: 'purchasing@example.com',
      DisplayName: '採購測試使用者',
      InitialPassword: 'purchasing123',
      Role: 'PURCHASING',
      Enabled: true,
    };

    expect(Service.CreateUser(Draft)).toBeTrue();
    expect(Service.GetUser(Draft.Account)?.Enabled).toBeTrue();
    expect(
      Service.Authenticate(Draft.Account, Draft.InitialPassword)?.Role,
    ).toBe('PURCHASING');
  });

  it('creates an in-memory role with the selected report permissions', () => {
    const Permissions = Service.GetEmptyReportPermissionEntries();
    Permissions[0].Permission.CanView = true;
    Permissions[0].Permission.CanExportPdf = true;
    const Draft: MockRoleDraft = {
      DisplayName: '業務人員',
      Description: '可使用業務類已授權報表。',
      Permissions,
    };

    const CreatedRole = Service.CreateRole(Draft);

    expect(CreatedRole?.DisplayName).toBe('業務人員');
    expect(CreatedRole?.Description).toBe(Draft.Description);
    expect(
      Service.Roles.some((Role) => Role.Key === CreatedRole?.Key),
    ).toBeTrue();
    expect(
      Service.GetReportPermission(CreatedRole!.Key, Permissions[0].ReportKey),
    ).toEqual(Permissions[0].Permission);
    expect(Service.CreateRole(Draft)).toBeNull();
  });

  it('updates a role display name, description, and report permissions without changing its key', () => {
    const Permissions = Service.GetReportPermissionEntries('FINANCE');
    Permissions[2].Permission.CanView = true;
    const Draft: MockRoleDraft = {
      DisplayName: '財務分析人員',
      Description: '可使用財務及庫存分析報表。',
      Permissions,
    };

    expect(Service.UpdateRole('FINANCE', Draft)).toBe('updated');
    expect(Service.GetRole('FINANCE')).toEqual(
      jasmine.objectContaining({
        Key: 'FINANCE',
        DisplayName: Draft.DisplayName,
        Description: Draft.Description,
      }),
    );
    expect(
      Service.GetReportPermission('FINANCE', 'InventoryTransferHana').CanView,
    ).toBeTrue();
  });

  it('keeps all reports available to management while excluding disabled reports from user visibility', () => {
    expect(Service.Reports).toHaveSize(6);
    expect(Service.Reports.every((Report) => Report.ReportKey && Report.FileName && Report.Category && Report.Description)).toBeTrue();
    expect(Service.Reports.find((Report) => Report.ReportKey === 'DocumentsV2WithSerialAndBatchDetails')?.Enabled).toBeFalse();
    expect(Service.GetAccessibleReports('ADMIN').some((Report) => Report.ReportKey === 'DocumentsV2WithSerialAndBatchDetails')).toBeFalse();

    Service.SetReportEnabled('DocumentsV2WithSerialAndBatchDetails', true);

    expect(Service.GetAccessibleReports('ADMIN').some((Report) => Report.ReportKey === 'DocumentsV2WithSerialAndBatchDetails')).toBeTrue();
  });

  it('requires the affected administrator to approve a role change and retains at least three administrators', () => {
    const AdminDraft: MockUserDraft = {
      Account: 'admin4@example.com',
      DisplayName: '系統管理員 D',
      InitialPassword: 'admin456',
      Role: 'ADMIN',
      Enabled: true,
    };
    const DemoteAdmin = {
      Account: 'admin2@example.com',
      DisplayName: '系統管理員 B',
      Role: 'FINANCE' as const,
      Enabled: true,
    };

    expect(Service.AdminCount).toBe(3);
    expect(
      Service.SaveUserEdit(
        'admin2@example.com',
        DemoteAdmin,
        'admin@example.com',
      ),
    ).toBe('minimum-admins');

    expect(Service.CreateUser(AdminDraft)).toBeTrue();
    expect(Service.AdminCount).toBe(4);
    expect(
      Service.SaveUserEdit(
        'admin2@example.com',
        DemoteAdmin,
        'admin2@example.com',
      ),
    ).toBe('self-role-change-not-allowed');
    expect(
      Service.SaveUserEdit(
        'admin2@example.com',
        DemoteAdmin,
        'admin@example.com',
      ),
    ).toBe('role-change-requested');

    const Request = Service.RoleChangeRequests[0];
    expect(Request.Status).toBe('Pending');
    expect(
      Service.RespondToRoleChangeRequest(Request.Id, 'admin@example.com', true),
    ).toBe('not-target');
    expect(
      Service.RespondToRoleChangeRequest(
        Request.Id,
        'admin2@example.com',
        false,
      ),
    ).toBe('rejected');
    expect(Service.GetUser('admin2@example.com')?.Role).toBe('ADMIN');

    expect(
      Service.SaveUserEdit(
        'admin2@example.com',
        DemoteAdmin,
        'admin@example.com',
      ),
    ).toBe('role-change-requested');
    const ApprovedRequest = Service.RoleChangeRequests[1];
    expect(
      Service.RespondToRoleChangeRequest(
        ApprovedRequest.Id,
        'admin2@example.com',
        true,
      ),
    ).toBe('approved');
    expect(Service.GetUser('admin2@example.com')?.Role).toBe('FINANCE');
    expect(Service.AdminCount).toBe(3);
  });
});
