using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CrystalReportPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUserAccount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. 先新增 Account，暫時允許 NULL
            migrationBuilder.AddColumn<string>(
                name: "Account",
                table: "Users",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: true);

            // 2. 為目前既有測試帳號設定登入 Account
            migrationBuilder.Sql("""
                UPDATE Users
                SET Account = 'admin@example.com'
                WHERE EmployeeNo = 'TEST001';
                """);

            // 3. Account 改成必填
            migrationBuilder.AlterColumn<string>(
                name: "Account",
                table: "Users",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(255)",
                oldMaxLength: 255,
                oldNullable: true);

            // 4. 建立唯一索引
            migrationBuilder.CreateIndex(
                name: "IX_Users_Account",
                table: "Users",
                column: "Account",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_Account",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Account",
                table: "Users");
        }
    }
}
