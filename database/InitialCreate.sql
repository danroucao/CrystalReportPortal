IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
CREATE TABLE [Printers] (
    [PrinterId] bigint NOT NULL IDENTITY,
    [PrinterName] nvarchar(500) NOT NULL,
    [DisplayName] nvarchar(200) NOT NULL,
    [Description] nvarchar(500) NULL,
    [IsEnabled] bit NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_Printers] PRIMARY KEY ([PrinterId])
);

CREATE TABLE [ReportCategories] (
    [CategoryId] int NOT NULL IDENTITY,
    [CategoryName] nvarchar(100) NOT NULL,
    [Description] nvarchar(500) NULL,
    [DisplayOrder] int NOT NULL,
    [IsEnabled] bit NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_ReportCategories] PRIMARY KEY ([CategoryId])
);

CREATE TABLE [ReportDataSources] (
    [DataSourceId] bigint NOT NULL IDENTITY,
    [DataSourceName] nvarchar(100) NOT NULL,
    [ServerHost] nvarchar(255) NOT NULL,
    [Port] int NOT NULL,
    [DatabaseName] nvarchar(255) NOT NULL,
    [IsEnabled] bit NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_ReportDataSources] PRIMARY KEY ([DataSourceId])
);

CREATE TABLE [Roles] (
    [RoleId] int NOT NULL IDENTITY,
    [RoleCode] nvarchar(50) NOT NULL,
    [RoleName] nvarchar(100) NOT NULL,
    [Description] nvarchar(500) NULL,
    [IsEnabled] bit NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_Roles] PRIMARY KEY ([RoleId])
);

CREATE TABLE [Users] (
    [UserId] bigint NOT NULL IDENTITY,
    [EmployeeNo] nvarchar(50) NOT NULL,
    [UserName] nvarchar(100) NOT NULL,
    [PasswordHash] nvarchar(255) NOT NULL,
    [IsEnabled] bit NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_Users] PRIMARY KEY ([UserId])
);

CREATE TABLE [DataSourceCredentials] (
    [CredentialId] bigint NOT NULL IDENTITY,
    [DataSourceId] bigint NOT NULL,
    [CredentialType] nvarchar(20) NOT NULL,
    [Username] nvarchar(255) NOT NULL,
    [EncryptedPassword] nvarchar(max) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_DataSourceCredentials] PRIMARY KEY ([CredentialId]),
    CONSTRAINT [FK_DataSourceCredentials_ReportDataSources_DataSourceId] FOREIGN KEY ([DataSourceId]) REFERENCES [ReportDataSources] ([DataSourceId]) ON DELETE CASCADE
);

CREATE TABLE [Reports] (
    [ReportId] bigint NOT NULL IDENTITY,
    [ReportCode] nvarchar(50) NOT NULL,
    [ReportName] nvarchar(200) NOT NULL,
    [Description] nvarchar(1000) NULL,
    [CategoryId] int NOT NULL,
    [DataSourceId] bigint NOT NULL,
    [CredentialType] nvarchar(20) NOT NULL,
    [RptFileName] nvarchar(255) NOT NULL,
    [RptFilePath] nvarchar(1000) NOT NULL,
    [IsEnabled] bit NOT NULL,
    [CreatedBy] bigint NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedBy] bigint NULL,
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_Reports] PRIMARY KEY ([ReportId]),
    CONSTRAINT [FK_Reports_ReportCategories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [ReportCategories] ([CategoryId]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Reports_ReportDataSources_DataSourceId] FOREIGN KEY ([DataSourceId]) REFERENCES [ReportDataSources] ([DataSourceId]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Reports_Users_CreatedBy] FOREIGN KEY ([CreatedBy]) REFERENCES [Users] ([UserId]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Reports_Users_UpdatedBy] FOREIGN KEY ([UpdatedBy]) REFERENCES [Users] ([UserId]) ON DELETE NO ACTION
);

CREATE TABLE [UserRoles] (
    [UserId] bigint NOT NULL,
    [RoleId] int NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_UserRoles] PRIMARY KEY ([UserId], [RoleId]),
    CONSTRAINT [FK_UserRoles_Roles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [Roles] ([RoleId]) ON DELETE CASCADE,
    CONSTRAINT [FK_UserRoles_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([UserId]) ON DELETE CASCADE
);

CREATE TABLE [ReportExecutions] (
    [ExecutionId] uniqueidentifier NOT NULL,
    [ReportId] bigint NOT NULL,
    [UserId] bigint NOT NULL,
    [ParametersJson] nvarchar(max) NULL,
    [Status] nvarchar(30) NOT NULL,
    [StartedAt] datetime2 NOT NULL,
    [CompletedAt] datetime2 NULL,
    [ErrorMessage] nvarchar(max) NULL,
    CONSTRAINT [PK_ReportExecutions] PRIMARY KEY ([ExecutionId]),
    CONSTRAINT [FK_ReportExecutions_Reports_ReportId] FOREIGN KEY ([ReportId]) REFERENCES [Reports] ([ReportId]) ON DELETE NO ACTION,
    CONSTRAINT [FK_ReportExecutions_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([UserId]) ON DELETE NO ACTION
);

CREATE TABLE [ReportParameters] (
    [ParameterId] bigint NOT NULL IDENTITY,
    [ReportId] bigint NOT NULL,
    [ParameterName] nvarchar(200) NOT NULL,
    [DisplayName] nvarchar(200) NOT NULL,
    [DataType] nvarchar(50) NOT NULL,
    [InputType] nvarchar(50) NOT NULL,
    [ValueSourceType] nvarchar(50) NOT NULL,
    [IsRequired] bit NOT NULL,
    [AllowMultipleValues] bit NOT NULL,
    [AllowRangeValues] bit NOT NULL,
    [IsVisible] bit NOT NULL,
    [DefaultValue] nvarchar(max) NULL,
    [Description] nvarchar(500) NULL,
    [DisplayOrder] int NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_ReportParameters] PRIMARY KEY ([ParameterId]),
    CONSTRAINT [FK_ReportParameters_Reports_ReportId] FOREIGN KEY ([ReportId]) REFERENCES [Reports] ([ReportId]) ON DELETE CASCADE
);

CREATE TABLE [RoleReportPermissions] (
    [RoleId] int NOT NULL,
    [ReportId] bigint NOT NULL,
    [CanExecute] bit NOT NULL,
    [CanExport] bit NOT NULL,
    [CanPrint] bit NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_RoleReportPermissions] PRIMARY KEY ([RoleId], [ReportId]),
    CONSTRAINT [FK_RoleReportPermissions_Reports_ReportId] FOREIGN KEY ([ReportId]) REFERENCES [Reports] ([ReportId]) ON DELETE CASCADE,
    CONSTRAINT [FK_RoleReportPermissions_Roles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [Roles] ([RoleId]) ON DELETE CASCADE
);

CREATE TABLE [AuditLogs] (
    [AuditLogId] bigint NOT NULL IDENTITY,
    [UserId] bigint NULL,
    [ReportId] bigint NULL,
    [ExecutionId] uniqueidentifier NULL,
    [PrinterId] bigint NULL,
    [Action] nvarchar(100) NOT NULL,
    [Result] nvarchar(30) NOT NULL,
    [Details] nvarchar(max) NULL,
    [ErrorMessage] nvarchar(max) NULL,
    [CreatedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_AuditLogs] PRIMARY KEY ([AuditLogId]),
    CONSTRAINT [FK_AuditLogs_Printers_PrinterId] FOREIGN KEY ([PrinterId]) REFERENCES [Printers] ([PrinterId]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AuditLogs_ReportExecutions_ExecutionId] FOREIGN KEY ([ExecutionId]) REFERENCES [ReportExecutions] ([ExecutionId]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AuditLogs_Reports_ReportId] FOREIGN KEY ([ReportId]) REFERENCES [Reports] ([ReportId]) ON DELETE NO ACTION,
    CONSTRAINT [FK_AuditLogs_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([UserId]) ON DELETE NO ACTION
);

CREATE TABLE [ParameterLovConfigs] (
    [LovConfigId] bigint NOT NULL IDENTITY,
    [ParameterId] bigint NOT NULL,
    [DataSourceId] bigint NOT NULL,
    [SqlQuery] nvarchar(max) NOT NULL,
    [ValueField] nvarchar(200) NOT NULL,
    [DisplayField] nvarchar(200) NOT NULL,
    [CreatedAt] datetime2 NOT NULL,
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT [PK_ParameterLovConfigs] PRIMARY KEY ([LovConfigId]),
    CONSTRAINT [FK_ParameterLovConfigs_ReportDataSources_DataSourceId] FOREIGN KEY ([DataSourceId]) REFERENCES [ReportDataSources] ([DataSourceId]) ON DELETE NO ACTION,
    CONSTRAINT [FK_ParameterLovConfigs_ReportParameters_ParameterId] FOREIGN KEY ([ParameterId]) REFERENCES [ReportParameters] ([ParameterId]) ON DELETE CASCADE
);

CREATE INDEX [IX_AuditLogs_ExecutionId] ON [AuditLogs] ([ExecutionId]);

CREATE INDEX [IX_AuditLogs_PrinterId] ON [AuditLogs] ([PrinterId]);

CREATE INDEX [IX_AuditLogs_ReportId] ON [AuditLogs] ([ReportId]);

CREATE INDEX [IX_AuditLogs_UserId] ON [AuditLogs] ([UserId]);

CREATE INDEX [IX_DataSourceCredentials_DataSourceId] ON [DataSourceCredentials] ([DataSourceId]);

CREATE INDEX [IX_ParameterLovConfigs_DataSourceId] ON [ParameterLovConfigs] ([DataSourceId]);

CREATE UNIQUE INDEX [IX_ParameterLovConfigs_ParameterId] ON [ParameterLovConfigs] ([ParameterId]);

CREATE INDEX [IX_ReportExecutions_ReportId] ON [ReportExecutions] ([ReportId]);

CREATE INDEX [IX_ReportExecutions_UserId] ON [ReportExecutions] ([UserId]);

CREATE INDEX [IX_ReportParameters_ReportId] ON [ReportParameters] ([ReportId]);

CREATE INDEX [IX_Reports_CategoryId] ON [Reports] ([CategoryId]);

CREATE INDEX [IX_Reports_CreatedBy] ON [Reports] ([CreatedBy]);

CREATE INDEX [IX_Reports_DataSourceId] ON [Reports] ([DataSourceId]);

CREATE UNIQUE INDEX [IX_Reports_ReportCode] ON [Reports] ([ReportCode]);

CREATE INDEX [IX_Reports_UpdatedBy] ON [Reports] ([UpdatedBy]);

CREATE INDEX [IX_RoleReportPermissions_ReportId] ON [RoleReportPermissions] ([ReportId]);

CREATE UNIQUE INDEX [IX_Roles_RoleCode] ON [Roles] ([RoleCode]);

CREATE INDEX [IX_UserRoles_RoleId] ON [UserRoles] ([RoleId]);

CREATE UNIQUE INDEX [IX_Users_EmployeeNo] ON [Users] ([EmployeeNo]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260831074925_InitialCreate', N'10.0.11');

COMMIT;
GO

