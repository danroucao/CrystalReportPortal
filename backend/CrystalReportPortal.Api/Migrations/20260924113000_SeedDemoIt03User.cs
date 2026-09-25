using CrystalReportPortal.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CrystalReportPortal.Api.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260924113000_SeedDemoIt03User")]
    public partial class SeedDemoIt03User : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Demo-only account. Reapplying the migration is safe: it restores
            // the documented credentials and re-enables the account.
            migrationBuilder.Sql("""
                IF EXISTS
                (
                    SELECT 1
                    FROM [Users]
                    WHERE [Account] = N'demo.it03@example.com'
                )
                BEGIN
                    UPDATE [Users]
                    SET [PasswordHash] = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
                        [IsEnabled] = CAST(1 AS bit),
                        [PasswordChangedAt] = SYSUTCDATETIME(),
                        [TokenVersion] = [TokenVersion] + 1
                    WHERE [Account] = N'demo.it03@example.com';
                END
                ELSE IF NOT EXISTS
                (
                    SELECT 1
                    FROM [Users]
                    WHERE [EmployeeNo] = N'DEMO011'
                )
                BEGIN
                    INSERT INTO [Users]
                        ([EmployeeNo], [Account], [UserName], [Department], [PasswordHash], [IsEnabled], [CreatedAt], [PasswordChangedAt], [TokenVersion])
                    VALUES
                        (N'DEMO011', N'demo.it03@example.com', N'資訊部員工三', N'資訊',
                         '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
                         CAST(1 AS bit), SYSUTCDATETIME(), SYSUTCDATETIME(), 0);
                END;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DELETE FROM [Users]
                WHERE [EmployeeNo] = N'DEMO011'
                  AND [Account] = N'demo.it03@example.com';
                """);
        }
    }
}
