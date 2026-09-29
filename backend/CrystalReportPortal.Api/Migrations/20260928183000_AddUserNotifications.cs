using System;
using CrystalReportPortal.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CrystalReportPortal.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260928183000_AddUserNotifications")]
public partial class AddUserNotifications : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "UserNotifications",
            columns: table => new
            {
                NotificationId = table.Column<long>(type: "bigint", nullable: false)
                    .Annotation("SqlServer:Identity", "1, 1"),
                RecipientUserId = table.Column<long>(type: "bigint", nullable: false),
                Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                Summary = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                Detail = table.Column<string>(type: "nvarchar(max)", nullable: false),
                TargetPath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                ReadAt = table.Column<DateTime>(type: "datetime2", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_UserNotifications", x => x.NotificationId);
                table.ForeignKey(
                    name: "FK_UserNotifications_Users_RecipientUserId",
                    column: x => x.RecipientUserId,
                    principalTable: "Users",
                    principalColumn: "UserId",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_UserNotifications_RecipientUserId_ReadAt_CreatedAt",
            table: "UserNotifications",
            columns: new[] { "RecipientUserId", "ReadAt", "CreatedAt" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "UserNotifications");
    }
}
