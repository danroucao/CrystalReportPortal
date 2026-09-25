using CrystalReportPortal.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CrystalReportPortal.Api.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260924095500_SeedDemoDepartmentUsers")]
    public partial class SeedDemoDepartmentUsers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // All demo employees intentionally start without UserRoles. This makes
            // the department-to-employee assignment workflow demonstrable.
            // The BCrypt hash is for the demo-only password: password
            migrationBuilder.Sql("""
                INSERT INTO [Users]
                    ([EmployeeNo], [Account], [UserName], [Department], [PasswordHash], [IsEnabled], [CreatedAt], [TokenVersion])
                SELECT [EmployeeNo], [Account], [UserName], [Department],
                    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
                    CAST(1 AS bit), SYSUTCDATETIME(), 0
                FROM (VALUES
                    (N'DEMO001', N'demo.fin01@example.com', N'財務部員工一', N'財務'),
                    (N'DEMO002', N'demo.fin02@example.com', N'財務部員工二', N'財務'),
                    (N'DEMO003', N'demo.hr01@example.com', N'人資部員工一', N'人資'),
                    (N'DEMO004', N'demo.hr02@example.com', N'人資部員工二', N'人資'),
                    (N'DEMO005', N'demo.sales01@example.com', N'業務部員工一', N'業務'),
                    (N'DEMO006', N'demo.sales02@example.com', N'業務部員工二', N'業務'),
                    (N'DEMO007', N'demo.it01@example.com', N'資訊部員工一', N'資訊'),
                    (N'DEMO008', N'demo.it02@example.com', N'資訊部員工二', N'資訊'),
                    (N'DEMO009', N'demo.wh01@example.com', N'倉儲部員工一', N'倉儲'),
                    (N'DEMO010', N'demo.wh02@example.com', N'倉儲部員工二', N'倉儲')
                ) AS [DemoUsers]([EmployeeNo], [Account], [UserName], [Department])
                WHERE NOT EXISTS
                (
                    SELECT 1
                    FROM [Users] AS [Existing]
                    WHERE [Existing].[EmployeeNo] = [DemoUsers].[EmployeeNo]
                       OR [Existing].[Account] = [DemoUsers].[Account]
                );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DELETE [UserRoles]
                FROM [UserRoles]
                INNER JOIN [Users] ON [Users].[UserId] = [UserRoles].[UserId]
                WHERE [Users].[EmployeeNo] IN
                (
                    N'DEMO001', N'DEMO002', N'DEMO003', N'DEMO004', N'DEMO005',
                    N'DEMO006', N'DEMO007', N'DEMO008', N'DEMO009', N'DEMO010'
                );

                DELETE FROM [Users]
                WHERE [EmployeeNo] IN
                (
                    N'DEMO001', N'DEMO002', N'DEMO003', N'DEMO004', N'DEMO005',
                    N'DEMO006', N'DEMO007', N'DEMO008', N'DEMO009', N'DEMO010'
                );
                """);
        }
    }
}
