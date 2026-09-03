using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CrystalReportPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDatabaseDefaults : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<bool>(
                name: "IsEnabled",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: true,
                oldClrType: typeof(bool),
                oldType: "bit")
                .Annotation("Relational:DefaultConstraintName", "DF_Users_IsEnabled");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "Users",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "(sysdatetime())",
                oldClrType: typeof(DateTime),
                oldType: "datetime2")
                .Annotation("Relational:DefaultConstraintName", "DF_Users_CreatedAt");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "UserRoles",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "(sysdatetime())",
                oldClrType: typeof(DateTime),
                oldType: "datetime2")
                .Annotation("Relational:DefaultConstraintName", "DF_UserRoles_CreatedAt");

            migrationBuilder.AlterColumn<bool>(
                name: "IsEnabled",
                table: "Roles",
                type: "bit",
                nullable: false,
                defaultValue: true,
                oldClrType: typeof(bool),
                oldType: "bit")
                .Annotation("Relational:DefaultConstraintName", "DF_Roles_IsEnabled");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "Roles",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "(sysdatetime())",
                oldClrType: typeof(DateTime),
                oldType: "datetime2")
                .Annotation("Relational:DefaultConstraintName", "DF_Roles_CreatedAt");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "RoleReportPermissions",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "(sysdatetime())",
                oldClrType: typeof(DateTime),
                oldType: "datetime2")
                .Annotation("Relational:DefaultConstraintName", "DF_RoleReportPermissions_CreatedAt");

            migrationBuilder.AlterColumn<bool>(
                name: "IsEnabled",
                table: "Reports",
                type: "bit",
                nullable: false,
                defaultValue: true,
                oldClrType: typeof(bool),
                oldType: "bit")
                .Annotation("Relational:DefaultConstraintName", "DF_Reports_IsEnabled");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "Reports",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "(sysdatetime())",
                oldClrType: typeof(DateTime),
                oldType: "datetime2")
                .Annotation("Relational:DefaultConstraintName", "DF_Reports_CreatedAt");

            migrationBuilder.AlterColumn<bool>(
                name: "IsVisible",
                table: "ReportParameters",
                type: "bit",
                nullable: false,
                defaultValue: true,
                oldClrType: typeof(bool),
                oldType: "bit")
                .Annotation("Relational:DefaultConstraintName", "DF_ReportParameters_IsVisible");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "ReportParameters",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "(sysdatetime())",
                oldClrType: typeof(DateTime),
                oldType: "datetime2")
                .Annotation("Relational:DefaultConstraintName", "DF_ReportParameters_CreatedAt");

            migrationBuilder.AlterColumn<DateTime>(
                name: "StartedAt",
                table: "ReportExecutions",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "(sysdatetime())",
                oldClrType: typeof(DateTime),
                oldType: "datetime2")
                .Annotation("Relational:DefaultConstraintName", "DF_ReportExecutions_StartedAt");

            migrationBuilder.AlterColumn<Guid>(
                name: "ExecutionId",
                table: "ReportExecutions",
                type: "uniqueidentifier",
                nullable: false,
                defaultValueSql: "(newsequentialid())",
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier")
                .Annotation("Relational:DefaultConstraintName", "DF_ReportExecutions_ExecutionId");

            migrationBuilder.AlterColumn<int>(
                name: "Port",
                table: "ReportDataSources",
                type: "int",
                nullable: false,
                defaultValue: 1433,
                oldClrType: typeof(int),
                oldType: "int")
                .Annotation("Relational:DefaultConstraintName", "DF_ReportDataSources_Port");

            migrationBuilder.AlterColumn<bool>(
                name: "IsEnabled",
                table: "ReportDataSources",
                type: "bit",
                nullable: false,
                defaultValue: true,
                oldClrType: typeof(bool),
                oldType: "bit")
                .Annotation("Relational:DefaultConstraintName", "DF_ReportDataSources_IsEnabled");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "ReportDataSources",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "(sysdatetime())",
                oldClrType: typeof(DateTime),
                oldType: "datetime2")
                .Annotation("Relational:DefaultConstraintName", "DF_ReportDataSources_CreatedAt");

            migrationBuilder.AlterColumn<bool>(
                name: "IsEnabled",
                table: "ReportCategories",
                type: "bit",
                nullable: false,
                defaultValue: true,
                oldClrType: typeof(bool),
                oldType: "bit")
                .Annotation("Relational:DefaultConstraintName", "DF_ReportCategories_IsEnabled");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "ReportCategories",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "(sysdatetime())",
                oldClrType: typeof(DateTime),
                oldType: "datetime2")
                .Annotation("Relational:DefaultConstraintName", "DF_ReportCategories_CreatedAt");

            migrationBuilder.AlterColumn<bool>(
                name: "IsEnabled",
                table: "Printers",
                type: "bit",
                nullable: false,
                defaultValue: true,
                oldClrType: typeof(bool),
                oldType: "bit")
                .Annotation("Relational:DefaultConstraintName", "DF_Printers_IsEnabled");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "Printers",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "(sysdatetime())",
                oldClrType: typeof(DateTime),
                oldType: "datetime2")
                .Annotation("Relational:DefaultConstraintName", "DF_Printers_CreatedAt");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "ParameterLovConfigs",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "(sysdatetime())",
                oldClrType: typeof(DateTime),
                oldType: "datetime2")
                .Annotation("Relational:DefaultConstraintName", "DF_ParameterLovConfigs_CreatedAt");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "DataSourceCredentials",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "(sysdatetime())",
                oldClrType: typeof(DateTime),
                oldType: "datetime2")
                .Annotation("Relational:DefaultConstraintName", "DF_DataSourceCredentials_CreatedAt");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "AuditLogs",
                type: "datetime2",
                nullable: false,
                defaultValueSql: "(sysdatetime())",
                oldClrType: typeof(DateTime),
                oldType: "datetime2")
                .Annotation("Relational:DefaultConstraintName", "DF_AuditLogs_CreatedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<bool>(
                name: "IsEnabled",
                table: "Users",
                type: "bit",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "bit",
                oldDefaultValue: true)
                .OldAnnotation("Relational:DefaultConstraintName", "DF_Users_IsEnabled");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "Users",
                type: "datetime2",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldDefaultValueSql: "(sysdatetime())")
                .OldAnnotation("Relational:DefaultConstraintName", "DF_Users_CreatedAt");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "UserRoles",
                type: "datetime2",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldDefaultValueSql: "(sysdatetime())")
                .OldAnnotation("Relational:DefaultConstraintName", "DF_UserRoles_CreatedAt");

            migrationBuilder.AlterColumn<bool>(
                name: "IsEnabled",
                table: "Roles",
                type: "bit",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "bit",
                oldDefaultValue: true)
                .OldAnnotation("Relational:DefaultConstraintName", "DF_Roles_IsEnabled");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "Roles",
                type: "datetime2",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldDefaultValueSql: "(sysdatetime())")
                .OldAnnotation("Relational:DefaultConstraintName", "DF_Roles_CreatedAt");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "RoleReportPermissions",
                type: "datetime2",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldDefaultValueSql: "(sysdatetime())")
                .OldAnnotation("Relational:DefaultConstraintName", "DF_RoleReportPermissions_CreatedAt");

            migrationBuilder.AlterColumn<bool>(
                name: "IsEnabled",
                table: "Reports",
                type: "bit",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "bit",
                oldDefaultValue: true)
                .OldAnnotation("Relational:DefaultConstraintName", "DF_Reports_IsEnabled");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "Reports",
                type: "datetime2",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldDefaultValueSql: "(sysdatetime())")
                .OldAnnotation("Relational:DefaultConstraintName", "DF_Reports_CreatedAt");

            migrationBuilder.AlterColumn<bool>(
                name: "IsVisible",
                table: "ReportParameters",
                type: "bit",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "bit",
                oldDefaultValue: true)
                .OldAnnotation("Relational:DefaultConstraintName", "DF_ReportParameters_IsVisible");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "ReportParameters",
                type: "datetime2",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldDefaultValueSql: "(sysdatetime())")
                .OldAnnotation("Relational:DefaultConstraintName", "DF_ReportParameters_CreatedAt");

            migrationBuilder.AlterColumn<DateTime>(
                name: "StartedAt",
                table: "ReportExecutions",
                type: "datetime2",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldDefaultValueSql: "(sysdatetime())")
                .OldAnnotation("Relational:DefaultConstraintName", "DF_ReportExecutions_StartedAt");

            migrationBuilder.AlterColumn<Guid>(
                name: "ExecutionId",
                table: "ReportExecutions",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldDefaultValueSql: "(newsequentialid())")
                .OldAnnotation("Relational:DefaultConstraintName", "DF_ReportExecutions_ExecutionId");

            migrationBuilder.AlterColumn<int>(
                name: "Port",
                table: "ReportDataSources",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldDefaultValue: 1433)
                .OldAnnotation("Relational:DefaultConstraintName", "DF_ReportDataSources_Port");

            migrationBuilder.AlterColumn<bool>(
                name: "IsEnabled",
                table: "ReportDataSources",
                type: "bit",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "bit",
                oldDefaultValue: true)
                .OldAnnotation("Relational:DefaultConstraintName", "DF_ReportDataSources_IsEnabled");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "ReportDataSources",
                type: "datetime2",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldDefaultValueSql: "(sysdatetime())")
                .OldAnnotation("Relational:DefaultConstraintName", "DF_ReportDataSources_CreatedAt");

            migrationBuilder.AlterColumn<bool>(
                name: "IsEnabled",
                table: "ReportCategories",
                type: "bit",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "bit",
                oldDefaultValue: true)
                .OldAnnotation("Relational:DefaultConstraintName", "DF_ReportCategories_IsEnabled");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "ReportCategories",
                type: "datetime2",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldDefaultValueSql: "(sysdatetime())")
                .OldAnnotation("Relational:DefaultConstraintName", "DF_ReportCategories_CreatedAt");

            migrationBuilder.AlterColumn<bool>(
                name: "IsEnabled",
                table: "Printers",
                type: "bit",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "bit",
                oldDefaultValue: true)
                .OldAnnotation("Relational:DefaultConstraintName", "DF_Printers_IsEnabled");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "Printers",
                type: "datetime2",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldDefaultValueSql: "(sysdatetime())")
                .OldAnnotation("Relational:DefaultConstraintName", "DF_Printers_CreatedAt");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "ParameterLovConfigs",
                type: "datetime2",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldDefaultValueSql: "(sysdatetime())")
                .OldAnnotation("Relational:DefaultConstraintName", "DF_ParameterLovConfigs_CreatedAt");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "DataSourceCredentials",
                type: "datetime2",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldDefaultValueSql: "(sysdatetime())")
                .OldAnnotation("Relational:DefaultConstraintName", "DF_DataSourceCredentials_CreatedAt");

            migrationBuilder.AlterColumn<DateTime>(
                name: "CreatedAt",
                table: "AuditLogs",
                type: "datetime2",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldDefaultValueSql: "(sysdatetime())")
                .OldAnnotation("Relational:DefaultConstraintName", "DF_AuditLogs_CreatedAt");
        }
    }
}
