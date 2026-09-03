namespace CrystalReportPortal.CrystalService.Models
{
    public class ReportParameterInfo
    {
        public string Name { get; set; }
        public string PromptText { get; set; }
        public string ValueType { get; set; }
        public bool AllowMultipleValues { get; set; }
        public bool AllowRangeValues { get; set; }
        public bool IsOptional { get; set; }
    }
}