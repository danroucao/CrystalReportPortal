using CrystalReportPortal.CrystalService.Services;
using System;

namespace CrystalReportPortal.CrystalService
{
    internal class Program
    {
        static void Main(string[] args)
        {
            try
            {
                var service = new CrystalReportService();

                string rptPath =
                    @"C:\Users\annie\OneDrive\桌面\CrystalReportPortal\reports\參數練習-零售銷售明細.rpt";

                var parameters =
                    service.GetParameters(rptPath);

                Console.WriteLine("RPT 參數數量：" + parameters.Count);
                Console.WriteLine();

                foreach (var parameter in parameters)
                {
                    Console.WriteLine(
                        "Name: " + parameter.Name);

                    Console.WriteLine(
                        "PromptText: " + parameter.PromptText);

                    Console.WriteLine(
                        "ValueType: " + parameter.ValueType);

                    Console.WriteLine(
                        "AllowMultipleValues: " +
                        parameter.AllowMultipleValues);

                    Console.WriteLine(
                        "IsOptional: " +
                        parameter.IsOptional);

                    Console.WriteLine("----------------------------");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("讀取報表參數失敗：");
                Console.WriteLine(ex);
            }

            Console.ReadKey();
        }
    }
}