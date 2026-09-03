using System.Collections.Generic;

namespace CrystalReportPortal.CrystalService.Models
{
    public class CrystalExportRequest
    {
        public string RptPath { get; set; }

        public string OutputPath { get; set; }

        public CrystalDatabaseConfig Database { get; set; }

        public List<CrystalExportParameter> Parameters { get; set; }
            = new List<CrystalExportParameter>();
    }
}