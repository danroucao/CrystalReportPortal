using CrystalDecisions.CrystalReports.Engine;
using CrystalDecisions.Shared;
using CrystalReportPortal.CrystalService.Models;
using System;
using System.Collections.Generic;
using System.IO;

namespace CrystalReportPortal.CrystalService.Services
{
    public class CrystalReportService
    {
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

                    ReplaceDatabaseConnection(
                        report,
                        request.Database);

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
            // 1. OLE DB Logon Properties
            // =====================================================

            var logonProperties =
                new CrystalDecisions.ReportAppServer
                    .DataDefModel.PropertyBag();

            logonProperties.Add(
                "Application Intent",
                "READWRITE");

            logonProperties.Add(
                "Auto Translate",
                "-1");

            logonProperties.Add(
                "Connect Timeout",
                "15");

            logonProperties.Add(
                "Data Source",
                database.Server);

            logonProperties.Add(
                "DataTypeCompatibility",
                "0");

            logonProperties.Add(
                "General Timeout",
                "0");

            logonProperties.Add(
                "Initial Catalog",
                database.Database);

            logonProperties.Add(
                "Locale Identifier",
                "1028");

            logonProperties.Add(
                "MARS Connection",
                "0");

            logonProperties.Add(
                "OLE DB Services",
                "-5");

            // 本機已確認存在，而且 PowerShell OLE DB
            // 已成功使用此 Provider 登入。
            logonProperties.Add(
                "Provider",
                "MSOLEDBSQL");

            logonProperties.Add(
                "Trust Server Certificate",
                "1");

            logonProperties.Add(
                "Use DSN Default Properties",
                false);

            logonProperties.Add(
                "Use Encryption for Data",
                "0");

            // =====================================================
            // 2. Authentication
            // =====================================================

            if (database.IntegratedSecurity)
            {
                logonProperties.Add(
                    "Integrated Security",
                    true);
            }
            else
            {
                logonProperties.Add(
                    "Integrated Security",
                    false);

                // 關鍵修正：
                // SQL Authentication 帳密也放進
                // QE_LogonProperties
                logonProperties.Add(
                    "User ID",
                    database.Username);

                logonProperties.Add(
                    "Password",
                    database.Password);
            }

            // =====================================================
            // 3. Query Engine Attributes
            // =====================================================

            var qeDetails =
                new CrystalDecisions.ReportAppServer
                    .DataDefModel.PropertyBag();

            qeDetails.Add(
                "Database DLL",
                "crdb_ado.dll");

            qeDetails.Add(
                "QE_DatabaseName",
                database.Database);

            qeDetails.Add(
                "QE_DatabaseType",
                "OLE DB (ADO)");

            qeDetails.Add(
                "QE_LogonProperties",
                logonProperties);

            qeDetails.Add(
                "QE_ServerDescription",
                database.Server);

            qeDetails.Add(
                "QE_SQLDB",
                true);

            qeDetails.Add(
                "SSO Enabled",
                false);

            // SQL Server 預設 Schema
            qeDetails.Add(
                "Owner",
                "dbo");

            logonProperties.Add(
                "Owner",
                "dbo");

            // =====================================================
            // 4. 建立新的 RAS ConnectionInfo
            // =====================================================

            var newConnection =
                new CrystalDecisions.ReportAppServer
                    .DataDefModel.ConnectionInfo();

            newConnection.Attributes =
                qeDetails;

            newConnection.Kind =
                CrystalDecisions.ReportAppServer
                    .DataDefModel
                    .CrConnectionInfoKindEnum
                    .crConnectionInfoKindCRQE;

            if (database.IntegratedSecurity)
            {
                newConnection.UserName =
                    string.Empty;

                newConnection.Password =
                    string.Empty;
            }
            else
            {
                // 同時保留 RAS ConnectionInfo
                // 的 UserName / Password
                newConnection.UserName =
                    database.Username;

                newConnection.Password =
                    database.Password;
            }

            // =====================================================
            // 5. 取得原本 Connection
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
            // 6. Replace Connection
            // =====================================================

            for (int i = 0;
                 i < oldConnections.Count;
                 i++)
            {
                databaseController
                    .ReplaceConnection(
                        oldConnections[i],
                        newConnection,
                        null,
                        CrystalDecisions.ReportAppServer
                            .DataDefModel
                            .CrDBOptionsEnum
                            .crDBOptionDoNotVerifyDB);
            }

            // =====================================================
            // 7. 再執行一次 DatabaseController Logon
            //
            // ReplaceConnection 負責換 persistent connection，
            // LogonEx 負責明確提供此次 runtime session 的登入資訊。
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

            logonProperties.Set(
                "Integrated Security",
                database.IntegratedSecurity);

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
    }
}