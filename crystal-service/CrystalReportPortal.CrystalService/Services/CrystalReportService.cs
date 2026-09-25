using CrystalDecisions.CrystalReports.Engine;
using CrystalDecisions.Shared;
using CrystalReportPortal.CrystalService.Models;
using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

namespace CrystalReportPortal.CrystalService.Services
{
    public class CrystalReportService
    {
        private static readonly bool DiagnosticsEnabled =
            string.Equals(
                Environment.GetEnvironmentVariable(
                    "CRYSTAL_SERVICE_DIAGNOSTICS"),
                "true",
                StringComparison.OrdinalIgnoreCase);

        public List<string> GetHeaderTexts(string rptPath)
        {
            using (var report = new ReportDocument())
            {
                report.Load(rptPath);
                var textCandidates = report.ReportDefinition.Sections
                    .Cast<Section>()
                    .SelectMany(section => section.ReportObjects.Cast<ReportObject>())
                    .Select(GetDisplayText)
                    .Where(text => !string.IsNullOrWhiteSpace(text))
                    .Select(text => text.Trim())
                    .ToList();
                var titleFormulaCandidates = report.DataDefinition.FormulaFields
                    .Cast<FormulaFieldDefinition>()
                    .Where(formula => formula.Name.StartsWith("Title", StringComparison.OrdinalIgnoreCase))
                    .Select(formula => formula.Name);
                return textCandidates.Concat(titleFormulaCandidates)
                    .Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            }
        }

        public List<object> GetReportObjectSummary(string rptPath)
        {
            using (var report = new ReportDocument())
            {
                report.Load(rptPath);
                return report.ReportDefinition.Sections
                    .Cast<Section>()
                    .SelectMany(section => section.ReportObjects.Cast<ReportObject>()
                        .Select(reportObject => (object)new
                        {
                            Section = section.Name,
                            Kind = reportObject.Kind.ToString(),
                            Name = reportObject.Name,
                            DataSource = reportObject.Kind == ReportObjectKind.FieldObject
                                ? GetPropertyValue(reportObject, "DataSource") : null,
                            Text = GetDisplayText(reportObject)
                        }))
                    .ToList();
            }
        }

        private static string GetPropertyValue(object value, string propertyName)
        {
            var property = value.GetType().GetProperty(propertyName);
            var propertyValue = property == null ? null : property.GetValue(value, null);
            return propertyValue == null ? null : propertyValue.ToString();
        }

        public CrystalDatabaseTestResponse TestDatabaseConnection(CrystalDatabaseConfig database)
        {
            var stopwatch = Stopwatch.StartNew();

            try
            {
                ValidateDatabaseConfig(database);

                var builder =
                    CreateConnectionStringBuilder(database);

                using (var connection = new SqlConnection(builder.ConnectionString))
                {
                    connection.Open();

                    const string sql = @"
                    SELECT
                        CAST(SYSTEM_USER AS NVARCHAR(128)) AS LoginName,
                        DB_NAME() AS DatabaseName;";

                    using (var command = new SqlCommand(sql, connection))
                    {
                        command.CommandTimeout = 15;

                        using (var reader =
                               command.ExecuteReader())
                        {
                            if (!reader.Read())
                            {
                                throw new InvalidOperationException(
                                    "測試查詢沒有回傳結果。");
                            }

                            stopwatch.Stop();

                            return new CrystalDatabaseTestResponse
                            {
                                Success = true,
                                Connected = true,
                                Server = database.Server,
                                Database =
                                    reader["DatabaseName"]
                                        .ToString(),
                                LoginName =
                                    reader["LoginName"]
                                        .ToString(),
                                // 通用連線測試不依賴任何特定資料表。
                                DetailCount = 0,
                                ElapsedMilliseconds =
                                    stopwatch.ElapsedMilliseconds,
                                Message =
                                    "Database connection successful."
                            };
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                stopwatch.Stop();

                return new CrystalDatabaseTestResponse
                {
                    Success = false,
                    Connected = false,
                    Server = database?.Server,
                    Database = database?.Database,
                    LoginName = null,
                    DetailCount = 0,
                    ElapsedMilliseconds =
                        stopwatch.ElapsedMilliseconds,
                    Message = ex.Message
                };
            }
        }

        public CrystalLovResponse GetLovOptions(CrystalLovRequest request)
        {
            var stopwatch = Stopwatch.StartNew();

            try
            {
                if (request == null)
                {
                    throw new ArgumentNullException(
                        nameof(request));
                }

                ValidateDatabaseConfig(
                    request.Database);

                ValidateLovQuery(
                    request.SqlQuery);

                if (string.IsNullOrWhiteSpace(
                        request.ValueField))
                {
                    throw new ArgumentException(
                        "ValueField 不可為空白。");
                }

                if (string.IsNullOrWhiteSpace(
                        request.DisplayField))
                {
                    throw new ArgumentException(
                        "DisplayField 不可為空白。");
                }

                var maxRows =
                    request.MaxRows <= 0
                        ? 1000
                        : Math.Min(request.MaxRows, 5000);

                var builder =
                    CreateConnectionStringBuilder(
                        request.Database);

                var options =
                    new List<CrystalLovOption>();

                using (var connection =
                       new SqlConnection(
                           builder.ConnectionString))
                {
                    connection.Open();

                    using (var command =
                           new SqlCommand(
                               request.SqlQuery,
                               connection))
                    {
                        command.CommandTimeout = 15;

                        using (var reader =
                               command.ExecuteReader())
                        {
                            var valueOrdinal =
                                reader.GetOrdinal(
                                    request.ValueField);

                            var displayOrdinal =
                                reader.GetOrdinal(
                                    request.DisplayField);

                            while (reader.Read() &&
                                   options.Count < maxRows)
                            {
                                var value =
                                    reader.IsDBNull(valueOrdinal)
                                        ? string.Empty
                                        : Convert.ToString(
                                            reader.GetValue(
                                                valueOrdinal));

                                var label =
                                    reader.IsDBNull(displayOrdinal)
                                        ? string.Empty
                                        : Convert.ToString(
                                            reader.GetValue(
                                                displayOrdinal));

                                options.Add(
                                    new CrystalLovOption
                                    {
                                        Value = value,
                                        Label = label
                                    });
                            }
                        }
                    }
                }

                stopwatch.Stop();

                return new CrystalLovResponse
                {
                    Success = true,
                    Message =
                        "LOV options loaded successfully.",
                    Count = options.Count,
                    ElapsedMilliseconds =
                        stopwatch.ElapsedMilliseconds,
                    Options = options
                };
            }
            catch (Exception ex)
            {
                stopwatch.Stop();

                return new CrystalLovResponse
                {
                    Success = false,
                    Message = ex.Message,
                    Count = 0,
                    ElapsedMilliseconds =
                        stopwatch.ElapsedMilliseconds,
                    Options =
                        new List<CrystalLovOption>()
                };
            }
        }

        public List<ReportParameterInfo> GetParameters(
            string rptPath)
        {
            if (string.IsNullOrWhiteSpace(rptPath))
            {
                throw new ArgumentException(
                    "RPT 路徑不可為空。",
                    nameof(rptPath));
            }

            if (!File.Exists(rptPath))
            {
                throw new FileNotFoundException(
                    "找不到指定的 RPT 報表檔案。",
                    rptPath);
            }

            var result =
                new List<ReportParameterInfo>();

            using (var report = new ReportDocument())
            {
                report.Load(rptPath);

                foreach (
                    ParameterFieldDefinition parameter
                    in report.DataDefinition.ParameterFields)
                {
                    var info =
                        new ReportParameterInfo
                        {
                            Name =
                                parameter.Name,

                            PromptText =
                                parameter.PromptText,

                            ValueType =
                                parameter.ValueType.ToString(),

                            AllowMultipleValues =
                                parameter
                                    .EnableAllowMultipleValue,

                            IsOptional =
                                parameter.EnableNullValue
                        };

                    result.Add(info);
                }
            }

            return result;
        }

        public CrystalExportResponse ExportReport(
            CrystalExportRequest request)
        {
            try
            {
                ValidateExportRequest(request);

                var outputDirectory =
                    Path.GetDirectoryName(request.OutputPath);

                if (!string.IsNullOrWhiteSpace(outputDirectory))
                {
                    Directory.CreateDirectory(outputDirectory);
                }

                using (var report = new ReportDocument())
                {
                    report.Load(request.RptPath);

                    ApplyHeaderTextReplacements(
                        report,
                        request.HeaderTextReplacements);

                    Console.Error.WriteLine(
                        $"UseSavedDataOnly: {request.UseSavedDataOnly}");

                    Console.Error.WriteLine(
                        $"HasSavedData: {report.HasSavedData}");

                    if (DiagnosticsEnabled)
                    {
                        DumpRasTables(
                            report,
                            "REPORT DATA SOURCES");
                    }

                    if (request.UseSavedDataOnly)
                    {
                        if (!report.HasSavedData)
                        {
                            throw new InvalidOperationException(
                                "此 RPT 沒有保存資料，無法在不連接資料庫的情況下產生 PDF。");
                        }

                        Console.Error.WriteLine(
                            "Exporting PDF from RPT Saved Data.");
                    }
                    else
                    {
                        if (request.Database == null)
                        {
                            throw new InvalidOperationException(
                                "即時報表匯出缺少資料庫設定。");
                        }

                        SetParameters(
                            report,
                            request.Parameters);

                        ApplyRasCommandConnection(
                            report,
                            request.Database,
                            request.Parameters);

                        foreach (ReportDocument subreport in report.Subreports)
                        {
                            ApplyRasCommandConnection(
                                subreport,
                                request.Database,
                                request.Parameters);
                        }

                        ApplyConnectionToTables(
                            report.Database.Tables,
                            request.Database);

                        foreach (ReportDocument subreport in report.Subreports)
                        {
                            ApplyConnectionToTables(
                                subreport.Database.Tables,
                                request.Database);
                        }

                        if (DiagnosticsEnabled)
                        {
                            DumpRasTables(
                                report,
                                "AFTER DATABASE CONNECTION");
                        }

                    }

                    try
                    {
                        report.ExportToDisk(
                            ExportFormatType.PortableDocFormat,
                            request.OutputPath);
                    }
                    catch (Exception primaryExportException)
                    {
                        if (request.UseSavedDataOnly ||
                            request.Database == null)
                        {
                            throw;
                        }

                        Console.Error.WriteLine(
                            "Crystal native export failed; trying ADO.NET data-source fallback: " +
                            primaryExportException.Message);

                        try
                        {
                            ExportWithAdoNetDataSource(request);
                        }
                        catch (Exception fallbackException)
                        {
                            throw new InvalidOperationException(
                                "ADO.NET RPT schema fallback failed: " +
                                fallbackException.Message,
                                fallbackException);
                        }
                    }

                    return new CrystalExportResponse
                    {
                        Success = true,
                        Message = request.UseSavedDataOnly
                            ? "Saved Data PDF export success."
                            : "Live PDF export success.",
                        OutputPath = request.OutputPath
                    };
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine(
                    "Crystal report export failed: " +
                    ex);

                return new CrystalExportResponse
                {
                    Success = false,
                    Message = "報表匯出失敗。請查看服務端錯誤紀錄。",
                    OutputPath = null
                };
            }
        }

        public CrystalExportResponse CreateLocalizedTemplate(CrystalExportRequest request)
        {
            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.RptPath) ||
                    string.IsNullOrWhiteSpace(request.OutputPath))
                    throw new ArgumentException("RPT source and output paths are required.");

                using (var report = new ReportDocument())
                {
                    report.Load(request.RptPath);
                    ApplyTemplateHeadingReplacements(report, request.HeaderTextReplacements);
                    report.SaveAs(request.OutputPath);
                }
                return new CrystalExportResponse { Success = true, OutputPath = request.OutputPath };
            }
            catch (Exception ex)
            {
                return new CrystalExportResponse { Success = false, Message = ex.ToString() };
            }
        }

        private static void ApplyHeaderTextReplacements(
            ReportDocument report,
            IDictionary<string, string> replacements)
        {
            if (replacements == null || replacements.Count == 0)
            {
                return;
            }

            foreach (Section section in report.ReportDefinition.Sections)
            {
                foreach (ReportObject reportObject in section.ReportObjects)
                {
                    var sourceText = (GetDisplayText(reportObject) ?? string.Empty).Trim();
                    if (replacements.TryGetValue(sourceText, out var displayName) &&
                        !string.IsNullOrWhiteSpace(displayName))
                    {
                        SetDisplayText(reportObject, displayName.Trim());
                    }
                }
            }

            foreach (FormulaFieldDefinition formula in report.DataDefinition.FormulaFields)
            {
                if (replacements.TryGetValue(formula.Name, out var displayName) &&
                    !string.IsNullOrWhiteSpace(displayName))
                {
                    formula.Text = "\"" + displayName.Trim().Replace("\"", "\"\"") + "\"";
                }
            }
        }

        private static string GetDisplayText(ReportObject reportObject)
        {
            if (reportObject.Kind == ReportObjectKind.TextObject)
                return ((TextObject)reportObject).Text;
            if (reportObject.Kind == ReportObjectKind.FieldHeadingObject)
                return ((FieldHeadingObject)reportObject).Text;
            return null;
        }

        private static void SetDisplayText(ReportObject reportObject, string text)
        {
            if (reportObject.Kind == ReportObjectKind.TextObject)
                ((TextObject)reportObject).Text = text;
        }

        private static void ApplyTemplateHeadingReplacements(
            ReportDocument report,
            IDictionary<string, string> replacements)
        {
            ApplyHeaderTextReplacements(report, replacements);
            foreach (Section section in report.ReportDefinition.Sections)
            {
                foreach (ReportObject reportObject in section.ReportObjects)
                {
                    if (reportObject.Kind != ReportObjectKind.FieldHeadingObject)
                        continue;

                    var heading = (FieldHeadingObject)reportObject;
                    var sourceText = (heading.Text ?? string.Empty).Trim();
                    if (replacements.TryGetValue(sourceText, out var displayName) &&
                        !string.IsNullOrWhiteSpace(displayName))
                    {
                        heading.Text = displayName.Trim();
                    }
                }
            }
        }

        private void ExportWithAdoNetDataSource(
            CrystalExportRequest request)
        {
            using (var report = new ReportDocument())
            {
                report.Load(request.RptPath);
                ApplyHeaderTextReplacements(report, request.HeaderTextReplacements);
                SetParameters(report, request.Parameters);

                var mainCommand = GetSingleCommandTable(report);
                var mainData = ExecuteCommand(
                    mainCommand.CommandText,
                    request.Database,
                    request.Parameters);

                SetTableDataSource(report, mainCommand, mainData);

                foreach (ReportDocument subreport in report.Subreports)
                {
                    var subreportCommand = GetSingleCommandTable(subreport);
                    var subreportData = ExecuteCommand(
                        subreportCommand.CommandText,
                        request.Database,
                        request.Parameters);

                    SetTableDataSource(subreport, subreportCommand, subreportData);
                }

                report.ExportToDisk(
                    ExportFormatType.PortableDocFormat,
                    request.OutputPath);
            }
        }

        private CrystalDecisions.ReportAppServer.DataDefModel.CommandTable
            GetSingleCommandTable(ReportDocument report)
        {
            CrystalDecisions.ReportAppServer.DataDefModel.CommandTable result = null;
            var tables = report.ReportClientDocument.DatabaseController.Database.Tables;

            for (int index = 0; index < tables.Count; index++)
            {
                var command = tables[index]
                    as CrystalDecisions.ReportAppServer.DataDefModel.CommandTable;

                if (command == null)
                {
                    continue;
                }

                if (result != null)
                {
                    throw new NotSupportedException(
                        "此 RPT 包含多個 Command Table，暫不支援自動資料來源轉換。");
                }

                result = command;
            }

            if (result == null || string.IsNullOrWhiteSpace(result.CommandText))
            {
                throw new NotSupportedException(
                    "此 RPT 找不到可執行的 Command Table。");
            }

            return result;
        }

        private DataTable ExecuteCommand(
            string commandText,
            CrystalDatabaseConfig database,
            List<CrystalExportParameter> parameters)
        {
            var sqlParameters = new List<SqlParameter>();
            var sql = BuildParameterizedCommand(
                commandText,
                parameters,
                sqlParameters);
            var table = new DataTable();

            if (DiagnosticsEnabled)
            {
                Console.Error.WriteLine("ADO.NET fallback SQL:");
                Console.Error.WriteLine(sql);
            }

            using (var connection = new SqlConnection(
                CreateConnectionStringBuilder(database).ConnectionString))
            using (var command = new SqlCommand(sql, connection))
            {
                command.Parameters.AddRange(sqlParameters.ToArray());
                command.CommandTimeout = 120;
                connection.Open();

                using (var reader = command.ExecuteReader())
                {
                    table.Load(reader);
                }
            }

            return table;
        }

        private static string BuildParameterizedCommand(
            string commandText,
            List<CrystalExportParameter> parameters,
            List<SqlParameter> sqlParameters)
        {
            var result = commandText;
            var parameterIndex = 0;

            foreach (var parameter in parameters ?? new List<CrystalExportParameter>())
            {
                if (parameter == null || parameter.Values == null || parameter.Values.Count == 0)
                {
                    continue;
                }

                var placeholders = new List<string>();
                foreach (var value in parameter.Values)
                {
                    var parameterName = "@crystalParam" + parameterIndex++;
                    placeholders.Add(parameterName);
                    sqlParameters.Add(new SqlParameter(
                        parameterName,
                        ToSqlParameterValue(value, parameter.DataType)));
                }

                var name = parameter.Name ?? string.Empty;
                var atIndex = name.IndexOf('@');
                var shortName = atIndex > 0
                    ? name.Substring(0, atIndex + 1)
                    : name;
                var replacement = "(" + string.Join(",", placeholders) + ")";

                result = ReplaceCommandToken(result, "{?" + name + "}", replacement);
                result = ReplaceCommandToken(result, "{?" + shortName + "}", replacement);
            }

            return result;
        }

        private static object ToSqlParameterValue(
            string value,
            string dataType)
        {
            if (dataType.IndexOf("Date", StringComparison.OrdinalIgnoreCase) >= 0 &&
                DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            {
                return date;
            }

            if ((string.Equals(dataType, "Number", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(dataType, "NumberField", StringComparison.OrdinalIgnoreCase)) &&
                decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var number))
            {
                return number;
            }

            if (string.Equals(dataType, "Boolean", StringComparison.OrdinalIgnoreCase))
            {
                return bool.TryParse(value, out var boolean) && boolean;
            }

            return value ?? string.Empty;
        }

        private void SetTableDataSource(
            ReportDocument report,
            CrystalDecisions.ReportAppServer.DataDefModel.CommandTable commandTable,
            DataTable data)
        {
            if (report.Database.Tables.Count == 0)
            {
                throw new InvalidOperationException(
                    "RPT 沒有可套用查詢結果的資料表。");
            }

            var reportTable = report.Database.Tables[0];
            var mappedData = MapDataTableToReportSchema(
                reportTable,
                data,
                commandTable.Name);

            reportTable.SetDataSource(mappedData);
        }

        private DataTable MapDataTableToReportSchema(
            Table reportTable,
            DataTable source,
            string tableName)
        {
            var mapped = new DataTable(tableName);
            var sourceColumns = source.Columns
                .Cast<DataColumn>()
                .ToDictionary(
                    column => NormalizeSchemaName(column.ColumnName),
                    StringComparer.OrdinalIgnoreCase);

            foreach (FieldDefinition field in reportTable.Fields)
            {
                DataColumn sourceColumn;
                if (!sourceColumns.TryGetValue(
                        NormalizeSchemaName(field.Name),
                        out sourceColumn))
                {
                    throw new InvalidOperationException(
                        $"SQL 查詢結果缺少 RPT 欄位：{field.Name}");
                }

                mapped.Columns.Add(
                    field.Name,
                    Nullable.GetUnderlyingType(sourceColumn.DataType) ?? sourceColumn.DataType);
            }

            foreach (DataRow sourceRow in source.Rows)
            {
                var mappedRow = mapped.NewRow();
                foreach (DataColumn mappedColumn in mapped.Columns)
                {
                    mappedRow[mappedColumn.ColumnName] =
                        sourceRow[sourceColumns[
                            NormalizeSchemaName(mappedColumn.ColumnName)]];
                }

                mapped.Rows.Add(mappedRow);
            }

            return mapped;
        }

        private static string NormalizeSchemaName(string name)
        {
            var normalized = (name ?? string.Empty).Trim();
            var dotIndex = normalized.LastIndexOf('.');

            if (dotIndex >= 0)
            {
                normalized = normalized.Substring(dotIndex + 1);
            }

            return normalized
                .Trim('[', ']', ' ', '`', '"')
                .ToUpperInvariant();
        }

        public List<CrystalDataSourceInfo>
            GetDataSources(
                string rptPath)
        {
            if (string.IsNullOrWhiteSpace(rptPath))
            {
                throw new ArgumentException(
                    "RptPath 不可為空白。");
            }

            if (!File.Exists(rptPath))
            {
                throw new FileNotFoundException(
                    "找不到 RPT 檔案。",
                    rptPath);
            }

            var result =
                new List<CrystalDataSourceInfo>();

            using (var report = new ReportDocument())
            {
                report.Load(rptPath);

                ReadTables(
                    report.Database.Tables,
                    "MainReport",
                    result);

                foreach (
                    ReportDocument subreport
                    in report.Subreports)
                {
                    ReadTables(
                        subreport.Database.Tables,
                        "SubReport:"
                        + subreport.Name,
                        result);
                }
            }

            return result;
        }

        // =====================================================
        // 新版：
        // 使用 ReportClientDocument / DatabaseController
        // ReplaceConnection()
        //
        // 用來處理：
        //
        // SQLNCLI11 / 192.168.50.35
        //
        //             ↓
        //
        // MSOLEDBSQL / localhost,1433
        //
        // =====================================================

        private void ReplaceDatabaseConnection(
            ReportDocument report,
            CrystalDatabaseConfig database)
        {
            if (report == null)
            {
                throw new ArgumentNullException(nameof(report));
            }

            if (database == null)
            {
                throw new ArgumentNullException(nameof(database));
            }

            if (string.IsNullOrWhiteSpace(database.Server))
            {
                throw new ArgumentException(
                    "Database.Server 不可為空白。");
            }

            if (string.IsNullOrWhiteSpace(database.Database))
            {
                throw new ArgumentException(
                    "Database.Database 不可為空白。");
            }

            if (!database.IntegratedSecurity)
            {
                if (string.IsNullOrWhiteSpace(database.Username))
                {
                    throw new ArgumentException(
                        "SQL Server Authentication 模式下 Username 不可為空白。");
                }

                if (string.IsNullOrWhiteSpace(database.Password))
                {
                    throw new ArgumentException(
                        "SQL Server Authentication 模式下 Password 不可為空白。");
                }
            }

            var rcd =
                report.ReportClientDocument;

            var databaseController =
                rcd.DatabaseController;

            // =====================================================
            // 1. 取得 RPT 原本的 ConnectionInfo
            // =====================================================

            var oldConnections =
                databaseController
                    .GetConnectionInfos(null);

            if (oldConnections == null ||
                oldConnections.Count == 0)
            {
                throw new InvalidOperationException(
                    "Crystal Report 找不到任何資料庫連線資訊。");
            }

            // =====================================================
            // 2. 逐一替換 Connection
            //
            // 不再從零建立 PropertyBag。
            // 直接 Clone RPT 原本的 Attributes，
            // 保留 Crystal 自己產生的 datasource metadata。
            // =====================================================

            for (int i = 0;
                 i < oldConnections.Count;
                 i++)
            {
                var oldConnection =
                    oldConnections[i];

                if (oldConnection.Attributes == null)
                {
                    throw new InvalidOperationException(
                        $"第 {i + 1} 個 Crystal Connection 沒有 Attributes。");
                }

                // Deep clone 原本的 QE Attributes
                var qeDetails =
                    oldConnection.Attributes.Clone(true);

                if (qeDetails == null)
                {
                    throw new InvalidOperationException(
                        $"第 {i + 1} 個 Crystal Connection Attributes Clone 失敗。");
                }

                // =================================================
                // 3. 取得原本 QE_LogonProperties
                // =================================================

                if (!qeDetails.Contains(
                        "QE_LogonProperties"))
                {
                    throw new InvalidOperationException(
                        $"第 {i + 1} 個 Crystal Connection 找不到 QE_LogonProperties。");
                }

                var logonProperties =
                    qeDetails["QE_LogonProperties"]
                    as CrystalDecisions.ReportAppServer
                        .DataDefModel.PropertyBag;

                if (logonProperties == null)
                {
                    throw new InvalidOperationException(
                        $"第 {i + 1} 個 Crystal Connection 的 QE_LogonProperties 格式錯誤。");
                }

                // =================================================
                // 4. 只覆寫必要的 Database 資訊
                // =================================================

                qeDetails["QE_DatabaseName"] =
                    database.Database;

                qeDetails["QE_ServerDescription"] =
                    database.Server;

                // 注意：
                // 不再自己設定 QE_SQLDB。
                //
                // 原始 RPT 為 True，
                // Clone 後直接保留原始值。
                //
                // 不再自行設定：
                // Database DLL
                // QE_DatabaseType
                // SSO Enabled
                // Owner
                // 等 Crystal metadata。

                // =================================================
                // 5. 修改 OLE DB Provider / Server / Database
                // =================================================

                logonProperties["Data Source"] =
                    database.Server;

                logonProperties["Initial Catalog"] =
                    database.Database;

                logonProperties["Trust Server Certificate"] =
                    "1";

                // =================================================
                // 6. Authentication
                // =================================================

                if (database.IntegratedSecurity)
                {
                    // RAS 會同時檢查外層 SSO 旗標與
                    // QE_LogonProperties。若只清空帳密並設定 SSPI，
                    // 但沿用 RPT 原本的 SSO=false，匯出時會得到
                    //「無法連接：登入參數錯誤」。
                    SetRasSsoEnabled(
                        qeDetails,
                        true);

                    logonProperties["Integrated Security"] =
                        "SSPI";

                    // 若原本 RPT 曾存 SQL Login 屬性，
                    // Windows Authentication 時移除。
                    if (logonProperties.Contains("User ID"))
                    {
                        logonProperties.Remove("User ID");
                    }

                    if (logonProperties.Contains("Password"))
                    {
                        logonProperties.Remove("Password");
                    }
                }
                else
                {
                    SetRasSsoEnabled(
                        qeDetails,
                        false);

                    logonProperties["Integrated Security"] =
                        false;

                    if (logonProperties.Contains("User ID"))
                    {
                        logonProperties["User ID"] =
                            database.Username;
                    }
                    else
                    {
                        logonProperties.Add(
                            "User ID",
                            database.Username);
                    }

                    if (logonProperties.Contains("Password"))
                    {
                        logonProperties["Password"] =
                            database.Password;
                    }
                    else
                    {
                        logonProperties.Add(
                            "Password",
                            database.Password);
                    }
                }

                // 確保修改後的 LogonProperties
                // 放回 QE Attributes。
                qeDetails["QE_LogonProperties"] =
                    logonProperties;

                // =================================================
                // 7. 建立新的 RAS ConnectionInfo
                // =================================================

                var newConnection =
                    new CrystalDecisions.ReportAppServer
                        .DataDefModel.ConnectionInfo();

                newConnection.Attributes =
                    qeDetails;

                // 保留原始 Connection Kind
                newConnection.Kind =
                    oldConnection.Kind;

                if (database.IntegratedSecurity)
                {
                    newConnection.UserName =
                        string.Empty;

                    newConnection.Password =
                        string.Empty;
                }
                else
                {
                    newConnection.UserName =
                        database.Username;

                    newConnection.Password =
                        database.Password;
                }

                // =================================================
                // 8. Replace Connection
                // =================================================

                databaseController.ReplaceConnection(
                    oldConnection,
                    newConnection,
                    null,
                    CrystalDecisions.ReportAppServer
                        .DataDefModel
                        .CrDBOptionsEnum
                        .crDBOptionDoNotVerifyDB);
            }

            // =====================================================
            // 9. SQL Authentication 額外執行 Runtime Logon
            //
            // Windows Authentication 不使用 LogonEx，
            // 由 MSOLEDBSQL + Integrated Security=SSPI
            // 使用目前 Crystal Service Process 的 Windows 身分。
            // =====================================================

            if (!database.IntegratedSecurity)
            {
                databaseController.LogonEx(
                    database.Server,
                    database.Database,
                    database.Username,
                    database.Password);
            }
        }

        // =====================================================
        // 舊版 Connection 方法
        //
        // 目前 ExportReport() 已經不再呼叫。
        //
        // 先保留方便診斷及回退。
        // =====================================================

        private void ApplyDatabaseConnection(
            ReportDocument report,
            CrystalDatabaseConfig database)
        {
            if (database == null)
            {
                throw new ArgumentNullException(
                    nameof(database));
            }

            ApplyConnectionToTables(
                report.Database.Tables,
                database);

            foreach (
                ReportDocument subreport
                in report.Subreports)
            {
                ApplyConnectionToTables(
                    subreport.Database.Tables,
                    database);
            }
        }

        private void ApplyConnectionToTables(
            Tables tables,
            CrystalDatabaseConfig database)
        {
            foreach (Table table in tables)
            {
                var logonInfo =
                    table.LogOnInfo;

                var connectionInfo =
                    logonInfo.ConnectionInfo;

                connectionInfo.ServerName =
                    database.Server;

                connectionInfo.DatabaseName =
                    database.Database;

                if (database.IntegratedSecurity)
                {
                    connectionInfo.IntegratedSecurity =
                        true;

                    connectionInfo.UserID =
                        string.Empty;

                    connectionInfo.Password =
                        string.Empty;
                }
                else
                {
                    connectionInfo.IntegratedSecurity =
                        false;

                    connectionInfo.UserID =
                        database.Username;

                    connectionInfo.Password =
                        database.Password;
                }

                UpdateOleDbAttributes(
                    connectionInfo,
                    database);

                logonInfo.ConnectionInfo =
                    connectionInfo;

                table.ApplyLogOnInfo(
                    logonInfo);
            }
        }

        private void UpdateOleDbAttributes(
            CrystalDecisions.Shared.ConnectionInfo
                connectionInfo,
            CrystalDatabaseConfig database)
        {
            if (connectionInfo.Attributes == null)
            {
                return;
            }

            var attributes =
                connectionInfo
                    .Attributes
                    .Collection;

            if (attributes == null)
            {
                return;
            }

            attributes.Set(
                "QE_DatabaseName",
                database.Database);

            attributes.Set(
                "QE_ServerDescription",
                database.Server);

            attributes.Set(
                "QE_SQLDB",
                true);

            attributes.Set(
                "SSO Enabled",
                false);

            var logonValue =
                attributes.Lookup(
                    "QE_LogonProperties");

            var logonAttributes =
                logonValue
                as DbConnectionAttributes;

            if (logonAttributes == null)
            {
                return;
            }

            var logonProperties =
                logonAttributes.Collection;

            if (logonProperties == null)
            {
                return;
            }

            logonProperties.Set(
                "Data Source",
                database.Server);

            logonProperties.Set(
                "Initial Catalog",
                database.Database);

            if (database.IntegratedSecurity)
            {
                logonProperties.Set(
                    "Integrated Security",
                    "SSPI");
            }
            else
            {
                logonProperties.Set(
                    "Integrated Security",
                    false);
            }

            logonProperties.Set(
                "Provider",
                "MSOLEDBSQL");

            logonProperties.Set(
                "Trust Server Certificate",
                "1");

            logonProperties.Set(
                "Use Encryption for Data",
                "0");
        }

        // =====================================================
        // Report Parameters
        // =====================================================

        private void SetParameters(
            ReportDocument report,
            List<CrystalExportParameter> parameters)
        {
            if (parameters == null ||
                parameters.Count == 0)
            {
                return;
            }

            foreach (var parameter in parameters)
            {
                if (string.IsNullOrWhiteSpace(
                        parameter.Name))
                {
                    throw new ArgumentException(
                        "Crystal 參數名稱不可為空白。");
                }

                if (parameter.Values == null ||
                    parameter.Values.Count == 0)
                {
                    throw new ArgumentException(
                        $"Crystal 參數 {parameter.Name} 沒有任何值。");
                }

                var parameterField =
                    report
                        .DataDefinition
                        .ParameterFields[
                            parameter.Name];

                var allowMultipleValues =
                    parameterField
                        .EnableAllowMultipleValue;

                if (DiagnosticsEnabled)
                {
                    Console.Error.WriteLine(
                        $"Setting parameter: " +
                        $"Name={parameter.Name}, " +
                        $"AllowMultiple={allowMultipleValues}, " +
                        $"ValueCount={parameter.Values.Count}, " +
                        $"DataType={parameter.DataType}");
                }

                // =============================================
                // 多值參數
                //
                // 即使只有一個選取值，也必須使用
                // ParameterValues + ApplyCurrentValues。
                // =============================================

                if (allowMultipleValues)
                {
                    var currentValues =
                        new ParameterValues();

                    foreach (var rawValue in parameter.Values)
                    {
                        var discreteValue =
                            new ParameterDiscreteValue
                            {
                                Value =
                                    ConvertParameterValue(
                                        rawValue,
                                        parameter.DataType)
                            };

                        currentValues.Add(
                            discreteValue);
                    }

                    parameterField.ApplyCurrentValues(
                        currentValues);

                    continue;
                }

                // =============================================
                // 單值參數
                // =============================================

                if (parameter.Values.Count != 1)
                {
                    throw new ArgumentException(
                        $"Crystal 參數 {parameter.Name} " +
                        "不允許多值，但收到 " +
                        $"{parameter.Values.Count} 個值。");
                }

                var value =
                    ConvertParameterValue(
                        parameter.Values[0],
                        parameter.DataType);

                report.SetParameterValue(
                    parameter.Name,
                    value);
            }
        }

        // =====================================================
        // Data Source Diagnostic
        // =====================================================

        private void ReadTables(
            Tables tables,
            string scope,
            List<CrystalDataSourceInfo> result)
        {
            foreach (Table table in tables)
            {
                var info =
                    table.LogOnInfo;

                var connection =
                    info.ConnectionInfo;

                var item =
                    new CrystalDataSourceInfo
                    {
                        TableName =
                            scope
                            + " / "
                            + table.Name,

                        Location =
                            table.Location,

                        ServerName =
                            connection.ServerName,

                        DatabaseName =
                            connection.DatabaseName,

                        UserId =
                            connection.UserID,

                        IntegratedSecurity =
                            connection
                                .IntegratedSecurity
                    };

                if (connection.Attributes != null)
                {
                    var collection =
                        connection
                            .Attributes
                            .Collection;

                    if (collection != null)
                    {
                        item.Attributes["Count"] =
                            collection
                                .Count
                                .ToString();

                        for (
                            int i = 0;
                            i < collection.Count;
                            i++)
                        {
                            try
                            {
                                var pair =
                                    collection[i]
                                    as NameValuePair2;

                                if (pair == null)
                                {
                                    item.Attributes[
                                        $"Attribute[{i}]"
                                    ] = "(null)";

                                    continue;
                                }

                                item.Attributes[
                                    $"Attribute[{i}].Type"
                                ] =
                                    pair
                                        .GetType()
                                        .FullName;

                                item.Attributes[
                                    $"Attribute[{i}].Name"
                                ] =
                                    pair.Name == null
                                        ? "(null)"
                                        : pair.Name
                                            .ToString();

                                item.Attributes[
                                    $"Attribute[{i}].ValueType"
                                ] =
                                    pair.Value == null
                                        ? "(null)"
                                        : pair.Value
                                            .GetType()
                                            .FullName;

                                var nestedAttributes =
                                    pair.Value
                                    as DbConnectionAttributes;

                                if (nestedAttributes != null)
                                {
                                    item.Attributes[
                                        $"Attribute[{i}].Value"
                                    ] =
                                        "DbConnectionAttributes";

                                    var nestedCollection =
                                        nestedAttributes
                                            .Collection;

                                    if (nestedCollection != null)
                                    {
                                        item.Attributes[
                                            $"Attribute[{i}].Nested.Count"
                                        ] =
                                            nestedCollection
                                                .Count
                                                .ToString();

                                        for (
                                            int j = 0;
                                            j <
                                            nestedCollection
                                                .Count;
                                            j++)
                                        {
                                            try
                                            {
                                                var nestedPair =
                                                    nestedCollection[j]
                                                    as NameValuePair2;

                                                if (nestedPair == null)
                                                {
                                                    item.Attributes[
                                                        $"Attribute[{i}].Nested[{j}]"
                                                    ] =
                                                        "(null)";

                                                    continue;
                                                }

                                                item.Attributes[
                                                    $"Attribute[{i}].Nested[{j}].Name"
                                                ] =
                                                    nestedPair.Name ==
                                                    null
                                                        ? "(null)"
                                                        : nestedPair
                                                            .Name
                                                            .ToString();

                                                item.Attributes[
                                                    $"Attribute[{i}].Nested[{j}].Value"
                                                ] =
                                                    IsSensitiveAttributeName(
                                                        nestedPair.Name == null
                                                            ? null
                                                            : nestedPair.Name.ToString())
                                                        ? "<redacted>"
                                                        : nestedPair.Value == null
                                                            ? "(null)"
                                                            : nestedPair.Value.ToString();

                                                item.Attributes[
                                                    $"Attribute[{i}].Nested[{j}].ValueType"
                                                ] =
                                                    nestedPair.Value ==
                                                    null
                                                        ? "(null)"
                                                        : nestedPair
                                                            .Value
                                                            .GetType()
                                                            .FullName;
                                            }
                                            catch (
                                                Exception ex)
                                            {
                                                item.Attributes[
                                                    $"Attribute[{i}].Nested[{j}]"
                                                ] =
                                                    "[ERROR] "
                                                    + ex.Message;
                                            }
                                        }
                                    }
                                }
                                else
                                {
                                    item.Attributes[
                                        $"Attribute[{i}].Value"
                                    ] =
                                        IsSensitiveAttributeName(
                                            pair.Name == null
                                                ? null
                                                : pair.Name.ToString())
                                            ? "<redacted>"
                                            : pair.Value == null
                                                ? "(null)"
                                                : pair.Value.ToString();
                                }
                            }
                            catch (Exception ex)
                            {
                                item.Attributes[
                                    $"Attribute[{i}]"
                                ] =
                                    "[ERROR] "
                                    + ex.Message;
                            }
                        }
                    }
                }

                result.Add(item);
            }
        }

        // =====================================================
        // Parameter Type Conversion
        // =====================================================

        private object ConvertParameterValue(
            string value,
            string dataType)
        {
            switch (dataType)
            {
                case "Date":
                case "DateField":
                    return DateTime.Parse(
                        value,
                        CultureInfo.InvariantCulture).Date;

                case "DateTime":
                case "DateTimeField":
                    return DateTime.Parse(
                        value,
                        CultureInfo.InvariantCulture);

                case "Number":
                case "NumberField":
                case "CurrencyField":
                    return decimal.Parse(
                        value,
                        CultureInfo.InvariantCulture);

                case "Boolean":
                case "BooleanField":
                    return bool.Parse(value);

                case "String":
                case "StringField":
                default:
                    return value;
            }
        }


        private void DumpRasConnections(
    ReportDocument report,
    string stage)
        {
            Console.Error.WriteLine();
            Console.Error.WriteLine("========================================");
            Console.Error.WriteLine($"RAS CONNECTIONS - {stage}");
            Console.Error.WriteLine("========================================");

            var rcd = report.ReportClientDocument;
            var databaseController = rcd.DatabaseController;

            var connections = databaseController.GetConnectionInfos(null);

            Console.Error.WriteLine(
                $"Connection Count: {connections?.Count ?? 0}");

            if (connections == null)
            {
                return;
            }

            for (int i = 0; i < connections.Count; i++)
            {
                var connection = connections[i];

                Console.Error.WriteLine();
                Console.Error.WriteLine($"--- Connection #{i + 1} ---");

                Console.Error.WriteLine(
                    $"Kind: {connection.Kind}");

                Console.Error.WriteLine(
                    $"UserName: {connection.UserName}");

                // 不要把密碼印出來
                Console.Error.WriteLine(
                    $"Password supplied: {!string.IsNullOrEmpty(connection.Password)}");

                DumpPropertyBag(
                    connection.Attributes,
                    "Attributes",
                    0);
            }
        }

        private void DumpPropertyBag(
    CrystalDecisions.ReportAppServer.DataDefModel.PropertyBag bag,
    string name,
    int level)
        {
            string indent =
                new string(' ', level * 2);

            Console.Error.WriteLine(
                $"{indent}{name}:");

            if (bag == null)
            {
                Console.Error.WriteLine(
                    $"{indent}  <null>");

                return;
            }

            foreach (string key in bag.PropertyIDs)
            {
                object value = null;

                try
                {
                    value = bag[key];
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine(
                        $"{indent}  {key} = <ERROR: {ex.Message}>");

                    continue;
                }

                if (value is
                    CrystalDecisions.ReportAppServer.DataDefModel.PropertyBag nestedBag)
                {
                    DumpPropertyBag(
                        nestedBag,
                        key,
                        level + 1);
                }
                else
                {
                    var valueText =
                        value == null
                            ? "<null>"
                            : value.ToString();

                    // 避免輸出密碼
                    if (key.IndexOf(
                            "password",
                            StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        valueText =
                            string.IsNullOrEmpty(valueText)
                                ? "<empty>"
                                : "<supplied>";
                    }

                    Console.Error.WriteLine(
                        $"{indent}  {key} = {valueText} " +
                        $"[{value?.GetType().FullName ?? "null"}]");
                }
            }
        }

        private void DumpTableConnections(
    ReportDocument report,
    string stage)
        {
            Console.Error.WriteLine();
            Console.Error.WriteLine(
                "========================================");
            Console.Error.WriteLine(
                $"TABLE CONNECTIONS - {stage}");
            Console.Error.WriteLine(
                "========================================");

            DumpTableCollection(
                report.Database.Tables,
                "MainReport");

            foreach (ReportDocument subreport in report.Subreports)
            {
                DumpTableCollection(
                    subreport.Database.Tables,
                    "SubReport:" + subreport.Name);
            }
        }

        private void DumpTableCollection(
            Tables tables,
            string scope)
        {
            foreach (Table table in tables)
            {
                var info =
                    table.LogOnInfo;

                var connection =
                    info.ConnectionInfo;

                Console.Error.WriteLine();
                Console.Error.WriteLine(
                    $"[{scope}] Table: {table.Name}");

                Console.Error.WriteLine(
                    $"Location: {table.Location}");

                Console.Error.WriteLine(
                    $"ServerName: {connection.ServerName}");

                Console.Error.WriteLine(
                    $"DatabaseName: {connection.DatabaseName}");

                Console.Error.WriteLine(
                    $"UserID: {connection.UserID}");

                Console.Error.WriteLine(
                    $"IntegratedSecurity: {connection.IntegratedSecurity}");

                if (connection.Attributes == null)
                {
                    Console.Error.WriteLine(
                        "Attributes: <null>");

                    continue;
                }

                var attributes =
                    connection.Attributes.Collection;

                if (attributes == null)
                {
                    Console.Error.WriteLine(
                        "Attributes.Collection: <null>");

                    continue;
                }

                Console.Error.WriteLine(
                    $"QE_DatabaseName: {attributes.Lookup("QE_DatabaseName")}");

                Console.Error.WriteLine(
                    $"QE_ServerDescription: {attributes.Lookup("QE_ServerDescription")}");

                Console.Error.WriteLine(
                    $"QE_SQLDB: {attributes.Lookup("QE_SQLDB")}");

                var logonValue =
                    attributes.Lookup(
                        "QE_LogonProperties");

                var logonAttributes =
                    logonValue as DbConnectionAttributes;

                if (logonAttributes == null)
                {
                    Console.Error.WriteLine(
                        "QE_LogonProperties: <null>");

                    continue;
                }

                var logonProperties =
                    logonAttributes.Collection;

                if (logonProperties == null)
                {
                    Console.Error.WriteLine(
                        "QE_LogonProperties.Collection: <null>");

                    continue;
                }

                Console.Error.WriteLine(
                    $"Provider: {logonProperties.Lookup("Provider")}");

                Console.Error.WriteLine(
                    $"Data Source: {logonProperties.Lookup("Data Source")}");

                Console.Error.WriteLine(
                    $"Initial Catalog: {logonProperties.Lookup("Initial Catalog")}");

                Console.Error.WriteLine(
                    $"Integrated Security: {logonProperties.Lookup("Integrated Security")}");
            }
        }

        private void DumpRasTables(
    ReportDocument report,
    string stage)
        {
            Console.Error.WriteLine();
            Console.Error.WriteLine(
                "========================================");
            Console.Error.WriteLine(
                $"RAS TABLES - {stage}");
            Console.Error.WriteLine(
                "========================================");

            var database =
                report
                    .ReportClientDocument
                    .DatabaseController
                    .Database;

            for (int i = 0;
                 i < database.Tables.Count;
                 i++)
            {
                var table =
                    database.Tables[i];

                Console.Error.WriteLine();
                Console.Error.WriteLine(
                    $"Table #{i + 1}");

                Console.Error.WriteLine(
                    $"Runtime Type: {table.GetType().FullName}");

                Console.Error.WriteLine(
                    $"Name: {table.Name}");

                Console.Error.WriteLine(
                    $"Alias: {table.Alias}");

                Console.Error.WriteLine(
                    $"QualifiedName: {table.QualifiedName}");

                Console.Error.WriteLine(
                    $"ConnectionInfo null: {table.ConnectionInfo == null}");

                if (table.ConnectionInfo != null)
                {
                    Console.Error.WriteLine(
                        $"Connection Kind: {table.ConnectionInfo.Kind}");

                    Console.Error.WriteLine(
                        $"Connection UserName: {table.ConnectionInfo.UserName}");

                    DumpPropertyBag(
                        table.ConnectionInfo.Attributes,
                        "Table Connection Attributes",
                        0);
                }

                var commandTable =
                    table as CrystalDecisions.ReportAppServer
                        .DataDefModel.CommandTable;

                if (commandTable != null)
                {
                    Console.Error.WriteLine(
                        "IS COMMAND TABLE: True");

                    Console.Error.WriteLine(
                        $"CommandText Length: {commandTable.CommandText?.Length ?? 0}");

                    if (!string.IsNullOrWhiteSpace(
                        commandTable.CommandText))
                    {
                        Console.Error.WriteLine(
                            "CommandText:");

                        Console.Error.WriteLine(
                            commandTable.CommandText);
                    }
                }
                else
                {
                    Console.Error.WriteLine(
                        "IS COMMAND TABLE: False");
                }
            }
        }

        private void ApplyRasCommandConnection(
    ReportDocument report,
    CrystalDatabaseConfig database,
    List<CrystalExportParameter> parameters)
        {
            if (report == null)
            {
                throw new ArgumentNullException(nameof(report));
            }

            ValidateDatabaseConfig(database);

            var rcd =
                report.ReportClientDocument;

            var databaseController =
                rcd.DatabaseController;

            var tables =
                databaseController
                    .Database
                    .Tables;

            var replacedCommandCount = 0;

            for (int i = 0;
                 i < tables.Count;
                 i++)
            {
                var oldTable =
                    tables[i];

                var oldCommandTable =
                    oldTable as CrystalDecisions
                        .ReportAppServer
                        .DataDefModel
                        .CommandTable;

                // 目前先只處理 Command Table
                if (oldCommandTable == null)
                {
                    continue;
                }

                if (DiagnosticsEnabled)
                {
                    Console.Error.WriteLine();

                    Console.Error.WriteLine(
                        $"Applying RAS Command connection: {oldCommandTable.Name}");
                }

                // =====================================================
                // 1. Deep clone 原 CommandTable
                // =====================================================

                var newCommandTable =
                    oldCommandTable.Clone(true)
                    as CrystalDecisions
                        .ReportAppServer
                        .DataDefModel
                        .CommandTable;

                if (newCommandTable == null)
                {
                    throw new InvalidOperationException(
                        $"Command Table Clone 失敗：{oldCommandTable.Name}");
                }

                newCommandTable.CommandText =
                    InlineCommandParameters(
                        newCommandTable.CommandText,
                        parameters);

                newCommandTable.CommandText =
                    AlignCommandParameterNames(
                        report,
                        newCommandTable.CommandText);

                // =====================================================
                // 2. Clone 原 ConnectionInfo Attributes
                // =====================================================

                var oldConnection =
                    oldCommandTable.ConnectionInfo;

                if (oldConnection == null)
                {
                    throw new InvalidOperationException(
                        $"Command Table 沒有 ConnectionInfo：{oldCommandTable.Name}");
                }

                var qeDetails =
                    oldConnection.Attributes.Clone(true);

                if (qeDetails == null)
                {
                    throw new InvalidOperationException(
                        "Connection Attributes Clone 失敗。");
                }

                var logonProperties =
                    qeDetails["QE_LogonProperties"]
                    as CrystalDecisions
                        .ReportAppServer
                        .DataDefModel
                        .PropertyBag;

                if (logonProperties == null)
                {
                    throw new InvalidOperationException(
                        "找不到 QE_LogonProperties。");
                }

                // =====================================================
                // 3. 修改 Database / Server
                // =====================================================

                qeDetails["QE_DatabaseName"] =
                    database.Database;

                qeDetails["QE_ServerDescription"] =
                    database.Server;

                // RPT 原本使用 SQLNCLI11，但目前執行環境安裝的是
                // Microsoft OLE DB Driver 18。
                logonProperties["Provider"] =
                    "MSOLEDBSQL";

                logonProperties["Data Source"] =
                    database.Server;

                logonProperties["Initial Catalog"] =
                    database.Database;

                if (logonProperties.Contains(
                    "DataTypeCompatibility"))
                {
                    logonProperties["DataTypeCompatibility"] =
                        "80";
                }
                else
                {
                    logonProperties.Add(
                        "DataTypeCompatibility",
                        "80");
                }

                // =====================================================
                // 4. Authentication
                // =====================================================

                if (database.IntegratedSecurity)
                {
                    SetRasSsoEnabled(
                        qeDetails,
                        true);

                    // Windows Authentication 使用 SSPI。
                    if (logonProperties.Contains(
                            "Integrated Security"))
                    {
                        logonProperties["Integrated Security"] =
                            "SSPI";
                    }
                    else
                    {
                        logonProperties.Add(
                            "Integrated Security",
                            "SSPI");
                    }

                    if (logonProperties.Contains("User ID"))
                    {
                        logonProperties.Remove("User ID");
                    }

                    if (logonProperties.Contains("Password"))
                    {
                        logonProperties.Remove("Password");
                    }
                }
                else
                {
                    SetRasSsoEnabled(
                        qeDetails,
                        false);

                    // MSOLEDBSQL 使用 SQL Login 時不要設定
                    // Integrated Security=False。
                    if (logonProperties.Contains(
                            "Integrated Security"))
                    {
                        logonProperties.Remove(
                            "Integrated Security");
                    }

                    // 剛才已用最小連線字串驗證成功，
                    // 因此先移除可能不相容的額外屬性。
                    if (logonProperties.Contains(
                            "Trust Server Certificate"))
                    {
                        logonProperties.Remove(
                            "Trust Server Certificate");
                    }

                    if (logonProperties.Contains(
                            "Use Encryption for Data"))
                    {
                        logonProperties.Remove(
                            "Use Encryption for Data");
                    }

                    if (logonProperties.Contains("User ID"))
                    {
                        logonProperties["User ID"] =
                            database.Username;
                    }
                    else
                    {
                        logonProperties.Add(
                            "User ID",
                            database.Username);
                    }

                    if (logonProperties.Contains("Password"))
                    {
                        logonProperties["Password"] =
                            database.Password;
                    }
                    else
                    {
                        logonProperties.Add(
                            "Password",
                            database.Password);
                    }
                }

                qeDetails["QE_LogonProperties"] =
                    logonProperties;

                // =====================================================
                // 5. 建立新的 ConnectionInfo
                // =====================================================

                var newConnection =
                    new CrystalDecisions
                        .ReportAppServer
                        .DataDefModel
                        .ConnectionInfo();

                newConnection.Kind =
                    oldConnection.Kind;

                newConnection.Attributes =
                    qeDetails;

                if (database.IntegratedSecurity)
                {
                    newConnection.UserName =
                        string.Empty;

                    newConnection.Password =
                        string.Empty;
                }
                else
                {
                    newConnection.UserName =
                        database.Username;

                    newConnection.Password =
                        database.Password;
                }

                // =====================================================
                // 6. 將 ConnectionInfo 指定給 cloned CommandTable
                // =====================================================

                newCommandTable.ConnectionInfo =
                    newConnection;

                // =====================================================
                // 7. 關鍵：
                // 用 SetTableLocation 將 CommandTable 套回報表
                // =====================================================

                databaseController.SetTableLocation(
                    oldCommandTable,
                    newCommandTable);

                newCommandTable.CommandText =
                    AlignCommandParameterNames(
                        report,
                        newCommandTable.CommandText);

                databaseController.SetTableLocation(
                    databaseController.Database.Tables[i],
                    newCommandTable);

                replacedCommandCount++;
            }

            if (replacedCommandCount > 0 && !database.IntegratedSecurity)
            {
                databaseController.LogonEx(
                    database.Server,
                    database.Database,
                    database.Username,
                    database.Password);
            }
        }

        private static void SetRasSsoEnabled(
            CrystalDecisions.ReportAppServer.DataDefModel.PropertyBag qeDetails,
            bool enabled)
        {
            // 不同 Crystal Runtime／RPT 版本可能使用其中一個名稱。
            // 既有屬性優先更新；若兩者都不存在則加入標準 QE 名稱。
            var updated = false;

            if (qeDetails.Contains("QE_SSOEnabled"))
            {
                qeDetails["QE_SSOEnabled"] = enabled;
                updated = true;
            }

            if (qeDetails.Contains("SSO Enabled"))
            {
                qeDetails["SSO Enabled"] = enabled;
                updated = true;
            }

            if (!updated)
            {
                qeDetails.Add(
                    "QE_SSOEnabled",
                    enabled);
            }
        }

        private static string AlignCommandParameterNames(
            ReportDocument report,
            string commandText)
        {
            if (string.IsNullOrWhiteSpace(commandText))
            {
                return commandText;
            }

            foreach (ParameterFieldDefinition parameter
                     in report.DataDefinition.ParameterFields)
            {
                var parameterName = parameter.Name;
                var atIndex = parameterName.IndexOf('@');

                if (atIndex <= 0)
                {
                    continue;
                }

                var sqlPart = parameterName
                    .Substring(atIndex + 1)
                    .TrimStart();
                if (!sqlPart.StartsWith("select ", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var shortToken = "{?" + parameterName.Substring(0, atIndex + 1) + "}";
                var fullToken = "{?" + parameterName + "}";

                commandText = Regex.Replace(
                    commandText,
                    Regex.Escape(shortToken),
                    fullToken,
                    RegexOptions.IgnoreCase);
            }

            return commandText;
        }

        private static string InlineCommandParameters(
            string commandText,
            List<CrystalExportParameter> parameters)
        {
            if (string.IsNullOrWhiteSpace(commandText) || parameters == null)
            {
                return commandText;
            }

            foreach (var parameter in parameters)
            {
                if (parameter == null || parameter.Values == null || parameter.Values.Count == 0)
                {
                    continue;
                }

                var literal = string.Join(",", parameter.Values.Select(value =>
                    ToSqlLiteral(value, parameter.DataType)));
                var name = parameter.Name ?? string.Empty;
                var atIndex = name.IndexOf('@');
                var shortName = atIndex > 0
                    ? name.Substring(0, atIndex + 1)
                    : name;

                commandText = ReplaceCommandToken(
                    commandText,
                    "{?" + name + "}",
                    literal);
                commandText = ReplaceCommandToken(
                    commandText,
                    "{?" + shortName + "}",
                    literal);
            }

            return commandText;
        }

        private static string ReplaceCommandToken(
            string commandText,
            string token,
            string replacement)
        {
            var result = commandText.Replace(token, replacement);
            var upperToken = token.ToUpperInvariant();

            if (!string.Equals(token, upperToken, StringComparison.Ordinal))
            {
                result = Regex.Replace(
                    result,
                    Regex.Escape(upperToken),
                    replacement.Replace("$", "$$$$"),
                    RegexOptions.IgnoreCase);
            }

            return result;
        }

        private static string ToSqlLiteral(
            string value,
            string dataType)
        {
            if (string.Equals(dataType, "Number", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(dataType, "NumberField", StringComparison.OrdinalIgnoreCase))
            {
                if (decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var number))
                {
                    return number.ToString(CultureInfo.InvariantCulture);
                }
            }

            if (string.Equals(dataType, "Boolean", StringComparison.OrdinalIgnoreCase))
            {
                return bool.TryParse(value, out var boolean) && boolean ? "1" : "0";
            }

            if (dataType.IndexOf("Date", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                if (DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
                {
                    return "'" + date.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture) + "'";
                }
            }

            return "'" + (value ?? string.Empty).Replace("'", "''") + "'";
        }

        private void ValidateExportRequest(
            CrystalExportRequest request)
        {
            if (request == null)
            {
                throw new ArgumentNullException(nameof(request));
            }

            if (string.IsNullOrWhiteSpace(request.RptPath))
            {
                throw new ArgumentException("RptPath 不可為空白。");
            }

            if (!File.Exists(request.RptPath))
            {
                throw new FileNotFoundException(
                    "找不到指定的 RPT 報表檔案。",
                    request.RptPath);
            }

            if (string.IsNullOrWhiteSpace(request.OutputPath))
            {
                throw new ArgumentException("OutputPath 不可為空白。");
            }

            if (!request.UseSavedDataOnly)
            {
                if (request.Database == null)
                {
                    throw new ArgumentException(
                        "即時報表匯出必須提供 Database 設定。");
                }

                ValidateDatabaseConfig(request.Database);
            }
        }

        private bool IsSensitiveAttributeName(
            string name)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                return false;
            }

            return
                name.IndexOf(
                    "password",
                    StringComparison.OrdinalIgnoreCase) >= 0 ||
                name.IndexOf(
                    "secret",
                    StringComparison.OrdinalIgnoreCase) >= 0 ||
                name.IndexOf(
                    "token",
                    StringComparison.OrdinalIgnoreCase) >= 0 ||
                name.IndexOf(
                    "connection string",
                    StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private void ValidateDatabaseConfig(
    CrystalDatabaseConfig database)
        {
            if (database == null)
            {
                throw new ArgumentNullException(
                    nameof(database));
            }

            if (string.IsNullOrWhiteSpace(database.Server))
            {
                throw new ArgumentException(
                    "Database.Server 不可為空白。");
            }

            if (string.IsNullOrWhiteSpace(database.Database))
            {
                throw new ArgumentException(
                    "Database.Database 不可為空白。");
            }

            if (!database.IntegratedSecurity)
            {
                if (string.IsNullOrWhiteSpace(
                        database.Username))
                {
                    throw new ArgumentException(
                        "SQL Server Authentication 模式下 Username 不可為空白。");
                }

                if (string.IsNullOrWhiteSpace(
                        database.Password))
                {
                    throw new ArgumentException(
                        "SQL Server Authentication 模式下 Password 不可為空白。");
                }
            }
        }

        private SqlConnectionStringBuilder
            CreateConnectionStringBuilder(
                CrystalDatabaseConfig database)
        {
            var builder =
                new SqlConnectionStringBuilder
                {
                    DataSource = database.Server,
                    InitialCatalog = database.Database,
                    IntegratedSecurity =
                        database.IntegratedSecurity,
                    ConnectTimeout = 10,
                    TrustServerCertificate = true,
                    ApplicationName =
                        "CrystalReportPortal.CrystalService"
                };

            if (!database.IntegratedSecurity)
            {
                builder.UserID =
                    database.Username;

                builder.Password =
                    database.Password;
            }

            return builder;
        }

        private void ValidateLovQuery(
            string sqlQuery)
        {
            if (string.IsNullOrWhiteSpace(sqlQuery))
            {
                throw new ArgumentException(
                    "SqlQuery 不可為空白。");
            }

            var normalized =
                sqlQuery.Trim();

            if (!Regex.IsMatch(
                    normalized,
                    @"^SELECT\s+",
                    RegexOptions.IgnoreCase))
            {
                throw new InvalidOperationException(
                    "LOV 僅允許執行 SELECT 查詢。");
            }

            if (normalized.Contains(";") ||
                normalized.Contains("--") ||
                normalized.Contains("/*") ||
                normalized.Contains("*/"))
            {
                throw new InvalidOperationException(
                    "LOV SQL 不允許多段敘述或 SQL 註解。");
            }

            var prohibitedKeywords =
                new[]
                {
            "INSERT",
            "INTO",
            "UPDATE",
            "DELETE",
            "DROP",
            "ALTER",
            "CREATE",
            "TRUNCATE",
            "MERGE",
            "EXEC",
            "EXECUTE",
            "GRANT",
            "REVOKE",
            "DENY",
            "BACKUP",
            "RESTORE",
            "DBCC"
                };

            foreach (var keyword in prohibitedKeywords)
            {
                if (Regex.IsMatch(
                        normalized,
                        @"\b" +
                        Regex.Escape(keyword) +
                        @"\b",
                        RegexOptions.IgnoreCase))
                {
                    throw new InvalidOperationException(
                        "LOV SQL 含有不允許的關鍵字：" +
                        keyword);
                }
            }
        }

        private static bool HasDatabaseTables(
    ReportDocument report)
        {
            if (report.Database.Tables.Count > 0)
            {
                return true;
            }

            foreach (ReportDocument subreport in report.Subreports)
            {
                if (subreport.Database.Tables.Count > 0)
                {
                    return true;
                }
            }

            return false;
        }
    }
}
