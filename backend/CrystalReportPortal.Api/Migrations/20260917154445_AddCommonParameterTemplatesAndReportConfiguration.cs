using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CrystalReportPortal.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCommonParameterTemplatesAndReportConfiguration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DECLARE @AddedConfigurationStatus bit =
                    CASE WHEN COL_LENGTH(N'dbo.Reports', N'ConfigurationStatus') IS NULL
                         THEN 1 ELSE 0 END;

                DECLARE @AddedIsConfigured bit =
                    CASE WHEN COL_LENGTH(N'dbo.ReportParameters', N'IsConfigured') IS NULL
                         THEN 1 ELSE 0 END;

                IF @AddedConfigurationStatus = 1
                BEGIN
                    ALTER TABLE dbo.Reports
                    ADD ConfigurationStatus nvarchar(20) NOT NULL
                        CONSTRAINT DF_Reports_ConfigurationStatus
                        DEFAULT (N'Draft') WITH VALUES;
                END;

                IF COL_LENGTH(N'dbo.ReportParameters', N'CommonTemplateId') IS NULL
                BEGIN
                    ALTER TABLE dbo.ReportParameters
                    ADD CommonTemplateId bigint NULL;
                END;

                IF @AddedIsConfigured = 1
                BEGIN
                    ALTER TABLE dbo.ReportParameters
                    ADD IsConfigured bit NOT NULL
                        CONSTRAINT DF_ReportParameters_IsConfigured
                        DEFAULT ((0)) WITH VALUES;

                    -- 升級前已存在的參數均視為既有完成設定，避免原報表突然失效。
                    UPDATE dbo.ReportParameters
                    SET IsConfigured = 1;
                END;

                IF OBJECT_ID(N'dbo.CommonParameterTemplates', N'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.CommonParameterTemplates
                    (
                        TemplateId bigint IDENTITY(1,1) NOT NULL,
                        TemplateCode nvarchar(100) NOT NULL,
                        TemplateName nvarchar(200) NOT NULL,
                        NormalizedParameterName nvarchar(200) NOT NULL,
                        DataType nvarchar(50) NOT NULL,
                        InputType nvarchar(50) NOT NULL,
                        ValueSourceType nvarchar(50) NOT NULL,
                        IsRequired bit NOT NULL,
                        AllowMultipleValues bit NOT NULL,
                        AllowRangeValues bit NOT NULL,
                        IsVisible bit NOT NULL,
                        DataSourceId bigint NULL,
                        SqlQuery nvarchar(max) NULL,
                        ValueField nvarchar(200) NULL,
                        DisplayField nvarchar(200) NULL,
                        DefaultValue nvarchar(max) NULL,
                        Description nvarchar(1000) NULL,
                        IsEnabled bit NOT NULL,
                        CreatedBy bigint NOT NULL,
                        CreatedAt datetime2 NOT NULL
                            CONSTRAINT DF_CommonParameterTemplates_CreatedAt
                            DEFAULT (sysdatetime()),
                        UpdatedBy bigint NULL,
                        UpdatedAt datetime2 NULL,
                        CONSTRAINT PK_CommonParameterTemplates
                            PRIMARY KEY (TemplateId)
                    );
                END;

                IF NOT EXISTS
                (
                    SELECT 1
                    FROM sys.indexes
                    WHERE name = N'IX_ReportParameters_CommonTemplateId'
                      AND object_id = OBJECT_ID(N'dbo.ReportParameters')
                )
                BEGIN
                    CREATE INDEX IX_ReportParameters_CommonTemplateId
                    ON dbo.ReportParameters(CommonTemplateId);
                END;

                IF NOT EXISTS
                (
                    SELECT 1
                    FROM sys.indexes
                    WHERE name = N'IX_CommonParameterTemplates_CreatedBy'
                      AND object_id = OBJECT_ID(N'dbo.CommonParameterTemplates')
                )
                BEGIN
                    CREATE INDEX IX_CommonParameterTemplates_CreatedBy
                    ON dbo.CommonParameterTemplates(CreatedBy);
                END;

                IF NOT EXISTS
                (
                    SELECT 1
                    FROM sys.indexes
                    WHERE name = N'IX_CommonParameterTemplates_DataSourceId'
                      AND object_id = OBJECT_ID(N'dbo.CommonParameterTemplates')
                )
                BEGIN
                    CREATE INDEX IX_CommonParameterTemplates_DataSourceId
                    ON dbo.CommonParameterTemplates(DataSourceId);
                END;

                IF NOT EXISTS
                (
                    SELECT 1
                    FROM sys.indexes
                    WHERE name = N'IX_CommonParameterTemplates_TemplateCode'
                      AND object_id = OBJECT_ID(N'dbo.CommonParameterTemplates')
                )
                BEGIN
                    CREATE UNIQUE INDEX IX_CommonParameterTemplates_TemplateCode
                    ON dbo.CommonParameterTemplates(TemplateCode);
                END;

                IF NOT EXISTS
                (
                    SELECT 1
                    FROM sys.indexes
                    WHERE name = N'IX_CommonParameterTemplates_UpdatedBy'
                      AND object_id = OBJECT_ID(N'dbo.CommonParameterTemplates')
                )
                BEGIN
                    CREATE INDEX IX_CommonParameterTemplates_UpdatedBy
                    ON dbo.CommonParameterTemplates(UpdatedBy);
                END;

                IF NOT EXISTS
                (
                    SELECT 1 FROM sys.foreign_keys
                    WHERE name = N'FK_CommonParameterTemplates_ReportDataSources_DataSourceId'
                )
                BEGIN
                    ALTER TABLE dbo.CommonParameterTemplates WITH CHECK
                    ADD CONSTRAINT FK_CommonParameterTemplates_ReportDataSources_DataSourceId
                        FOREIGN KEY (DataSourceId)
                        REFERENCES dbo.ReportDataSources(DataSourceId);
                END;

                IF NOT EXISTS
                (
                    SELECT 1 FROM sys.foreign_keys
                    WHERE name = N'FK_CommonParameterTemplates_Users_CreatedBy'
                )
                BEGIN
                    ALTER TABLE dbo.CommonParameterTemplates WITH CHECK
                    ADD CONSTRAINT FK_CommonParameterTemplates_Users_CreatedBy
                        FOREIGN KEY (CreatedBy)
                        REFERENCES dbo.Users(UserId);
                END;

                IF NOT EXISTS
                (
                    SELECT 1 FROM sys.foreign_keys
                    WHERE name = N'FK_CommonParameterTemplates_Users_UpdatedBy'
                )
                BEGIN
                    ALTER TABLE dbo.CommonParameterTemplates WITH CHECK
                    ADD CONSTRAINT FK_CommonParameterTemplates_Users_UpdatedBy
                        FOREIGN KEY (UpdatedBy)
                        REFERENCES dbo.Users(UserId);
                END;

                IF NOT EXISTS
                (
                    SELECT 1 FROM sys.foreign_keys
                    WHERE name = N'FK_ReportParameters_CommonParameterTemplates_CommonTemplateId'
                )
                BEGIN
                    ALTER TABLE dbo.ReportParameters WITH CHECK
                    ADD CONSTRAINT FK_ReportParameters_CommonParameterTemplates_CommonTemplateId
                        FOREIGN KEY (CommonTemplateId)
                        REFERENCES dbo.CommonParameterTemplates(TemplateId);
                END;

                -- 只在本次 Migration 新增狀態欄位時回填舊報表。
                IF @AddedConfigurationStatus = 1
                BEGIN
                    UPDATE report
                    SET ConfigurationStatus = N'Ready'
                    FROM dbo.Reports AS report
                    WHERE NULLIF(LTRIM(RTRIM(report.RptFilePath)), N'') IS NOT NULL
                      AND NOT EXISTS
                      (
                          SELECT 1
                          FROM dbo.ReportParameters AS parameter
                          WHERE parameter.ReportId = report.ReportId
                            AND parameter.IsConfigured = 0
                      );
                END;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                IF EXISTS
                (
                    SELECT 1 FROM sys.foreign_keys
                    WHERE name = N'FK_ReportParameters_CommonParameterTemplates_CommonTemplateId'
                )
                BEGIN
                    ALTER TABLE dbo.ReportParameters
                    DROP CONSTRAINT FK_ReportParameters_CommonParameterTemplates_CommonTemplateId;
                END;

                IF OBJECT_ID(N'dbo.CommonParameterTemplates', N'U') IS NOT NULL
                BEGIN
                    DROP TABLE dbo.CommonParameterTemplates;
                END;

                IF EXISTS
                (
                    SELECT 1
                    FROM sys.indexes
                    WHERE name = N'IX_ReportParameters_CommonTemplateId'
                      AND object_id = OBJECT_ID(N'dbo.ReportParameters')
                )
                BEGIN
                    DROP INDEX IX_ReportParameters_CommonTemplateId
                    ON dbo.ReportParameters;
                END;

                IF COL_LENGTH(N'dbo.Reports', N'ConfigurationStatus') IS NOT NULL
                BEGIN
                    IF OBJECT_ID(N'dbo.DF_Reports_ConfigurationStatus', N'D') IS NOT NULL
                    BEGIN
                        ALTER TABLE dbo.Reports
                        DROP CONSTRAINT DF_Reports_ConfigurationStatus;
                    END;

                    ALTER TABLE dbo.Reports
                    DROP COLUMN ConfigurationStatus;
                END;

                IF COL_LENGTH(N'dbo.ReportParameters', N'CommonTemplateId') IS NOT NULL
                BEGIN
                    ALTER TABLE dbo.ReportParameters
                    DROP COLUMN CommonTemplateId;
                END;

                IF COL_LENGTH(N'dbo.ReportParameters', N'IsConfigured') IS NOT NULL
                BEGIN
                    IF OBJECT_ID(N'dbo.DF_ReportParameters_IsConfigured', N'D') IS NOT NULL
                    BEGIN
                        ALTER TABLE dbo.ReportParameters
                        DROP CONSTRAINT DF_ReportParameters_IsConfigured;
                    END;

                    ALTER TABLE dbo.ReportParameters
                    DROP COLUMN IsConfigured;
                END;
                """);
        }
    }
}
