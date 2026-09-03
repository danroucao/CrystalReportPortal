using CrystalReportPortal.Api.Data;
using CrystalReportPortal.Api.Dtos;
using CrystalReportPortal.Api.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System.Data;

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
                permission.Report.Category.IsEnabled &&
                permission.CanExecute)
            .GroupBy(permission => new
            {
                permission.Report.ReportId,
                permission.Report.ReportCode,
                permission.Report.ReportName,
                permission.Report.Description,
                permission.Report.Category.CategoryId,
                permission.Report.Category.CategoryName
            })
            .Select(group => new ReportDto
            {
                ReportId = group.Key.ReportId,
                ReportCode = group.Key.ReportCode,
                ReportName = group.Key.ReportName,
                Description = group.Key.Description,

                Category = new ReportCategoryDto
                {
                    CategoryId = group.Key.CategoryId,
                    CategoryName = group.Key.CategoryName
                },

                Permissions = new ReportPermissionDto
                {
                    CanExecute =
                        group.Any(
                            permission =>
                                permission.CanExecute),

                    CanExport =
                        group.Any(
                            permission =>
                                permission.CanExport),

                    CanPrint =
                        group.Any(
                            permission =>
                                permission.CanPrint)
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
                permission.Report.Category.IsEnabled &&
                permission.CanExecute);
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

        var connectionStringBuilder =
            new SqlConnectionStringBuilder
            {
                DataSource =
                    $"{dataSource.ServerHost},{dataSource.Port}",

                InitialCatalog =
                    dataSource.DatabaseName,

                Encrypt = true,

                TrustServerCertificate = true
            };

        if (credential == null)
        {
            // 沒有設定 ReadOnly Credential
            // → 使用 Windows Authentication
            connectionStringBuilder.IntegratedSecurity = true;
        }
        else
        {
            // 有 ReadOnly Credential
            // → 使用 SQL Server Authentication
            var password =
                _credentialProtector.Unprotect(
                    credential.EncryptedPassword);

            connectionStringBuilder.UserID =
                credential.Username;

            connectionStringBuilder.Password =
                password;

            connectionStringBuilder.IntegratedSecurity =
                false;
        }

        var result =
            new List<ParameterOptionDto>();

        await using var connection =
            new SqlConnection(
                connectionStringBuilder.ConnectionString);

        await connection.OpenAsync();

        await using var command =
            new SqlCommand(
                lovConfig.SqlQuery,
                connection);

        command.CommandType =
            CommandType.Text;

        command.CommandTimeout = 30;

        await using var reader =
            await command.ExecuteReaderAsync();

        var valueOrdinal =
            reader.GetOrdinal(
                lovConfig.ValueField);

        var displayOrdinal =
            reader.GetOrdinal(
                lovConfig.DisplayField);

        while (await reader.ReadAsync())
        {
            var value =
                reader.IsDBNull(valueOrdinal)
                    ? string.Empty
                    : Convert.ToString(
                        reader.GetValue(valueOrdinal))
                      ?? string.Empty;

            var display =
                reader.IsDBNull(displayOrdinal)
                    ? string.Empty
                    : Convert.ToString(
                        reader.GetValue(displayOrdinal))
                      ?? string.Empty;

            result.Add(
                new ParameterOptionDto
                {
                    Value = value,

                    Label =
                        string.Equals(
                            value,
                            display,
                            StringComparison.Ordinal)
                        ? value
                        : $"{value} - {display}"
                });
        }

        return new ParameterOptionResponse
        {
            Data = result
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

            var displayOrder = 1;

            foreach (var crystalParameter
                     in crystalResult.Parameters)
            {
                var mapping =
                    MapCrystalParameter(
                        crystalParameter);

                var parameter =
                    new ReportParameter
                    {
                        ReportId = reportId,

                        ParameterName =
                            crystalParameter.Name,

                        DisplayName =
                            mapping.DisplayName,

                        DataType =
                            mapping.DataType,

                        InputType =
                            mapping.InputType,

                        ValueSourceType =
                            mapping.ValueSourceType,

                        IsRequired =
                            !crystalParameter.IsOptional,

                        AllowMultipleValues =
                            crystalParameter.AllowMultipleValues,

                        AllowRangeValues =
                            crystalParameter.AllowRangeValues,

                        IsVisible =
                            mapping.IsVisible,

                        DisplayOrder =
                            displayOrder++,

                        CreatedAt =
                            DateTime.Now
                    };

                // ===============================
                // SQL LOV
                // ===============================

                if (mapping.ValueSourceType == "SqlLov")
                {
                    var lov =
                        ParseSqlLov(
                            crystalParameter.Name);

                    parameter.LovConfig =
                        new ParameterLovConfig
                        {
                            DataSourceId =
                                report.DataSourceId,

                            SqlQuery =
                                lov.SqlQuery,

                            ValueField =
                                lov.ValueField,

                            DisplayField =
                                lov.DisplayField,

                            CreatedAt =
                                DateTime.Now
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

            report.UpdatedBy =
                userId;

            report.UpdatedAt =
                DateTime.Now;

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

                Message =
                    "RPT 上傳並解析成功。",

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

        if (name.Contains('@'))
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

    // ==========================================
    // SQL LOV Parsing
    // ==========================================

    private static SqlLovParseResult ParseSqlLov(
        string parameterName)
    {
        var atIndex = parameterName.IndexOf('@');

        if (atIndex < 0 ||
            atIndex >= parameterName.Length - 1)
        {
            throw new InvalidOperationException(
                $"SQL LOV Parameter 格式錯誤：{parameterName}");
        }

        var sql = parameterName[(atIndex + 1)..].Trim();

        if (!sql.StartsWith(
                "select ",
                StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"目前僅支援 SELECT 型 SQL LOV：{parameterName}");
        }

        var fromIndex = sql.IndexOf(
            " from ",
            StringComparison.OrdinalIgnoreCase);

        if (fromIndex < 0)
        {
            throw new InvalidOperationException(
                $"SQL LOV 缺少 FROM：{parameterName}");
        }

        var selectPart =
            sql["select ".Length..fromIndex].Trim();

        if (selectPart.StartsWith(
                "distinct ",
                StringComparison.OrdinalIgnoreCase))
        {
            selectPart =
                selectPart["distinct ".Length..].Trim();
        }

        var columns = selectPart
            .Split(',')
            .Select(x => x.Trim())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .ToArray();

        if (columns.Length < 2)
        {
            throw new InvalidOperationException(
                $"SQL LOV 至少需要兩個欄位：{parameterName}");
        }

        return new SqlLovParseResult
        {
            SqlQuery = sql,
            ValueField = columns[0],
            DisplayField = columns[1]
        };
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

    private class SqlLovParseResult
    {
        public string SqlQuery { get; set; } = string.Empty;
        public string ValueField { get; set; } = string.Empty;
        public string DisplayField { get; set; } = string.Empty;
    }

}