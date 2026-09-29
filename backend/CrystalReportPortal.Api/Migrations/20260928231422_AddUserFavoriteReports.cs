using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CrystalReportPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUserFavoriteReports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserFavoriteReports",
                columns: table => new
                {
                    UserFavoriteReportId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    ReportId = table.Column<long>(type: "bigint", nullable: false),
                    FavoritedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastUsedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserFavoriteReports", x => x.UserFavoriteReportId);
                    table.ForeignKey(
                        name: "FK_UserFavoriteReports_Reports_ReportId",
                        column: x => x.ReportId,
                        principalTable: "Reports",
                        principalColumn: "ReportId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserFavoriteReports_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserFavoriteReports_ReportId",
                table: "UserFavoriteReports",
                column: "ReportId");

            migrationBuilder.CreateIndex(
                name: "IX_UserFavoriteReports_UserId_ReportId",
                table: "UserFavoriteReports",
                columns: new[] { "UserId", "ReportId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserFavoriteReports");
        }
    }
}
