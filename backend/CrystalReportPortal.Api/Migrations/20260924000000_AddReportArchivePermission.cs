using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CrystalReportPortal.Api.Migrations;

public partial class AddReportArchivePermission : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            IF NOT EXISTS (SELECT 1 FROM [Permissions] WHERE [PermissionCode] = N'Report.ViewArchive')
            BEGIN
                INSERT INTO [Permissions] ([PermissionCode], [PermissionName], [IsEnabled], [CreatedAt])
                VALUES (N'Report.ViewArchive', N'查詢 180 天以前封存報表', 1, SYSUTCDATETIME());
            END
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DELETE FROM [Permissions] WHERE [PermissionCode] = N'Report.ViewArchive';");
    }
}
