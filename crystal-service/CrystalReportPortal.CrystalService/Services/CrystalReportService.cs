using CrystalDecisions.CrystalReports.Engine;
using CrystalDecisions.Shared;
using CrystalReportPortal.CrystalService.Models;
using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.Diagnostics;
using System.IO;

namespace CrystalReportPortal.CrystalService.Services
{
    public class CrystalReportService
    {
        public CrystalDatabaseTestResponse TestDatabaseConnection(CrystalDatabaseConfig database)
        {
            var stopwatch = Stopwatch.StartNew();

            try
            {
                if (database == null)
                {
                    throw new ArgumentNullException(
                        nameof(database));
                }

                if (string.IsNullOrWhiteSpace(database.Server))
                {
                    throw new ArgumentException("Database.Server 不可為空白。");
                }

                if (string.IsNullOrWhiteSpace(database.Database))
                {
                    throw new ArgumentException("Database.Database 不可為空白。");
                }

                if (!database.IntegratedSecurity)
                {
                    if (string.IsNullOrWhiteSpace(database.Username))
                    {
                        throw new ArgumentException("SQL Server Authentication 模式下 Username 不可為空白。");
                    }

                    if (string.IsNullOrWhiteSpace(database.Password))
                    {
                        throw new ArgumentException("SQL Server Authentication 模式下 Password 不可為空白。");
                    }
                }

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
                    builder.UserID = database.Username;

                    builder.Password = database.Password;
                }

                using (var connection = new SqlConnection(builder.ConnectionString))
                {
                    connection.Open();

                    const string sql = @"
                    SELECT
                        CAST(SYSTEM_USER AS NVARCHAR(128)) AS LoginName,
                        DB_NAME() AS DatabaseName,
                        (
                            SELECT COUNT_BIG(*)
                            FROM dbo.v_SalesDetail
                        ) AS DetailCount;";

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
                                DetailCount =
                                    Convert.ToInt64(
                                        reader["DetailCount"]),
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

        public void ExportPdf(
            string rptPath,
            string outputPath)
        {
            if (string.IsNullOrWhiteSpace(rptPath))
            {
                throw new ArgumentException(
                    "RPT 路徑不可為空。",
                    nameof(rptPath));
            }

            if (string.IsNullOrWhiteSpace(outputPath))
            {
                throw new ArgumentException(
                    "輸出路徑不可為空。",
                    nameof(outputPath));
            }

            if (!File.Exists(rptPath))
            {
                throw new FileNotFoundException(
                    "找不到指定的 RPT 報表檔案。",
                    rptPath);
            }

            string outputDirectory =
                Path.GetDirectoryName(outputPath);

            if (!string.IsNullOrWhiteSpace(outputDirectory))
            {
                Directory.CreateDirectory(outputDirectory);
            }

            using (var report = new ReportDocument())
            {
                report.Load(rptPath);

                report.ExportToDisk(
                    ExportFormatType.PortableDocFormat,
                    outputPath);
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
                var outputDirectory =
                    Path.GetDirectoryName(request.OutputPath);

                if (!string.IsNullOrWhiteSpace(outputDirectory))
                {
                    Directory.CreateDirectory(outputDirectory);
                }

                using (var report = new ReportDocument())
                {
                    report.Load(request.RptPath);

                    DumpRasTables(
                        report,
                        "BEFORE COMMAND REPLACE");

                    ApplyRasCommandConnection(
                        report,
                        request.Database);

                    DumpRasTables(
                        report,
                        "AFTER COMMAND REPLACE");

                    SetParameters(
                        report,
                        request.Parameters);

                    report.ExportToDisk(
                        ExportFormatType.PortableDocFormat,
                        request.OutputPath);

                    return new CrystalExportResponse
                    {
                        Success = true,
                        Message = "Export success.",
                        OutputPath = request.OutputPath
                    };
                }
            }
            catch (Exception ex)
            {
                return new CrystalExportResponse
                {
                    Success = false,
                    Message = ex.ToString(),
                    OutputPath = null
                };
            }
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

                logonProperties["Provider"] =
                    "SQLNCLI11";

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

            foreach (
                var parameter
                in parameters)
            {
                if (parameter.Values == null ||
                    parameter.Values.Count == 0)
                {
                    continue;
                }

                // =============================================
                // 單值參數
                // =============================================

                if (parameter.Values.Count == 1)
                {
                    var value =
                        ConvertParameterValue(
                            parameter.Values[0],
                            parameter.DataType);

                    report.SetParameterValue(
                        parameter.Name,
                        value);

                    continue;
                }

                // =============================================
                // 多值參數
                // =============================================

                var parameterField =
                    report
                        .DataDefinition
                        .ParameterFields[
                            parameter.Name];

                var values =
                    new ParameterValues();

                foreach (
                    var rawValue
                    in parameter.Values)
                {
                    var discreteValue =
                        new ParameterDiscreteValue
                        {
                            Value =
                                ConvertParameterValue(
                                    rawValue,
                                    parameter.DataType)
                        };

                    values.Add(
                        discreteValue);
                }

                parameterField
                    .ApplyCurrentValues(
                        values);
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
                                                    nestedPair.Value ==
                                                    null
                                                        ? "(null)"
                                                        : nestedPair
                                                            .Value
                                                            .ToString();

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
                                        pair.Value == null
                                            ? "(null)"
                                            : pair.Value
                                                .ToString();
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

                    return DateTime
                        .Parse(value)
                        .Date;

                case "DateTime":

                    return DateTime.Parse(
                        value);

                case "Number":

                    return decimal.Parse(
                        value);

                case "Boolean":

                    return bool.Parse(
                        value);

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
    CrystalDatabaseConfig database)
        {
            var rcd =
                report.ReportClientDocument;

            var databaseController =
                rcd.DatabaseController;

            var tables =
                databaseController
                    .Database
                    .Tables;

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

                Console.Error.WriteLine();
                Console.Error.WriteLine(
                    $"Applying RAS Command connection: {oldCommandTable.Name}");

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

                logonProperties["Provider"] =
                    "MSOLEDBSQL";

                logonProperties["Data Source"] =
                    database.Server;

                logonProperties["Initial Catalog"] =
                    database.Database;

                logonProperties["Trust Server Certificate"] =
                    "1";

                // =====================================================
                // 4. Authentication
                // =====================================================

                if (database.IntegratedSecurity)
                {
                    logonProperties["Integrated Security"] =
                        "SSPI";

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
            }
        }
    }
}