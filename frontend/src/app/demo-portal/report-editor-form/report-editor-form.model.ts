export interface ReportEditorDraft {
  ReportCode?: string;
  ReportName: string;
  Description: string;
  CategoryId: string;
  /** Empty means the RPT is published from its embedded Saved Data. */
  DataSourceId?: string;
  Enabled: boolean;
}
