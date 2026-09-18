using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CrystalReportPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditLogIpAddress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "IpAddress",
                table: "AuditLogs",
                type: "nvarchar(45)",
                maxLength: 45,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IpAddress",
                table: "AuditLogs");
        }
    }
}
