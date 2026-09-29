using System.Text.Json;
using System.Text.RegularExpressions;
using System.Collections.Generic;
using System.Linq;
using CrystalReportPortal.Api.Dtos;

namespace CrystalReportPortal.Api.Services;

public static class ReportHeaderLocalization
{
    private static readonly Dictionary<string, string> ExactTranslations =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["Title"] = "報表標題",
            ["CustomerName"] = "客戶名稱",
            ["CustomerCode"] = "客戶代碼",
            ["ContactPerson"] = "聯絡人",
            ["PhoneNo"] = "聯絡電話",
            ["ItemNo"] = "商品編號",
            ["ItemName"] = "商品名稱",
            ["ProductName"] = "商品名稱",
            ["CategoryCode"] = "商品類別代碼",
            ["CategoryName"] = "商品類別",
            ["MemberLevel"] = "會員等級",
            ["PaymentMethod"] = "付款方式",
            ["PayCode"] = "付款代碼",
            ["PayName"] = "付款方式",
            ["StoreCode"] = "門市代碼",
            ["StoreName"] = "門市名稱",
            ["SaleDate"] = "銷售日期",
            ["SalesDate"] = "銷售日期",
            ["StartDate"] = "開始日期",
            ["EndDate"] = "結束日期",
            ["Quantity"] = "數量",
            ["UnitPrice"] = "單價",
            ["Amount"] = "金額",
            ["SalesAmount"] = "銷售金額",
            ["TotalAmount"] = "總金額",
            ["InvoiceNo"] = "發票號碼",
            ["Description"] = "說明",
            ["SerialNo"] = "序號",
            ["MfrSerialNo"] = "製造商序號",
            ["Status"] = "狀態",
            ["Technician"] = "技術人員",
            ["Delivery"] = "交貨方式",
            ["Date"] = "日期",
            ["Time"] = "時間",
            ["Active"] = "啟用狀態",
            ["Returned"] = "退貨狀態",
            ["Terminated"] = "終止日期",
            ["Service Contracts"] = "服務合約",
            ["Service Contracts:"] = "服務合約：",
            ["Contract"] = "合約",
            ["Start Date"] = "合約起始日",
            ["End Date"] = "合約到期日",
            ["Service Type"] = "服務類型",
            ["Service Calls"] = "服務案件",
            ["Service Calls:"] = "服務案件：",
            ["Call ID"] = "服務案件編號",
            ["Creation Date"] = "建立日期",
            ["Subject"] = "主旨",
            ["Item No."] = "產品編號",
            ["Serial Number"] = "序號",
            ["Customer Name"] = "客戶名稱",
            ["DocDate"] = "單據日期",
            ["DocNum"] = "單據編號",
            ["EmpName"] = "員工姓名",
            ["ProductCode"] = "商品代碼",
            ["Qty"] = "數量",
            ["Discount"] = "折扣",
            ["LineTotal"] = "明細金額",
            ["顯示輸入參數:"] = "顯示輸入參數："
        };

    private static readonly Dictionary<string, string> WordTranslations =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["Customer"] = "客戶", ["Contact"] = "聯絡", ["Person"] = "人",
            ["Phone"] = "電話", ["No"] = "編號", ["Item"] = "商品",
            ["Product"] = "商品", ["Name"] = "名稱", ["Code"] = "代碼",
            ["Category"] = "類別", ["Member"] = "會員", ["Level"] = "等級",
            ["Payment"] = "付款", ["Pay"] = "付款", ["Store"] = "門市",
            ["Sale"] = "銷售", ["Sales"] = "銷售", ["Date"] = "日期",
            ["Start"] = "開始", ["End"] = "結束", ["Quantity"] = "數量",
            ["Unit"] = "單位", ["Price"] = "單價", ["Amount"] = "金額",
            ["Total"] = "總計", ["Serial"] = "序號", ["Number"] = "編號",
            ["Status"] = "狀態", ["Technician"] = "技術人員", ["Delivery"] = "交貨",
            ["Description"] = "說明", ["Creation"] = "建立", ["Call"] = "案件",
            ["Contract"] = "合約", ["Service"] = "服務", ["Type"] = "類型",
            ["Subject"] = "主旨", ["Doc"] = "單據", ["Emp"] = "員工",
            ["Qty"] = "數量", ["Discount"] = "折扣", ["Line"] = "明細",
            ["Active"] = "啟用", ["Returned"] = "退貨", ["Terminated"] = "終止",
            ["Mfr"] = "製造商", ["Time"] = "時間"
        };

    public static Dictionary<string, string> BuildReplacements(
        string? mappingsJson,
        IEnumerable<string>? detectedSourceTexts = null)
    {
        List<ReportColumnHeaderMappingDto> mappings;
        try
        {
            mappings = JsonSerializer.Deserialize<List<ReportColumnHeaderMappingDto>>(
                mappingsJson ?? "[]") ?? [];
        }
        catch (JsonException)
        {
            mappings = [];
        }

        var replacements = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var mapping in mappings)
        {
            var source = mapping.SourceText?.Trim();
            if (string.IsNullOrWhiteSpace(source))
            {
                continue;
            }

            var displayName = !string.IsNullOrWhiteSpace(mapping.DisplayName)
                ? mapping.DisplayName.Trim()
                : GetDefaultTranslation(source);
            if (!string.IsNullOrWhiteSpace(displayName))
            {
                replacements[source] = displayName;
            }
        }

        foreach (var sourceText in detectedSourceTexts ?? [])
        {
            var source = sourceText?.Trim();
            if (string.IsNullOrWhiteSpace(source) || replacements.ContainsKey(source))
            {
                continue;
            }

            var displayName = GetDefaultTranslation(source);
            if (!string.IsNullOrWhiteSpace(displayName))
            {
                replacements[source] = displayName;
            }
        }

        return replacements;
    }

    public static string GetDefaultTranslation(string sourceText)
    {
        var normalized = sourceText.Trim();
        if (ExactTranslations.TryGetValue(normalized, out var translation))
        {
            return translation;
        }

        if (normalized.StartsWith("Title_", StringComparison.OrdinalIgnoreCase))
        {
            normalized = normalized[6..];
        }
        else if (string.Equals(normalized, "Title", StringComparison.OrdinalIgnoreCase))
        {
            return "報表標題";
        }

        if (ExactTranslations.TryGetValue(normalized, out translation))
        {
            return translation;
        }

        normalized = Regex.Replace(normalized, "([a-z0-9])([A-Z])", "$1 $2");
        normalized = Regex.Replace(normalized, "[^\\p{L}\\p{Nd}]+", " ").Trim();
        if (normalized.Length == 0)
        {
            return string.Empty;
        }

        var translatedWords = new List<string>();
        foreach (var word in normalized.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            if (!WordTranslations.TryGetValue(word, out translation))
            {
                return string.Empty;
            }

            translatedWords.Add(translation);
        }

        return string.Concat(translatedWords);
    }
}
