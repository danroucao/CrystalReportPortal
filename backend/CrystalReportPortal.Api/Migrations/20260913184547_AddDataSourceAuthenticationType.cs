using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CrystalReportPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDataSourceAuthenticationType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_DataSourceCredentials_DataSourceId",
                table: "DataSourceCredentials");

            migrationBuilder.AlterColumn<string>(
                name: "Username",
                table: "DataSourceCredentials",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(255)",
                oldMaxLength: 255);

            migrationBuilder.AlterColumn<string>(
                name: "EncryptedPassword",
                table: "DataSourceCredentials",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<string>(
                name: "AuthenticationType",
                table: "DataSourceCredentials",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "SqlServer")
                .Annotation("Relational:DefaultConstraintName", "DF_DataSourceCredentials_AuthenticationType");

            migrationBuilder.CreateIndex(
                name: "IX_DataSourceCredentials_DataSourceId_CredentialType",
                table: "DataSourceCredentials",
                columns: new[] { "DataSourceId", "CredentialType" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_DataSourceCredentials_DataSourceId_CredentialType",
                table: "DataSourceCredentials");

            migrationBuilder.DropColumn(
                name: "AuthenticationType",
                table: "DataSourceCredentials")
                .Annotation("Relational:DefaultConstraintName", "DF_DataSourceCredentials_AuthenticationType");

            migrationBuilder.AlterColumn<string>(
                name: "Username",
                table: "DataSourceCredentials",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(255)",
                oldMaxLength: 255,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "EncryptedPassword",
                table: "DataSourceCredentials",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_DataSourceCredentials_DataSourceId",
                table: "DataSourceCredentials",
                column: "DataSourceId");
        }
    }
}
