using CrystalReportPortal.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CrystalReportPortal.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260930093000_MakeReportDataSourcePortOptional")]
public partial class MakeReportDataSourcePortOptional : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AlterColumn<int>(
            name: "Port",
            table: "ReportDataSources",
            type: "int",
            nullable: true,
            oldClrType: typeof(int),
            oldType: "int",
            oldDefaultValue: 1433)
            .OldAnnotation("Relational:DefaultConstraintName", "DF_ReportDataSources_Port");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("UPDATE [ReportDataSources] SET [Port] = 1433 WHERE [Port] IS NULL;");

        migrationBuilder.AlterColumn<int>(
            name: "Port",
            table: "ReportDataSources",
            type: "int",
            nullable: false,
            defaultValue: 1433,
            oldClrType: typeof(int),
            oldType: "int",
            oldNullable: true)
            .Annotation("Relational:DefaultConstraintName", "DF_ReportDataSources_Port");
    }
}
