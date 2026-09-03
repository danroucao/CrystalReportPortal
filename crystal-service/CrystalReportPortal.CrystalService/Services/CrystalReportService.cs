using CrystalDecisions.CrystalReports.Engine;
using CrystalDecisions.Shared;
using CrystalReportPortal.CrystalService.Models;
using System.Collections.Generic;
using System;
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

        public List<ReportParameterInfo> GetParameters(string rptPath)
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

            var result = new List<ReportParameterInfo>();

            using (var report = new ReportDocument())
            {
                report.Load(rptPath);

                foreach (ParameterFieldDefinition parameter
                         in report.DataDefinition.ParameterFields)
                {
                    var info = new ReportParameterInfo
                    {
                        Name = parameter.Name,
                        PromptText = parameter.PromptText,
                        ValueType = parameter.ValueType.ToString(),

                        AllowMultipleValues =
                            parameter.EnableAllowMultipleValue,

                        IsOptional =
                            parameter.EnableNullValue
                    };

                    result.Add(info);
                }
            }

            return result;
        }
    }
}