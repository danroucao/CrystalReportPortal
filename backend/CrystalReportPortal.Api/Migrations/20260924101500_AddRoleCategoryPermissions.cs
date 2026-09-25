using System;
using CrystalReportPortal.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CrystalReportPortal.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260924101500_AddRoleCategoryPermissions")]
public partial class AddRoleCategoryPermissions : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "RoleCategoryPermissions",
            columns: table => new
            {
                RoleId = table.Column<int>(type: "int", nullable: false),
                CategoryId = table.Column<int>(type: "int", nullable: false),
                CanExecute = table.Column<bool>(type: "bit", nullable: false),
                CanExport = table.Column<bool>(type: "bit", nullable: false),
                CanPrint = table.Column<bool>(type: "bit", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "(sysdatetime())"),
                UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_RoleCategoryPermissions", x => new { x.RoleId, x.CategoryId });
                table.ForeignKey(
                    name: "FK_RoleCategoryPermissions_ReportCategories_CategoryId",
                    column: x => x.CategoryId,
                    principalTable: "ReportCategories",
                    principalColumn: "CategoryId",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "FK_RoleCategoryPermissions_Roles_RoleId",
                    column: x => x.RoleId,
                    principalTable: "Roles",
                    principalColumn: "RoleId",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_RoleCategoryPermissions_CategoryId",
            table: "RoleCategoryPermissions",
            column: "CategoryId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "RoleCategoryPermissions");
    }
}
