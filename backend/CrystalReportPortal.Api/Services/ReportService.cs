using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System.Data;
using System.Security.Cryptography;

namespace CrystalReportPortal.Api.Services;

public class ReportService : IReportService
{
    private readonly AppDbContext _dbContext;
    private readonly ICredentialProtector _credentialProtector;
    private readonly ICrystalProcessService _crystalProcessService;
    private readonly IWebHostEnvironment _environment;

    public ReportService(
        AppDbContext dbContext,
        ICredentialProtector credentialProtector,
        ICrystalProcessService crystalProcessService,
        IWebHostEnvironment environment)
    {
        _dbContext = dbContext;
        _credentialProtector = credentialProtector;
        _crystalProcessService = crystalProcessService;
        _environment = environment;
    }

    public async Task<ReportListResponse> GetReportsAsync(
        List<string> roleCodes)
    {
        if (roleCodes.Count == 0)
        {
            return new ReportListResponse();
        }

        var reports = await _dbContext.RoleReportPermissions
            .AsNoTracking()
            .Where(permission =>
    roleCodes.Contains(permission.Role.RoleCode) &&
    permission.Role.IsEnabled &&
    permission.Report.IsEnabled &&
    permission.Report.ConfigurationStatus == "Ready" &&
    permission.Report.Category.IsEnabled)
            .GroupBy(permission => new
            {
                permission.Report.ReportId,
                permission.Report.ReportCode,
                permission.Report.ReportName,
                permission.Report.Description,
                permission.Report.CreatedAt,
                permission.Report.UpdatedAt,
                permission.Report.Category.CategoryId,
                permission.Report.Category.CategoryName
            })
.Where(group => group.Any(permission => permission.CanExecute))

            .Select(group => new ReportDto
            {
                ReportId = group.Key.ReportId,
                ReportCode = group.Key.ReportCode,
                ReportName = group.Key.ReportName,
                Description = group.Key.Description,
                CreatedAt = group.Key.CreatedAt,
                UpdatedAt = group.Key.UpdatedAt,

                Category = new ReportCategoryDto
                {
                    CategoryId = group.Key.CategoryId,
                    CategoryName = group.Key.CategoryName
                },

                Permissions = new ReportPermissionDto
                {
                    CanExecute = group.Any(permission => permission.CanExecute),
                    CanExport = group.Any(permission => permission.CanExport),
                    CanPrint = group.Any(permission => permission.CanPrint),
                    CanUpload = group.Any(permission => permission.CanUpload),
                    CanMaintain = group.Any(permission => permission.CanMaintain),
                    CanSetParameters = group.Any(permission => permission.CanSetParameters),
                    CanEnableDisable = group.Any(permission => permission.CanEnableDisable)
                }
            })
            .OrderBy(
                report =>
                    report.Category.CategoryName)
            .ThenBy(
                report =>
                    report.ReportName)
            .ToListAsync();

        return new ReportListResponse
        {
            Reports = reports
        };
    }

    public async Task<bool> CanExecuteReportAsync(
        long reportId,
        List<string> roleCodes)
    {
        return await _dbContext.RoleReportPermissions
            .AsNoTracking()
            .AnyAsync(permission =>
                permission.ReportId == reportId &&
                roleCodes.Contains(
                    permission.Role.RoleCode) &&
                permission.Role.IsEnabled &&
                permission.Report.IsEnabled &&
                permission.Report.ConfigurationStatus == "Ready" &&
                permission.Report.Category.IsEnabled &&
                permission.CanExecute);
    }

    public async Task<bool> CanExportReportAsync(
    long reportId,
    List<string> roleCodes)
    {
        return await _dbContext.RoleReportPermissions
            .AsNoTracking()
            .AnyAsync(permission =>
                permission.ReportId == reportId &&
                roleCodes.Contains(
                    permission.Role.RoleCode) &&
                permission.Role.IsEnabled &&
                permission.Report.IsEnabled &&
                permission.Report.ConfigurationStatus == "Ready" &&
                permission.Report.Category.IsEnabled &&
                permission.CanExport);
    }

    public async Task<bool> CanUploadReportAsync(
    long reportId,
    List<string> roleCodes)
    {
        return await _dbContext.RoleReportPermissions
            .AsNoTracking()
            .AnyAsync(permission =>
                permission.ReportId == reportId &&
                roleCodes.Contains(
                    permission.Role.RoleCode) &&
                permission.Role.IsEnabled &&
                permission.CanUpload);
    }

    public async Task<bool> CanPrintReportAsync(
    long reportId,
    List<string> roleCodes)
    {
        return await _dbContext.RoleReportPermissions
            .AsNoTracking()
            .AnyAsync(permission =>
                permission.ReportId == reportId &&
                roleCodes.Contains(
                    permission.Role.RoleCode) &&
                permission.Role.IsEnabled &&
                permission.Report.IsEnabled &&
                permission.Report.ConfigurationStatus == "Ready" &&
                permission.Report.Category.IsEnabled &&
                permission.CanPrint);
    }

    public async Task<bool> CanMaintainReportAsync(
    long reportId,
    List<string> roleCodes)
    {
        return await _dbContext.RoleReportPermissions
            .AsNoTracking()
            .AnyAsync(permission =>
                permission.ReportId == reportId &&
                roleCodes.Contains(
                    permission.Role.RoleCode) &&
                permission.Role.IsEnabled &&
                permission.CanMaintain);
    }

    public async Task<bool> CanSetParametersReportAsync(
    long reportId,
    List<string> roleCodes)
    {
        return await _dbContext.RoleReportPermissions
            .AsNoTracking()
            .AnyAsync(permission =>
                permission.ReportId == reportId &&
                roleCodes.Contains(
                    permission.Role.RoleCode) &&
                permission.Role.IsEnabled &&
                permission.CanSetParameters);
    }

    public async Task<bool> CanEnableDisableReportAsync(
    long reportId,
    List<string> roleCodes)
    {
        return await _dbContext.RoleReportPermissions
            .AsNoTracking()
            .AnyAsync(permission =>
                permission.ReportId == reportId &&
                roleCodes.Contains(
                    permission.Role.RoleCode) &&
                permission.Role.IsEnabled &&
                permission.CanEnableDisable);
    }

    public async Task<ReportParameterResponse> GetReportParametersAsync(
    long reportId,
    List<string> roleCodes)
    {
        var canExecute =
            await CanExecuteReportAsync(
                reportId,
                roleCodes);

        if (!canExecute)
        {
            throw new UnauthorizedAccessException(
                "使用者沒有此報表的執行權限");
        }

        var parameters =
            await _dbContext.ReportParameters
                .AsNoTracking()
                .Where(parameter =>
                    parameter.ReportId == reportId &&
                    parameter.Report.IsEnabled &&
                    parameter.Report.ConfigurationStatus == "Ready" &&
                    parameter.Report.Category.IsEnabled)
                .OrderBy(parameter =>
                    parameter.DisplayOrder)
                .Select(parameter =>
                    new ReportParameterDto
                    {
                        ParameterId =
                            parameter.ParameterId,

                        Name =
                            parameter.ParameterName,

                        DisplayName =
                            parameter.DisplayName,

                        DataType =
                            parameter.DataType,

                        InputType =
                            parameter.InputType,

                        Required =
                            parameter.IsRequired,

                        Multiple =
                            parameter.AllowMultipleValues,

                        Range =
                            parameter.AllowRangeValues,

                        ValueSource =
                            parameter.ValueSourceType,

                        Visible =
                            parameter.IsVisible,

                        DisplayOrder =
                            parameter.DisplayOrder
                    })
                .ToListAsync();

        return new ReportParameterResponse
        {
            Data = parameters
        };
    }

    public async Task<ParameterOptionResponse> GetParameterOptionsAsync(
    long reportId,
    long parameterId,
    List<string> roleCodes)
    {
        var canExecute =
            await CanExecuteReportAsync(
                reportId,
                roleCodes);

        if (!canExecute)
        {
            throw new UnauthorizedAccessException(
                "使用者沒有此報表的執行權限");
        }

        return await GetParameterOptionsCoreAsync(reportId, parameterId);
    }

    public Task<ParameterOptionResponse> GetParameterOptionsForManagementAsync(
        long reportId,
        long parameterId)
    {
        return GetParameterOptionsCoreAsync(reportId, parameterId);
    }

    private async Task<ParameterOptionResponse> GetParameterOptionsCoreAsync(
        long reportId,
        long parameterId)
    {

        var parameter =
            await _dbContext.ReportParameters
                .AsNoTracking()
                .Include(p => p.LovConfig)
                    .ThenInclude(l => l!.DataSource)
                        .ThenInclude(ds => ds.Credentials)
                .FirstOrDefaultAsync(p =>
                    p.ParameterId == parameterId &&
                    p.ReportId == reportId);

        if (parameter == null)
        {
            throw new KeyNotFoundException(
                "找不到指定的報表參數");
        }

        if (!string.Equals(
                parameter.ValueSourceType,
                "SqlLov",
                StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "此參數不是 SQL LOV 參數");
        }

        var lovConfig = parameter.LovConfig;

        if (lovConfig == null)
        {
            throw new InvalidOperationException(
                "此參數尚未設定 LOV");
        }

        var dataSource = lovConfig.DataSource;

        if (dataSource == null)
        {
            throw new InvalidOperationException(
                "此參數的 LOV 未綁定資料來源。");
        }

        if (!dataSource.IsEnabled)
        {
            throw new InvalidOperationException(
                "此報表資料來源目前未啟用");
        }

        var credential =
            dataSource.Credentials
                .FirstOrDefault(c =>
                    string.Equals(
                        c.CredentialType,
                        "ReadOnly",
                        StringComparison.OrdinalIgnoreCase));

        if (credential == null)
        {
            throw new InvalidOperationException(
                "資料來源尚未設定 ReadOnly 憑證。");
        }

        var integratedSecurity =
            string.Equals(
                credential.AuthenticationType,
                "Windows",
                StringComparison.OrdinalIgnoreCase);
        var password = string.Empty;

        if (integratedSecurity)
        {
            // Crystal Service 會以相同設定建立 Windows 驗證連線。
        }
        else if (string.Equals(
                     credential.AuthenticationType,
                     "SqlServer",
                     StringComparison.OrdinalIgnoreCase))
        {
            if (string.IsNullOrWhiteSpace(credential.Username))
            {
                throw new InvalidOperationException(
                    "SQL Server Authentication 缺少資料庫帳號。");
            }

            if (string.IsNullOrWhiteSpace(
                    credential.EncryptedPassword))
            {
                throw new InvalidOperationException(
                    "SQL Server Authentication 缺少資料庫密碼。");
            }

            try
            {
                password = _credentialProtector.Unprotect(
                    credential.EncryptedPassword);
            }
            catch (CryptographicException)
            {
                throw new InvalidOperationException(
                    "資料來源憑證已失效，請至資料庫連線管理重新儲存密碼後再試。");
            }
        }
        else
        {
            throw new InvalidOperationException(
                $"不支援的資料庫驗證方式：{credential.AuthenticationType}");
        }

        var response = await _crystalProcessService.GetLovOptionsAsync(
            new CrystalLovRequest
            {
                Database = new CrystalDatabaseTestRequest
                {
                    Server = $"{dataSource.ServerHost},{dataSource.Port}",
                    Database = dataSource.DatabaseName,
                    IntegratedSecurity = integratedSecurity,
                    Username = integratedSecurity ? string.Empty : credential.Username ?? string.Empty,
                    Password = integratedSecurity ? string.Empty : password
                },
                SqlQuery = lovConfig.SqlQuery,
                ValueField = lovConfig.ValueField,
                DisplayField = lovConfig.DisplayField,
                MaxRows = 1000
            });

        return new ParameterOptionResponse
        {
            Data = response.Options.Select(option => new ParameterOptionDto
            {
                Value = option.Value,
                Label = string.Equals(option.Value, option.Label, StringComparison.Ordinal)
                    ? option.Value
                    : $"{option.Value} - {option.Label}"
            }).ToList()
        };
    }

    public async Task<RptUploadResponse> UploadRptAsync(
    long reportId,
    IFormFile file,
    long userId)
    {
        if (file == null || file.Length == 0)
        {
            throw new ArgumentException("請上傳 RPT 檔案。");
        }

        var extension = Path.GetExtension(file.FileName);

        if (!string.Equals(
            extension,
            ".rpt",
            StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException(
                "僅允許上傳 .rpt 檔案。");
        }

        var report = await _dbContext.Reports
            .Include(x => x.ReportParameters)
                .ThenInclude(x => x.LovConfig)
            .FirstOrDefaultAsync(
                x => x.ReportId == reportId);

        if (report == null)
        {
            throw new KeyNotFoundException(
                $"找不到 ReportId={reportId} 的報表。");
        }

        // =====================================
        // 1. 建立 reports 儲存目錄
        // =====================================

        var reportsRoot = Path.Combine(
            _environment.ContentRootPath,
            "reports");

        Directory.CreateDirectory(reportsRoot);

        // 使用 ReportId 避免不同報表檔名互相覆蓋
        var reportFolder = Path.Combine(
            reportsRoot,
            reportId.ToString());

        Directory.CreateDirectory(reportFolder);

        var safeFileName = Path.GetFileName(file.FileName);

        var storedFileName =
            $"{Guid.NewGuid():N}_{safeFileName}";

        var fullPath = Path.Combine(
            reportFolder,
            storedFileName);

        // =====================================
        // 2. 暫存 RPT
        // =====================================

        await using (var stream =
            new FileStream(
                fullPath,
                FileMode.Create,
                FileAccess.Write))
        {
            await file.CopyToAsync(stream);
        }

        try
        {
            // =====================================
            // 3. 呼叫 Crystal Service 解析參數
            // =====================================

            var crystalResult =
                await _crystalProcessService
                    .GetParametersAsync(fullPath);

            // =====================================
            // 4. 移除舊參數
            // =====================================

            if (report.ReportParameters.Count > 0)
            {
                _dbContext.ReportParameters
                    .RemoveRange(
                        report.ReportParameters);
            }

            // =====================================
            // 5. 建立新參數
            // =====================================

            var newParameters =
                new List<ReportParameter>();

            var responseParameters =
                new List<RptUploadParameterDto>();

            // 只允許套用系統中已啟用、且適用於本報表資料來源的常用參數。
            // RPT 參數名稱中即使帶有 SQL，也不在上傳時直接信任或建立 LOV。
            var commonTemplates =
                await _dbContext.CommonParameterTemplates
                    .AsNoTracking()
                    .Where(template =>
                        template.IsEnabled &&
                        (template.DataSourceId == null ||
                         template.DataSourceId == report.DataSourceId))
                    .ToListAsync();

            var displayOrder = 1;

            foreach (var crystalParameter
                     in crystalResult.Parameters)
            {
                var mapping =
                    MapCrystalParameter(
                        crystalParameter);

                var commonTemplate =
                    FindCommonTemplate(
                        commonTemplates,
                        crystalParameter,
                        mapping,
                        report.DataSourceId);

                var parameter =
                    new ReportParameter
                    {
                        ReportId = reportId,

                        CommonTemplateId =
                            commonTemplate?.TemplateId,

                        ParameterName =
                            crystalParameter.Name,

                        DisplayName =
                            commonTemplate?.TemplateName ??
                            mapping.DisplayName,

                        DataType =
                            commonTemplate?.DataType ??
                            mapping.DataType,

                        InputType =
                            commonTemplate?.InputType ??
                            mapping.InputType,

                        ValueSourceType =
                            commonTemplate?.ValueSourceType ??
                            mapping.ValueSourceType,

                        IsRequired =
                            commonTemplate?.IsRequired ??
                            !crystalParameter.IsOptional,

                        AllowMultipleValues =
                            commonTemplate?.AllowMultipleValues ??
                            crystalParameter.AllowMultipleValues,

                        AllowRangeValues =
                            commonTemplate?.AllowRangeValues ??
                            crystalParameter.AllowRangeValues,

                        IsVisible =
                            commonTemplate?.IsVisible ??
                            mapping.IsVisible,

                        DefaultValue =
                            commonTemplate?.DefaultValue,

                        Description =
                            commonTemplate?.Description,

                        IsConfigured =
                            commonTemplate != null,

                        DisplayOrder =
                            displayOrder++,

                        CreatedAt =
                            DateTime.UtcNow
                    };

                // ===============================
                // SQL LOV
                // ===============================

                if (commonTemplate != null &&
                    string.Equals(
                        commonTemplate.ValueSourceType,
                        "SqlLov",
                        StringComparison.OrdinalIgnoreCase))
                {
                    parameter.LovConfig =
                        new ParameterLovConfig
                        {
                            DataSourceId =
                                commonTemplate.DataSourceId!.Value,

                            SqlQuery =
                                commonTemplate.SqlQuery!,

                            ValueField =
                                commonTemplate.ValueField!,

                            DisplayField =
                                commonTemplate.DisplayField!,

                            CreatedAt =
                                DateTime.UtcNow
                        };
                }

                newParameters.Add(parameter);

                responseParameters.Add(
                    new RptUploadParameterDto
                    {
                        Name =
                            parameter.ParameterName,

                        DisplayName =
                            parameter.DisplayName,

                        DataType =
                            parameter.DataType,

                        InputType =
                            parameter.InputType,

                        ValueSource =
                            parameter.ValueSourceType,

                        Multiple =
                            parameter.AllowMultipleValues
                    });
            }

            await _dbContext.ReportParameters
                .AddRangeAsync(newParameters);

            // =====================================
            // 6. 更新 Report
            // =====================================

            var oldFilePath =
                report.RptFilePath;

            report.RptFileName =
                safeFileName;

            report.RptFilePath =
                fullPath;

            var allParametersConfigured =
                newParameters.All(parameter =>
                    parameter.IsConfigured);

            report.ConfigurationStatus = allParametersConfigured
                ? "PendingReview"
                : "PendingConfiguration";

            // 上傳新版 RPT 後必須由具備啟停權限的人員再次確認並啟用。
            report.IsEnabled = false;

            report.UpdatedBy =
                userId;

            report.UpdatedAt =
                DateTime.UtcNow;

            await _dbContext.SaveChangesAsync();

            // =====================================
            // 7. DB 成功後才刪除舊 RPT
            // =====================================

            if (!string.IsNullOrWhiteSpace(oldFilePath) &&
                !string.Equals(
                    oldFilePath,
                    fullPath,
                    StringComparison.OrdinalIgnoreCase) &&
                File.Exists(oldFilePath))
            {
                try
                {
                    File.Delete(oldFilePath);
                }
                catch
                {
                    // 第一階段不因舊檔刪除失敗
                    // 影響整個上傳流程
                }
            }

            return new RptUploadResponse
            {
                Success = true,

                Message = allParametersConfigured
                    ? "RPT 上傳並套用常用參數成功；請完成測試預覽與確認。"
                    : "RPT 上傳並解析成功；尚有未設定參數，報表已保留為草稿。",

                Data =
                    new RptUploadResultDto
                    {
                        ReportId =
                            reportId,

                        FileName =
                            safeFileName,

                        FilePath =
                            fullPath,

                        ParameterCount =
                            newParameters.Count,

                        Parameters =
                            responseParameters
                    }
            };
        }
        catch
        {
            // Crystal 解析或 DB 寫入失敗，
            // 不保留這次上傳的新檔案。
            if (File.Exists(fullPath))
            {
                try
                {
                    File.Delete(fullPath);
                }
                catch
                {
                }
            }

            throw;
        }
    }

    // ==========================================
    // Crystal Parameter Mapping
    // ==========================================

    private static CrystalParameterMapping MapCrystalParameter(
        CrystalParameterDto parameter)
    {
        var name = parameter.Name;

        // =====================================
        // UserCode@
        // =====================================

        if (string.Equals(
            name,
            "UserCode@",
            StringComparison.OrdinalIgnoreCase))
        {
            return new CrystalParameterMapping
            {
                DisplayName =
                    "執行者",

                DataType =
                    "String",

                InputType =
                    "Hidden",

                ValueSourceType =
                    "CurrentUser",

                IsVisible =
                    false
            };
        }

        // =====================================
        // SQL LOV
        // =====================================

        if (IsSqlLovParameter(name))
        {
            return new CrystalParameterMapping
            {
                DisplayName =
                    string.IsNullOrWhiteSpace(
                        parameter.PromptText)
                        ? GetParameterPrefix(name)
                        : parameter.PromptText,

                DataType =
                    MapDataType(
                        parameter.ValueType),

                InputType =
                    parameter.AllowMultipleValues
                        ? "MultiSelect"
                        : "Select",

                ValueSourceType =
                    "SqlLov",

                IsVisible =
                    true
            };
        }

        // =====================================
        // 一般 Date
        // =====================================

        if (string.Equals(
            parameter.ValueType,
            "DateField",
            StringComparison.OrdinalIgnoreCase) ||
            string.Equals(
            parameter.ValueType,
            "DateTimeField",
            StringComparison.OrdinalIgnoreCase))
        {
            return new CrystalParameterMapping
            {
                DisplayName =
                    string.IsNullOrWhiteSpace(
                        parameter.PromptText)
                        ? parameter.Name
                        : parameter.PromptText,

                DataType =
                    "Date",

                InputType =
                    "DatePicker",

                ValueSourceType =
                    "UserInput",

                IsVisible =
                    true
            };
        }

        // =====================================
        // 一般參數
        // =====================================

        return new CrystalParameterMapping
        {
            DisplayName =
                string.IsNullOrWhiteSpace(
                    parameter.PromptText)
                    ? parameter.Name
                    : parameter.PromptText,

            DataType =
                MapDataType(
                    parameter.ValueType),

            InputType =
                parameter.AllowMultipleValues
                    ? "MultiSelect"
                    : "Text",

            ValueSourceType =
                "UserInput",

            IsVisible =
                true
        };
    }

    private static string MapDataType(
        string crystalValueType)
    {
        return crystalValueType switch
        {
            "DateField" =>
                "Date",

            "DateTimeField" =>
                "DateTime",

            "NumberField" =>
                "Number",

            "CurrencyField" =>
                "Number",

            "BooleanField" =>
                "Boolean",

            _ =>
                "String"
        };
    }

    private static CommonParameterTemplate? FindCommonTemplate(
        IReadOnlyCollection<CommonParameterTemplate> templates,
        CrystalParameterDto crystalParameter,
        CrystalParameterMapping mapping,
        long? reportDataSourceId)
    {
        var normalizedName =
            NormalizeParameterName(
                crystalParameter.Name);

        var candidates = templates
            .Where(template =>
                string.Equals(
                    template.NormalizedParameterName,
                    normalizedName,
                    StringComparison.OrdinalIgnoreCase) &&
                string.Equals(
                    template.DataType,
                    mapping.DataType,
                    StringComparison.OrdinalIgnoreCase) &&
                template.AllowMultipleValues ==
                    crystalParameter.AllowMultipleValues &&
                template.AllowRangeValues ==
                    crystalParameter.AllowRangeValues &&
                IsUsableCommonTemplate(template))
            .ToList();

        // 同名模板若同時存在全域版與資料來源專用版，優先使用專用版。
        var dataSourceSpecificCandidates = candidates
            .Where(template =>
                template.DataSourceId == reportDataSourceId)
            .ToList();

        if (dataSourceSpecificCandidates.Count == 1)
        {
            return dataSourceSpecificCandidates[0];
        }

        if (dataSourceSpecificCandidates.Count > 1)
        {
            // 避免不明確的自動套用；交由管理者人工選擇。
            return null;
        }

        var globalCandidates = candidates
            .Where(template =>
                template.DataSourceId == null)
            .ToList();

        return globalCandidates.Count == 1
            ? globalCandidates[0]
            : null;
    }

    private static bool IsUsableCommonTemplate(
        CommonParameterTemplate template)
    {
        if (!string.Equals(
                template.ValueSourceType,
                "SqlLov",
                StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        // SQL LOV 只能來自完整且已核准的模板，不能從 RPT 名稱推導後直接執行。
        return template.DataSourceId.HasValue &&
               !string.IsNullOrWhiteSpace(template.SqlQuery) &&
               !string.IsNullOrWhiteSpace(template.ValueField) &&
               !string.IsNullOrWhiteSpace(template.DisplayField);
    }

    private static string NormalizeParameterName(
        string parameterName)
    {
        var name = parameterName.Trim();
        var atIndex = name.IndexOf('@');

        if (atIndex > 0)
        {
            name = name[..atIndex];
        }

        return name.Trim().ToUpperInvariant();
    }

    private static string GetParameterPrefix(
        string name)
    {
        var index =
            name.IndexOf('@');

        if (index <= 0)
        {
            return name;
        }

        return name[..index];
    }

    private static bool IsSqlLovParameter(
    string parameterName)
    {
        if (string.IsNullOrWhiteSpace(
            parameterName))
        {
            return false;
        }

        var atIndex =
            parameterName.IndexOf('@');

        if (atIndex <= 0)
        {
            return false;
        }

        var sqlPart =
            parameterName
                .Substring(atIndex + 1)
                .TrimStart();

        return sqlPart.StartsWith(
            "select ",
            StringComparison.OrdinalIgnoreCase);
    }

    // ==========================================
    // Helper Classes
    // ==========================================

    private class CrystalParameterMapping
    {
        public string DisplayName { get; set; } = string.Empty;
        public string DataType { get; set; } = string.Empty;
        public string InputType { get; set; } = string.Empty;
        public string ValueSourceType { get; set; } = string.Empty;
        public bool IsVisible { get; set; }
    }

}
