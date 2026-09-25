using CrystalReportPortal.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CrystalReportPortal.Api.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260924110000_RepairDemoItAccount")]
    public partial class RepairDemoItAccount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The demo account may already have existed when the original seed
            // migration ran. In that case its password was intentionally left
            // untouched, which makes the published demo credential unreliable.
            // This repair is idempotent and applies only to the demo IT account.
            migrationBuilder.Sql("""
                IF NOT EXISTS
                (
                    SELECT 1
                    FROM [Users]
                    WHERE [Account] = N'demo.it01@example.com'
                )
                BEGIN
                    INSERT INTO [Users]
                        ([EmployeeNo], [Account], [UserName], [Department], [PasswordHash], [IsEnabled], [CreatedAt], [TokenVersion])
                    VALUES
                        (N'DEMO007', N'demo.it01@example.com', N'資訊部員工一', N'資訊',
                         '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
                         CAST(1 AS bit), SYSUTCDATETIME(), 0);
                END
                ELSE
                BEGIN
                    UPDATE [Users]
                    SET [PasswordHash] = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
                        [IsEnabled] = CAST(1 AS bit),
                        [PasswordChangedAt] = SYSUTCDATETIME(),
                        [TokenVersion] = [TokenVersion] + 1
                    WHERE [Account] = N'demo.it01@example.com';
                END;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Keep demo data intact when rolling back; this migration only repairs credentials.
        }
    }
}
