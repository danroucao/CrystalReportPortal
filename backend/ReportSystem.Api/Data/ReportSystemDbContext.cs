using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using ReportSystem.Api.Models;

namespace ReportSystem.Api.Data;

public partial class ReportSystemDbContext : DbContext
{
    public ReportSystemDbContext(DbContextOptions<ReportSystemDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AuditLog> AuditLogs { get; set; }

    public virtual DbSet<DataSourceCredential> DataSourceCredentials { get; set; }

    public virtual DbSet<ParameterLovConfig> ParameterLovConfigs { get; set; }

    public virtual DbSet<Printer> Printers { get; set; }

    public virtual DbSet<Report> Reports { get; set; }

    public virtual DbSet<ReportCategory> ReportCategories { get; set; }

    public virtual DbSet<ReportDataSource> ReportDataSources { get; set; }

    public virtual DbSet<ReportExecution> ReportExecutions { get; set; }

    public virtual DbSet<ReportParameter> ReportParameters { get; set; }

    public virtual DbSet<Role> Roles { get; set; }

    public virtual DbSet<RoleReportPermission> RoleReportPermissions { get; set; }

    public virtual DbSet<User> Users { get; set; }

    public virtual DbSet<UserRole> UserRoles { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.Property(e => e.Action).HasMaxLength(100);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysdatetime())", "DF_AuditLogs_CreatedAt");
            entity.Property(e => e.Result).HasMaxLength(30);

            entity.HasOne(d => d.Execution).WithMany(p => p.AuditLogs)
                .HasForeignKey(d => d.ExecutionId)
                .HasConstraintName("FK_AuditLogs_ReportExecutions");

            entity.HasOne(d => d.Printer).WithMany(p => p.AuditLogs)
                .HasForeignKey(d => d.PrinterId)
                .HasConstraintName("FK_AuditLogs_Printers");

            entity.HasOne(d => d.Report).WithMany(p => p.AuditLogs)
                .HasForeignKey(d => d.ReportId)
                .HasConstraintName("FK_AuditLogs_Reports");

            entity.HasOne(d => d.User).WithMany(p => p.AuditLogs)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK_AuditLogs_Users");
        });

        modelBuilder.Entity<DataSourceCredential>(entity =>
        {
            entity.HasKey(e => e.CredentialId);

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysdatetime())", "DF_DataSourceCredentials_CreatedAt");
            entity.Property(e => e.CredentialType).HasMaxLength(20);
            entity.Property(e => e.Username).HasMaxLength(255);

            entity.HasOne(d => d.DataSource).WithMany(p => p.DataSourceCredentials)
                .HasForeignKey(d => d.DataSourceId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_DataSourceCredentials_ReportDataSources");
        });

        modelBuilder.Entity<ParameterLovConfig>(entity =>
        {
            entity.HasKey(e => e.LovConfigId);

            entity.HasIndex(e => e.ParameterId, "UQ_ParameterLovConfigs_ParameterId").IsUnique();

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysdatetime())", "DF_ParameterLovConfigs_CreatedAt");
            entity.Property(e => e.DisplayField).HasMaxLength(200);
            entity.Property(e => e.ValueField).HasMaxLength(200);

            entity.HasOne(d => d.DataSource).WithMany(p => p.ParameterLovConfigs)
                .HasForeignKey(d => d.DataSourceId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ParameterLovConfigs_ReportDataSources");

            entity.HasOne(d => d.Parameter).WithOne(p => p.ParameterLovConfig)
                .HasForeignKey<ParameterLovConfig>(d => d.ParameterId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ParameterLovConfigs_ReportParameters");
        });

        modelBuilder.Entity<Printer>(entity =>
        {
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysdatetime())", "DF_Printers_CreatedAt");
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.DisplayName).HasMaxLength(200);
            entity.Property(e => e.IsEnabled).HasDefaultValue(true, "DF_Printers_IsEnabled");
            entity.Property(e => e.PrinterName).HasMaxLength(500);
        });

        modelBuilder.Entity<Report>(entity =>
        {
            entity.HasIndex(e => e.ReportCode, "UQ_Reports_ReportCode").IsUnique();

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysdatetime())", "DF_Reports_CreatedAt");
            entity.Property(e => e.CredentialType).HasMaxLength(20);
            entity.Property(e => e.Description).HasMaxLength(1000);
            entity.Property(e => e.IsEnabled).HasDefaultValue(true, "DF_Reports_IsEnabled");
            entity.Property(e => e.ReportCode).HasMaxLength(50);
            entity.Property(e => e.ReportName).HasMaxLength(200);
            entity.Property(e => e.RptFileName).HasMaxLength(255);
            entity.Property(e => e.RptFilePath).HasMaxLength(1000);

            entity.HasOne(d => d.Category).WithMany(p => p.Reports)
                .HasForeignKey(d => d.CategoryId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Reports_ReportCategories");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.ReportCreatedByNavigations)
                .HasForeignKey(d => d.CreatedBy)
                .HasConstraintName("FK_Reports_CreatedBy_Users");

            entity.HasOne(d => d.DataSource).WithMany(p => p.Reports)
                .HasForeignKey(d => d.DataSourceId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Reports_ReportDataSources");

            entity.HasOne(d => d.UpdatedByNavigation).WithMany(p => p.ReportUpdatedByNavigations)
                .HasForeignKey(d => d.UpdatedBy)
                .HasConstraintName("FK_Reports_UpdatedBy_Users");
        });

        modelBuilder.Entity<ReportCategory>(entity =>
        {
            entity.HasKey(e => e.CategoryId);

            entity.Property(e => e.CategoryName).HasMaxLength(100);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysdatetime())", "DF_ReportCategories_CreatedAt");
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.IsEnabled).HasDefaultValue(true, "DF_ReportCategories_IsEnabled");
        });

        modelBuilder.Entity<ReportDataSource>(entity =>
        {
            entity.HasKey(e => e.DataSourceId);

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysdatetime())", "DF_ReportDataSources_CreatedAt");
            entity.Property(e => e.DataSourceName).HasMaxLength(100);
            entity.Property(e => e.DatabaseName).HasMaxLength(255);
            entity.Property(e => e.IsEnabled).HasDefaultValue(true, "DF_ReportDataSources_IsEnabled");
            entity.Property(e => e.Port).HasDefaultValue(1433, "DF_ReportDataSources_Port");
            entity.Property(e => e.ServerHost).HasMaxLength(255);
        });

        modelBuilder.Entity<ReportExecution>(entity =>
        {
            entity.HasKey(e => e.ExecutionId);

            entity.Property(e => e.ExecutionId).HasDefaultValueSql("(newsequentialid())", "DF_ReportExecutions_ExecutionId");
            entity.Property(e => e.StartedAt).HasDefaultValueSql("(sysdatetime())", "DF_ReportExecutions_StartedAt");
            entity.Property(e => e.Status).HasMaxLength(30);

            entity.HasOne(d => d.Report).WithMany(p => p.ReportExecutions)
                .HasForeignKey(d => d.ReportId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ReportExecutions_Reports");

            entity.HasOne(d => d.User).WithMany(p => p.ReportExecutions)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ReportExecutions_Users");
        });

        modelBuilder.Entity<ReportParameter>(entity =>
        {
            entity.HasKey(e => e.ParameterId);

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysdatetime())", "DF_ReportParameters_CreatedAt");
            entity.Property(e => e.DataType).HasMaxLength(50);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.DisplayName).HasMaxLength(200);
            entity.Property(e => e.InputType).HasMaxLength(50);
            entity.Property(e => e.IsVisible).HasDefaultValue(true, "DF_ReportParameters_IsVisible");
            entity.Property(e => e.ParameterName).HasMaxLength(200);
            entity.Property(e => e.ValueSourceType).HasMaxLength(50);

            entity.HasOne(d => d.Report).WithMany(p => p.ReportParameters)
                .HasForeignKey(d => d.ReportId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ReportParameters_Reports");
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasIndex(e => e.RoleCode, "UQ_Roles_RoleCode").IsUnique();

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysdatetime())", "DF_Roles_CreatedAt");
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.IsEnabled).HasDefaultValue(true, "DF_Roles_IsEnabled");
            entity.Property(e => e.RoleCode).HasMaxLength(50);
            entity.Property(e => e.RoleName).HasMaxLength(100);
        });

        modelBuilder.Entity<RoleReportPermission>(entity =>
        {
            entity.HasKey(e => new { e.RoleId, e.ReportId });

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysdatetime())", "DF_RoleReportPermissions_CreatedAt");

            entity.HasOne(d => d.Report).WithMany(p => p.RoleReportPermissions)
                .HasForeignKey(d => d.ReportId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_RoleReportPermissions_Reports");

            entity.HasOne(d => d.Role).WithMany(p => p.RoleReportPermissions)
                .HasForeignKey(d => d.RoleId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_RoleReportPermissions_Roles");
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(e => e.EmployeeNo, "UQ_Users_EmployeeNo").IsUnique();

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysdatetime())", "DF_Users_CreatedAt");
            entity.Property(e => e.EmployeeNo).HasMaxLength(50);
            entity.Property(e => e.IsEnabled).HasDefaultValue(true, "DF_Users_IsEnabled");
            entity.Property(e => e.PasswordHash).HasMaxLength(255);
            entity.Property(e => e.UserName).HasMaxLength(100);
        });

        modelBuilder.Entity<UserRole>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.RoleId });

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysdatetime())", "DF_UserRoles_CreatedAt");

            entity.HasOne(d => d.Role).WithMany(p => p.UserRoles)
                .HasForeignKey(d => d.RoleId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_UserRoles_Roles");

            entity.HasOne(d => d.User).WithMany(p => p.UserRoles)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_UserRoles_Users");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
