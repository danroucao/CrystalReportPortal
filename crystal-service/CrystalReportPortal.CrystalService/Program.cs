using System;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;
using CrystalReportPortal.CrystalService.Models;
using CrystalReportPortal.CrystalService.Services;

namespace CrystalReportPortal.CrystalService
{
    internal class Program
    {
        static int Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Console.InputEncoding = Encoding.UTF8;
            
            Console.Error.WriteLine(
                "Process Bitness: " +
                (Environment.Is64BitProcess ? "64-bit" : "32-bit"));

            var serializer = new JavaScriptSerializer();

            try
            {
                if (args.Length < 1)
                {
                    throw new ArgumentException(
                        "請指定 command。");
                }

                var command =
                    args[0].ToLowerInvariant();

                var service =
                    new CrystalReportService();

                // ============================
                // parameters
                // ============================

                if (command == "parameters")
                {
                    if (args.Length < 2)
                    {
                        throw new ArgumentException(
                            "請指定 RPT 路徑。");
                    }

                    var parameters =
                        service.GetParameters(
                            args[1]);

                    var response =
                        new CrystalParameterResponse
                        {
                            Success = true,
                            Message =
                                "Parameters parsed successfully.",
                            Parameters =
                                parameters
                        };

                    Console.WriteLine(
                        serializer.Serialize(response));

                    return 0;
                }

                // ============================
                // preview
                // ============================

                if (command == "preview")
                {
                    if (args.Length < 3)
                    {
                        throw new ArgumentException(
                            "請指定 RPT 路徑與 PDF 輸出路徑。");
                    }

                    var rptPath =
                        args[1];

                    var outputPath =
                        args[2];

                    service.ExportPdf(
                        rptPath,
                        outputPath);

                    var response =
                        new CrystalExportResponse
                        {
                            Success = true,
                            Message =
                                "Preview generated successfully.",
                            OutputPath =
                                outputPath
                        };

                    Console.WriteLine(
                        serializer.Serialize(response));

                    return 0;
                }

                // ============================
                // export
                // ============================

                if (command == "export")
                {
                    if (args.Length < 2)
                    {
                        throw new ArgumentException(
                            "請指定 request.json 路徑。");
                    }

                    var requestPath =
                        args[1];

                    if (!File.Exists(requestPath))
                    {
                        throw new FileNotFoundException(
                            "找不到 request.json。",
                            requestPath);
                    }

                    var json =
                        File.ReadAllText(requestPath);

                    var request =
                        serializer.Deserialize<
                            CrystalExportRequest>(
                            json);

                    var response =
                        service.ExportReport(request);

                    Console.WriteLine(
                        serializer.Serialize(response));

                    return response.Success ? 0 : 1;
                }

                if (command == "datasource")
                {
                    if (args.Length < 2)
                    {
                        throw new ArgumentException(
                            "請指定 RPT 路徑。");
                    }

                    var dataSources =
                        service.GetDataSources(args[1]);

                    Console.WriteLine(
                        serializer.Serialize(
                            new
                            {
                                Success = true,
                                Data = dataSources
                            }));

                    return 0;
                }

                throw new ArgumentException(
                    "不支援的 command：" +
                    command);
            }
            catch (Exception ex)
            {
                var response =
                    new CrystalExportResponse
                    {
                        Success = false,
                        Message =
                            ex.ToString()
                    };

                Console.WriteLine(
                    serializer.Serialize(response));

                return 1;
            }
        }
    }
}
