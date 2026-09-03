using CrystalReportPortal.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace CrystalReportPortal.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    // =========================
    // DbSets
    // =========================

    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();

    public DbSet<ReportCategory> ReportCategories => Set<ReportCategory>();
    public DbSet<Report> Reports => Set<Report>();
    public DbSet<RoleReportPermission> RoleReportPermissions => Set<RoleReportPermission>();

    public DbSet<ReportDataSource> ReportDataSources => Set<ReportDataSource>();
    public DbSet<DataSourceCredential> DataSourceCredentials => Set<DataSourceCredential>();

    public DbSet<ReportParameter> ReportParameters => Set<ReportParameter>();
    public DbSet<ParameterLovConfig> ParameterLovConfigs => Set<ParameterLovConfig>();

    public DbSet<ReportExecution> ReportExecutions => Set<ReportExecution>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Printer> Printers => Set<Printer>();

    // =========================
    // Model Configuration
    // =========================

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        ConfigureUsers(modelBuilder);
        ConfigureRoles(modelBuilder);
        ConfigureUserRoles(modelBuilder);

        ConfigureReportCategories(modelBuilder);
        ConfigureReportDataSources(modelBuilder);
        ConfigureDataSourceCredentials(modelBuilder);

        ConfigureReports(modelBuilder);
        ConfigureRoleReportPermissions(modelBuilder);

        ConfigureReportParameters(modelBuilder);
        ConfigureParameterLovConfigs(modelBuilder);

        ConfigureReportExecutions(modelBuilder);
        ConfigurePrinters(modelBuilder);
        ConfigureAuditLogs(modelBuilder);
    }

    // =========================================================
    // Users
    // =========================================================

    private static void ConfigureUsers(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("Users");

            entity.HasKey(x => x.UserId);

            entity.HasIndex(x => x.EmployeeNo)
                .IsUnique();

            entity.HasIndex(x => x.Account)
                .IsUnique();

            entity.Property(x => x.EmployeeNo)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.Account)
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(x => x.UserName)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.PasswordHash)
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(x => x.IsEnabled)
                .HasDefaultValue(true, "DF_Users_IsEnabled")
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime2")
                .HasDefaultValueSql(
                    "(sysdatetime())",
                    "DF_Users_CreatedAt")
                .IsRequired();

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime2");
        });
    }

    // =========================================================
    // Roles
    // =========================================================

    private static void ConfigureRoles(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Role>(entity =>
        {
            entity.ToTable("Roles");

            entity.HasKey(x => x.RoleId);

            entity.HasIndex(x => x.RoleCode)
                .IsUnique();

            entity.Property(x => x.RoleCode)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.RoleName)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.Description)
                .HasMaxLength(500);

            entity.Property(x => x.IsEnabled)
                .HasDefaultValue(true, "DF_Roles_IsEnabled")
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime2")
                .HasDefaultValueSql(
                    "(sysdatetime())",
                    "DF_Roles_CreatedAt")
                .IsRequired();

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime2");
        });
    }

    // =========================================================
    // UserRoles
    // =========================================================

    private static void ConfigureUserRoles(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<UserRole>(entity =>
        {
            entity.ToTable("UserRoles");

            entity.HasKey(x => new
            {
                x.UserId,
                x.RoleId
            });

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime2")
                .HasDefaultValueSql(
                    "(sysdatetime())",
                    "DF_UserRoles_CreatedAt")
                .IsRequired();

            entity.HasOne(x => x.User)
                .WithMany(x => x.UserRoles)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Role)
                .WithMany(x => x.UserRoles)
                .HasForeignKey(x => x.RoleId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    // =========================================================
    // ReportCategories
    // =========================================================

    private static void ConfigureReportCategories(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ReportCategory>(entity =>
        {
            entity.ToTable("ReportCategories");

            entity.HasKey(x => x.CategoryId);

            entity.Property(x => x.CategoryName)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.Description)
                .HasMaxLength(500);

            entity.Property(x => x.DisplayOrder)
                .IsRequired();

            entity.Property(x => x.IsEnabled)
                .HasDefaultValue(
                    true,
                    "DF_ReportCategories_IsEnabled")
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime2")
                .HasDefaultValueSql(
                    "(sysdatetime())",
                    "DF_ReportCategories_CreatedAt")
                .IsRequired();

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime2");
        });
    }

    // =========================================================
    // ReportDataSources
    // =========================================================

    private static void ConfigureReportDataSources(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ReportDataSource>(entity =>
        {
            entity.ToTable("ReportDataSources");

            entity.HasKey(x => x.DataSourceId);

            entity.Property(x => x.DataSourceName)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.ServerHost)
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(x => x.Port)
                .HasDefaultValue(
                    1433,
                    "DF_ReportDataSources_Port")
                .IsRequired();

            entity.Property(x => x.DatabaseName)
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(x => x.IsEnabled)
                .HasDefaultValue(
                    true,
                    "DF_ReportDataSources_IsEnabled")
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime2")
                .HasDefaultValueSql(
                    "(sysdatetime())",
                    "DF_ReportDataSources_CreatedAt")
                .IsRequired();

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime2");
        });
    }

    // =========================================================
    // DataSourceCredentials
    // =========================================================

    private static void ConfigureDataSourceCredentials(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DataSourceCredential>(entity =>
        {
            entity.ToTable("DataSourceCredentials");

            entity.HasKey(x => x.CredentialId);

            entity.Property(x => x.CredentialType)
                .HasMaxLength(20)
                .IsRequired();

            entity.Property(x => x.Username)
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(x => x.EncryptedPassword)
                .HasColumnType("nvarchar(max)")
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime2")
                .HasDefaultValueSql(
                    "(sysdatetime())",
                    "DF_DataSourceCredentials_CreatedAt")
                .IsRequired();

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime2");

            entity.HasOne(x => x.DataSource)
                .WithMany(x => x.Credentials)
                .HasForeignKey(x => x.DataSourceId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    // =========================================================
    // Reports
    // =========================================================

    private static void ConfigureReports(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Report>(entity =>
        {
            entity.ToTable("Reports");

            entity.HasKey(x => x.ReportId);

            entity.HasIndex(x => x.ReportCode)
                .IsUnique();

            entity.Property(x => x.ReportCode)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.ReportName)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.Description)
                .HasMaxLength(1000);

            entity.Property(x => x.CredentialType)
                .HasMaxLength(20)
                .IsRequired();

            entity.Property(x => x.RptFileName)
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(x => x.RptFilePath)
                .HasMaxLength(1000)
                .IsRequired();

            entity.Property(x => x.IsEnabled)
                .HasDefaultValue(
                    true,
                    "DF_Reports_IsEnabled")
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime2")
                .HasDefaultValueSql(
                    "(sysdatetime())",
                    "DF_Reports_CreatedAt")
                .IsRequired();

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime2");

            entity.HasOne(x => x.Category)
                .WithMany(x => x.Reports)
                .HasForeignKey(x => x.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.DataSource)
                .WithMany(x => x.Reports)
                .HasForeignKey(x => x.DataSourceId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.Creator)
                .WithMany(x => x.CreatedReports)
                .HasForeignKey(x => x.CreatedBy)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.Updater)
                .WithMany(x => x.UpdatedReports)
                .HasForeignKey(x => x.UpdatedBy)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }

    // =========================================================
    // RoleReportPermissions
    // =========================================================

    private static void ConfigureRoleReportPermissions(
        ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<RoleReportPermission>(entity =>
        {
            entity.ToTable("RoleReportPermissions");

            entity.HasKey(x => new
            {
                x.RoleId,
                x.ReportId
            });

            entity.Property(x => x.CanExecute)
                .IsRequired();

            entity.Property(x => x.CanExport)
                .IsRequired();

            entity.Property(x => x.CanPrint)
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime2")
                .HasDefaultValueSql(
                    "(sysdatetime())",
                    "DF_RoleReportPermissions_CreatedAt")
                .IsRequired();

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime2");

            entity.HasOne(x => x.Role)
                .WithMany(x => x.RoleReportPermissions)
                .HasForeignKey(x => x.RoleId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Report)
                .WithMany(x => x.RoleReportPermissions)
                .HasForeignKey(x => x.ReportId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    // =========================================================
    // ReportParameters
    // =========================================================

    private static void ConfigureReportParameters(
        ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ReportParameter>(entity =>
        {
            entity.ToTable("ReportParameters");

            entity.HasKey(x => x.ParameterId);

            entity.Property(x => x.ParameterName)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.DisplayName)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.DataType)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.InputType)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.ValueSourceType)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.IsRequired)
                .IsRequired();

            entity.Property(x => x.AllowMultipleValues)
                .IsRequired();

            entity.Property(x => x.AllowRangeValues)
                .IsRequired();

            entity.Property(x => x.IsVisible)
                .HasDefaultValue(
                    true,
                    "DF_ReportParameters_IsVisible")
                .IsRequired();

            entity.Property(x => x.DefaultValue)
                .HasColumnType("nvarchar(max)");

            entity.Property(x => x.Description)
                .HasMaxLength(500);

            entity.Property(x => x.DisplayOrder)
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime2")
                .HasDefaultValueSql(
                    "(sysdatetime())",
                    "DF_ReportParameters_CreatedAt")
                .IsRequired();

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime2");

            entity.HasOne(x => x.Report)
                .WithMany(x => x.ReportParameters)
                .HasForeignKey(x => x.ReportId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    // =========================================================
    // ParameterLovConfigs
    // =========================================================

    private static void ConfigureParameterLovConfigs(
        ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ParameterLovConfig>(entity =>
        {
            entity.ToTable("ParameterLovConfigs");

            entity.HasKey(x => x.LovConfigId);

            entity.HasIndex(x => x.ParameterId)
                .IsUnique();

            entity.Property(x => x.SqlQuery)
                .HasColumnType("nvarchar(max)")
                .IsRequired();

            entity.Property(x => x.ValueField)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.DisplayField)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime2")
                .HasDefaultValueSql(
                    "(sysdatetime())",
                    "DF_ParameterLovConfigs_CreatedAt")
                .IsRequired();

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime2");

            entity.HasOne(x => x.Parameter)
                .WithOne(x => x.LovConfig)
                .HasForeignKey<ParameterLovConfig>(
                    x => x.ParameterId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.DataSource)
                .WithMany(x => x.ParameterLovConfigs)
                .HasForeignKey(x => x.DataSourceId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }

    // =========================================================
    // ReportExecutions
    // =========================================================

    private static void ConfigureReportExecutions(
        ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ReportExecution>(entity =>
        {
            entity.ToTable("ReportExecutions");

            entity.HasKey(x => x.ExecutionId);

            entity.Property(x => x.ExecutionId)
                .HasColumnType("uniqueidentifier")
                .HasDefaultValueSql(
                    "(newsequentialid())",
                    "DF_ReportExecutions_ExecutionId");

            entity.Property(x => x.ParametersJson)
                .HasColumnType("nvarchar(max)");

            entity.Property(x => x.Status)
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(x => x.StartedAt)
                .HasColumnType("datetime2")
                .HasDefaultValueSql(
                    "(sysdatetime())",
                    "DF_ReportExecutions_StartedAt")
                .IsRequired();

            entity.Property(x => x.CompletedAt)
                .HasColumnType("datetime2");

            entity.Property(x => x.ErrorMessage)
                .HasColumnType("nvarchar(max)");

            entity.HasOne(x => x.Report)
                .WithMany(x => x.ReportExecutions)
                .HasForeignKey(x => x.ReportId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.User)
                .WithMany(x => x.ReportExecutions)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }

    // =========================================================
    // Printers
    // =========================================================

    private static void ConfigurePrinters(
        ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Printer>(entity =>
        {
            entity.ToTable("Printers");

            entity.HasKey(x => x.PrinterId);

            entity.Property(x => x.PrinterName)
                .HasMaxLength(500)
                .IsRequired();

            entity.Property(x => x.DisplayName)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.Description)
                .HasMaxLength(500);

            entity.Property(x => x.IsEnabled)
                .HasDefaultValue(
                    true,
                    "DF_Printers_IsEnabled")
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime2")
                .HasDefaultValueSql(
                    "(sysdatetime())",
                    "DF_Printers_CreatedAt")
                .IsRequired();

            entity.Property(x => x.UpdatedAt)
                .HasColumnType("datetime2");
        });
    }

    // =========================================================
    // AuditLogs
    // =========================================================

    private static void ConfigureAuditLogs(
        ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("AuditLogs");

            entity.HasKey(x => x.AuditLogId);

            entity.Property(x => x.Action)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.Result)
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(x => x.Details)
                .HasColumnType("nvarchar(max)");

            entity.Property(x => x.ErrorMessage)
                .HasColumnType("nvarchar(max)");

            entity.Property(x => x.CreatedAt)
                .HasColumnType("datetime2")
                .HasDefaultValueSql(
                    "(sysdatetime())",
                    "DF_AuditLogs_CreatedAt")
                .IsRequired();

            entity.HasOne(x => x.Report)
                .WithMany(x => x.AuditLogs)
                .HasForeignKey(x => x.ReportId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.Execution)
                .WithMany(x => x.AuditLogs)
                .HasForeignKey(x => x.ExecutionId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.Printer)
                .WithMany(x => x.AuditLogs)
                .HasForeignKey(x => x.PrinterId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.User)
                .WithMany(x => x.AuditLogs)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}