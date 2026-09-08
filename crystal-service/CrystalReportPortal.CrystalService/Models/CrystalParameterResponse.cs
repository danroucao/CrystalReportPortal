using System.Collections.Generic;

namespace CrystalReportPortal.CrystalService.Models
{
    public class CrystalParameterResponse
    {
        public bool Success { get; set; }

        public string Message { get; set; }

        public List<ReportParameterInfo> Parameters { get; set; }
            = new List<ReportParameterInfo>();
    }
}