import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../services/auth.service';
import {
  MockDatabaseConnection,
  MockDatabaseConnectionDraft,
  MockDatabaseConnectionService,
} from '../../services/mock-database-connection.service';
import { NotificationService } from '../../services/notification.service';
import { UnsavedChangesDialogComponent } from '../../shared/unsaved-changes-dialog.component';

@Component({
  selector: 'app-database-connection-page',
  standalone: true,
  imports: [CommonModule, FormsModule, UnsavedChangesDialogComponent],
  templateUrl: './database-connection-page.component.html',
  styleUrl: './database-connection-page.component.scss',
})
export class DatabaseConnectionPageComponent {
  readonly Auth = inject(AuthService);
  readonly DatabaseConnections = inject(MockDatabaseConnectionService);
  private readonly Notifications = inject(NotificationService);

  DatabaseConnectionDraft: MockDatabaseConnectionDraft =
    this.CreateDatabaseConnectionDraft();
  EditingDatabaseConnectionKey: string | null = null;
  IsDatabaseConnectionEditorOpen = false;
  IsDatabaseConnectionDiscardConfirmationOpen = false;
  DatabaseConnectionFormError = '';
  private DatabaseConnectionInitialDraft: MockDatabaseConnectionDraft | null = null;

  OpenCreateDatabaseConnection(): void {
    if (!this.Auth.HasManagementPermission('DatabaseConnection')) return;
    this.EditingDatabaseConnectionKey = null;
    this.DatabaseConnectionDraft = this.CreateDatabaseConnectionDraft();
    this.DatabaseConnectionInitialDraft = { ...this.DatabaseConnectionDraft };
    this.DatabaseConnectionFormError = '';
    this.IsDatabaseConnectionEditorOpen = true;
  }

  OpenEditDatabaseConnection(Key: string): void {
    if (!this.Auth.HasManagementPermission('DatabaseConnection')) return;
    const Connection = this.DatabaseConnections.GetConnection(Key);
    if (!Connection) return;
    this.EditingDatabaseConnectionKey = Key;
    this.DatabaseConnectionDraft = {
      DataSourceName: Connection.DataSourceName,
      ServerHost: Connection.ServerHost,
      Port: Connection.Port,
      DatabaseName: Connection.DatabaseName,
      Username: Connection.Username,
      ConnectionType: Connection.ConnectionType,
      Enabled: Connection.Enabled,
      Password: '',
    };
    this.DatabaseConnectionFormError = '';
    this.DatabaseConnectionInitialDraft = { ...this.DatabaseConnectionDraft };
    this.IsDatabaseConnectionEditorOpen = true;
  }

  ToggleDatabaseConnectionEnabled(Connection: MockDatabaseConnection): void {
    if (!this.Auth.HasManagementPermission('DatabaseConnection')) return;
    const Enabled = !Connection.Enabled;
    const IsUpdated = this.DatabaseConnections.Update(Connection.Key, {
      ...Connection,
      Enabled,
      Password: '',
    });
    if (!IsUpdated) return;
    this.ShowSuccessToast(`資料庫連線「${Connection.DataSourceName}」已${Enabled ? '啟用' : '停用'}。`);
  }

  TrackDatabaseConnection(_: number, Connection: MockDatabaseConnection): string {
    return Connection.Key;
  }

  RequestCloseDatabaseConnectionEditor(): void {
    if (!this.IsDatabaseConnectionEditorDirty()) {
      this.CloseDatabaseConnectionEditor();
      return;
    }
    this.IsDatabaseConnectionDiscardConfirmationOpen = true;
  }

  ContinueEditingDatabaseConnection(): void {
    this.IsDatabaseConnectionDiscardConfirmationOpen = false;
  }

  DiscardDatabaseConnectionChanges(): void {
    this.IsDatabaseConnectionDiscardConfirmationOpen = false;
    this.CloseDatabaseConnectionEditor();
  }

  CloseDatabaseConnectionEditor(): void {
    this.IsDatabaseConnectionEditorOpen = false;
    this.IsDatabaseConnectionDiscardConfirmationOpen = false;
    this.EditingDatabaseConnectionKey = null;
    this.DatabaseConnectionDraft = this.CreateDatabaseConnectionDraft();
    this.DatabaseConnectionInitialDraft = null;
    this.DatabaseConnectionFormError = '';
  }

  SaveDatabaseConnection(): void {
    if (!this.Auth.HasManagementPermission('DatabaseConnection')) return;
    this.DatabaseConnectionFormError = '';
    const IsEditing = this.EditingDatabaseConnectionKey !== null;
    const IsSaved = IsEditing
      ? this.DatabaseConnections.Update(
          this.EditingDatabaseConnectionKey!,
          this.DatabaseConnectionDraft,
        )
      : this.DatabaseConnections.Create(this.DatabaseConnectionDraft);
    if (!IsSaved) {
      this.DatabaseConnectionFormError = IsEditing
        ? '請確認資料來源、主機、連接埠、資料庫與帳號。'
        : '建立連線時請填寫資料來源、主機、連接埠、資料庫、帳號與密碼。';
      return;
    }
    this.CloseDatabaseConnectionEditor();
    this.ShowSuccessToast(
      IsEditing
        ? 'Mock 資料庫連線已更新；既有密碼未回填或保存於前端。'
        : 'Mock 資料庫連線已建立；密碼不會保存於前端 Mock 資料。',
    );
  }

  private CreateDatabaseConnectionDraft(): MockDatabaseConnectionDraft {
    return {
      DataSourceName: '',
      ServerHost: '',
      Port: '1433',
      DatabaseName: '',
      Username: '',
      ConnectionType: 'ReadOnly',
      Enabled: true,
      Password: '',
    };
  }

  private IsDatabaseConnectionEditorDirty(): boolean {
    const Initial = this.DatabaseConnectionInitialDraft;
    const Draft = this.DatabaseConnectionDraft;
    return Boolean(
      Initial &&
        (Initial.DataSourceName !== Draft.DataSourceName ||
          Initial.ServerHost !== Draft.ServerHost ||
          Initial.Port !== Draft.Port ||
          Initial.DatabaseName !== Draft.DatabaseName ||
          Initial.Username !== Draft.Username ||
          Initial.ConnectionType !== Draft.ConnectionType ||
          Initial.Enabled !== Draft.Enabled ||
          Initial.Password !== Draft.Password),
    );
  }

  HasUnsavedChanges(): boolean {
    return this.IsDatabaseConnectionEditorOpen && this.IsDatabaseConnectionEditorDirty();
  }

  private ShowSuccessToast(Message: string): void {
    this.Notifications.ShowSuccess(Message);
  }
}
