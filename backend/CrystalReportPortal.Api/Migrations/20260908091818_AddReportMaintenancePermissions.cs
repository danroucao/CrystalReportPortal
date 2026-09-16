using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CrystalReportPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddReportMaintenancePermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CanEnableDisable",
                table: "RoleReportPermissions",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "CanMaintain",
                table: "RoleReportPermissions",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "CanSetParameters",
                table: "RoleReportPermissions",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "CanUpload",
                table: "RoleReportPermissions",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CanEnableDisable",
                table: "RoleReportPermissions");

            migrationBuilder.DropColumn(
                name: "CanMaintain",
                table: "RoleReportPermissions");

            migrationBuilder.DropColumn(
                name: "CanSetParameters",
                table: "RoleReportPermissions");

            migrationBuilder.DropColumn(
                name: "CanUpload",
                table: "RoleReportPermissions");
        }
    }
}
