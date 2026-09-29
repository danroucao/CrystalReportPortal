using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CrystalReportPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUserReportParameterPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserReportParameterPreferences",
                columns: table => new
                {
                    PreferenceId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    ReportId = table.Column<long>(type: "bigint", nullable: false),
                    PreferenceType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ParametersJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserReportParameterPreferences", x => x.PreferenceId);
                    table.ForeignKey(
                        name: "FK_UserReportParameterPreferences_Reports_ReportId",
                        column: x => x.ReportId,
                        principalTable: "Reports",
                        principalColumn: "ReportId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserReportParameterPreferences_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserReportParameterPreferences_ReportId",
                table: "UserReportParameterPreferences",
                column: "ReportId");

            migrationBuilder.CreateIndex(
                name: "IX_UserReportParameterPreferences_UserId_ReportId_PreferenceType",
                table: "UserReportParameterPreferences",
                columns: new[] { "UserId", "ReportId", "PreferenceType" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserReportParameterPreferences");
        }
    }
}
