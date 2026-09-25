using CrystalReportPortal.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CrystalReportPortal.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260925183000_SeedDevelopmentTestAccounts")]
public partial class SeedDevelopmentTestAccounts : Migration
{
    private const string UserPasswordHash = "$2a$11$rAdoYTVSALtf5TQ59yji6em4bfC7eCWRGkiwpH6iEVG/pD4niW6MG";
    private const string AdminPasswordHash = "$2a$11$YqylCUoTeirX/2YbK29xCe1Bc82gGWLr.hWgo5vpMOjXlYm6n/DGi";

    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql($"""
            DECLARE @now datetime2 = SYSUTCDATETIME();

            IF NOT EXISTS (SELECT 1 FROM [Roles] WHERE [RoleCode] = N'DEV_FRONT_USER')
                INSERT INTO [Roles] ([RoleCode], [RoleName], [Description], [IsEnabled], [CreatedAt])
                VALUES (N'DEV_FRONT_USER', N'前台測試使用者', N'本機開發用：可執行已授權分類的報表。', 1, @now);
            ELSE
                UPDATE [Roles] SET [IsEnabled] = 1, [UpdatedAt] = @now
                WHERE [RoleCode] = N'DEV_FRONT_USER';

            IF NOT EXISTS (SELECT 1 FROM [Roles] WHERE [RoleCode] = N'DEV_SYSTEM_ADMIN')
                INSERT INTO [Roles] ([RoleCode], [RoleName], [Description], [IsEnabled], [CreatedAt])
                VALUES (N'DEV_SYSTEM_ADMIN', N'系統管理者（開發）', N'本機開發用：具完整後台管理權限。', 1, @now);
            ELSE
                UPDATE [Roles] SET [IsEnabled] = 1, [UpdatedAt] = @now
                WHERE [RoleCode] = N'DEV_SYSTEM_ADMIN';

            MERGE [Permissions] AS [target]
            USING (VALUES
                (N'Report.Upload', N'上傳報表'),
                (N'Report.Maintain', N'維護報表'),
                (N'Report.SetParameters', N'設定報表參數'),
                (N'Report.EnableDisable', N'啟用或停用報表'),
                (N'Report.ViewArchive', N'查看封存報表資料'),
                (N'DataSource.Manage', N'管理資料庫連線'),
                (N'AuditLog.View', N'查看操作紀錄'),
                (N'AuditLog.ViewArchive', N'查看封存操作紀錄')
            ) AS [source] ([PermissionCode], [PermissionName])
            ON [target].[PermissionCode] = [source].[PermissionCode]
            WHEN NOT MATCHED THEN
                INSERT ([PermissionCode], [PermissionName], [IsEnabled], [CreatedAt])
                VALUES ([source].[PermissionCode], [source].[PermissionName], 1, @now)
            WHEN MATCHED THEN
                UPDATE SET [IsEnabled] = 1, [UpdatedAt] = @now;

            IF EXISTS (SELECT 1 FROM [Users] WHERE [Account] = N'user@example.com')
                UPDATE [Users]
                SET [PasswordHash] = N'{UserPasswordHash}', [IsEnabled] = 1,
                    [PasswordChangedAt] = @now, [TokenVersion] = [TokenVersion] + 1, [UpdatedAt] = @now
                WHERE [Account] = N'user@example.com';
            ELSE IF NOT EXISTS (SELECT 1 FROM [Users] WHERE [EmployeeNo] = N'DEVUSER001')
                INSERT INTO [Users] ([EmployeeNo], [Account], [UserName], [Department], [PasswordHash], [IsEnabled], [CreatedAt], [PasswordChangedAt], [TokenVersion])
                VALUES (N'DEVUSER001', N'user@example.com', N'前台測試使用者', N'開發測試', N'{UserPasswordHash}', 1, @now, @now, 0);

            IF EXISTS (SELECT 1 FROM [Users] WHERE [Account] = N'admin@example.com')
                UPDATE [Users]
                SET [PasswordHash] = N'{AdminPasswordHash}', [IsEnabled] = 1,
                    [PasswordChangedAt] = @now, [TokenVersion] = [TokenVersion] + 1, [UpdatedAt] = @now
                WHERE [Account] = N'admin@example.com';
            ELSE IF NOT EXISTS (SELECT 1 FROM [Users] WHERE [EmployeeNo] = N'DEVADMIN001')
                INSERT INTO [Users] ([EmployeeNo], [Account], [UserName], [Department], [PasswordHash], [IsEnabled], [CreatedAt], [PasswordChangedAt], [TokenVersion])
                VALUES (N'DEVADMIN001', N'admin@example.com', N'系統管理者', N'開發測試', N'{AdminPasswordHash}', 1, @now, @now, 0);

            DECLARE @userId bigint = (SELECT [UserId] FROM [Users] WHERE [Account] = N'user@example.com');
            DECLARE @adminId bigint = (SELECT [UserId] FROM [Users] WHERE [Account] = N'admin@example.com');
            DECLARE @frontRoleId int = (SELECT [RoleId] FROM [Roles] WHERE [RoleCode] = N'DEV_FRONT_USER');
            DECLARE @adminRoleId int = (SELECT [RoleId] FROM [Roles] WHERE [RoleCode] = N'DEV_SYSTEM_ADMIN');

            IF @userId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [UserRoles] WHERE [UserId] = @userId AND [RoleId] = @frontRoleId)
                INSERT INTO [UserRoles] ([UserId], [RoleId], [CreatedAt]) VALUES (@userId, @frontRoleId, @now);
            IF @adminId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [UserRoles] WHERE [UserId] = @adminId AND [RoleId] = @adminRoleId)
                INSERT INTO [UserRoles] ([UserId], [RoleId], [CreatedAt]) VALUES (@adminId, @adminRoleId, @now);

            INSERT INTO [RolePermissions] ([RoleId], [PermissionId], [CreatedAt])
            SELECT @adminRoleId, [PermissionId], @now
            FROM [Permissions]
            WHERE [PermissionCode] IN
            (N'Report.Upload', N'Report.Maintain', N'Report.SetParameters', N'Report.EnableDisable',
             N'Report.ViewArchive', N'DataSource.Manage', N'AuditLog.View', N'AuditLog.ViewArchive')
              AND NOT EXISTS
              (
                  SELECT 1 FROM [RolePermissions]
                  WHERE [RoleId] = @adminRoleId AND [PermissionId] = [Permissions].[PermissionId]
              );

            INSERT INTO [RoleCategoryPermissions] ([RoleId], [CategoryId], [CanExecute], [CanExport], [CanPrint], [CreatedAt])
            SELECT @frontRoleId, [CategoryId], 1, 0, 0, @now
            FROM [ReportCategories]
            WHERE [IsEnabled] = 1
              AND NOT EXISTS
              (
                  SELECT 1 FROM [RoleCategoryPermissions]
                  WHERE [RoleId] = @frontRoleId AND [CategoryId] = [ReportCategories].[CategoryId]
              );

            INSERT INTO [RoleCategoryPermissions] ([RoleId], [CategoryId], [CanExecute], [CanExport], [CanPrint], [CreatedAt])
            SELECT @adminRoleId, [CategoryId], 1, 1, 1, @now
            FROM [ReportCategories]
            WHERE [IsEnabled] = 1
              AND NOT EXISTS
              (
                  SELECT 1 FROM [RoleCategoryPermissions]
                  WHERE [RoleId] = @adminRoleId AND [CategoryId] = [ReportCategories].[CategoryId]
              );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Development seed data is intentionally retained when rolling back schema migrations.
    }
}
