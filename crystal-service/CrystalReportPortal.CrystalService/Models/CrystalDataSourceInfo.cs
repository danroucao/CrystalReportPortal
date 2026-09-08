using System.Collections.Generic;

namespace CrystalReportPortal.CrystalService.Models
{
	public class CrystalDataSourceInfo
	{
		public string TableName { get; set; }

		public string Location { get; set; }

		public string ServerName { get; set; }

		public string DatabaseName { get; set; }

		public string UserId { get; set; }

		public bool IntegratedSecurity { get; set; }

		public Dictionary<string, string> Attributes { get; set; }
			= new Dictionary<string, string>();
	}
}