using CrystalReportPortal.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CrystalReportPortal.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260924120000_AddReportColumnHeaderMappings")]
public partial class AddReportColumnHeaderMappings : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "ColumnHeaderMappingsJson",
            table: "Reports",
            type: "nvarchar(max)",
            nullable: false,
            defaultValue: "[]");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "ColumnHeaderMappingsJson", table: "Reports");
    }
}
