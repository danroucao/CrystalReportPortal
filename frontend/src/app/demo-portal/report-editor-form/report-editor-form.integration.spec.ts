import { NgZone } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { MockRbacService } from '../../services/mock-rbac.service';
import { MockNotificationCenterService } from '../../services/mock-notification-center.service';
import { DemoPortalComponent } from '../demo-portal.component';
import { LoginFrontManager } from '../testing/demo-portal.spec-helpers';

import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';

import {
  provideHttpClientTesting,
} from '@angular/common/http/testing';

// TODO: Rewrite for the real RPT upload, parameter configuration,
// test-preview and approval workflow.
xdescribe('Report editor form integration', () => {
  let fixture: ComponentFixture<DemoPortalComponent>;
  let Host: HTMLElement;
  let Zone: NgZone;
  let Rbac: MockRbacService;

  async function Open(Page: 'ReportUpload' | 'RptManagement'): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [DemoPortalComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { Page } } },
        }
      ],
    }).compileComponents();
    Rbac = TestBed.inject(MockRbacService);
    const Permissions = Rbac.GetCategoryPermissionEntries('FINANCE');
    Rbac.UpdateRole('FINANCE', { DisplayName: '財務人員', ManagementPermissions: ['RptManagement'], Permissions });
    expect(LoginFrontManager(TestBed.inject(AuthService))).toBeTrue();
    Zone = TestBed.inject(NgZone);
    fixture = TestBed.createComponent(DemoPortalComponent);
    Host = fixture.nativeElement;
    fixture.autoDetectChanges();
    await fixture.whenStable();
  }

  function Element<T extends HTMLElement>(Selector: string): T {
    const Match = Host.querySelector<T>(Selector);
    if (!Match) throw new Error(`Missing rendered control: ${Selector}`);
    return Match;
  }

  async function Click(Selector: string): Promise<void> {
    Zone.run(() => {
      const Control = Element(Selector);
      Control.focus();
      Control.click();
    });
    await fixture.whenStable();
  }

  async function Fill(Selector: string, Value: string): Promise<void> {
    Zone.run(() => {
      const Control = Element<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(Selector);
      Control.focus();
      Control.value = Value;
      Control.dispatchEvent(new Event(Control instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    });
    await fixture.whenStable();
  }

  async function ChooseFile(Selector: string, Name: string): Promise<void> {
    Zone.run(() => {
      const Input = Element<HTMLInputElement>(Selector);
      const Transfer = new DataTransfer();
      Transfer.items.add(new File(['test fixture'], Name));
      Input.files = Transfer.files;
      Input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await fixture.whenStable();
  }

  afterEach(() => fixture?.destroy());

  it('validates and publishes through upload controls, preserving the draft when returning from review', async () => {
    await Open('ReportUpload');
    await Click('.report-upload-form button[type="submit"]');
    expect(Element('.report-upload-error').textContent).toContain('請輸入報表名稱。');
    await Fill('#report-upload-name', 'Editor extraction upload');
    await Click('.report-upload-form button[type="submit"]');
    expect(Element('.report-upload-error').textContent).toContain('請輸入報表說明。');
    expect(Element('#report-upload-description').getAttribute('aria-invalid')).toBeNull();
    expect(Element('#report-upload-description').getAttribute('maxlength')).toBe('500');
    await Fill('#report-upload-description', 'x'.repeat(501));
    expect(Element('#report-upload-description').classList.contains('ng-invalid')).toBeTrue();
    await Fill('#report-upload-description', 'Retained description');
    await Click('.report-upload-form button[type="submit"]');
    expect(Element('.report-upload-error').textContent).toContain('請選擇報表分類。');
    await Fill('#report-upload-category', 'FINANCE');
    await Click('.report-upload-form button[type="submit"]');
    expect(Element('.report-upload-error').textContent).toContain('請選擇 RPT 報表檔案。');
    await ChooseFile('#report-upload-file', 'invalid.txt');
    expect(Element('.report-upload-error').textContent).toContain('僅允許上傳 .rpt 報表檔案。');
    expect(Element<HTMLInputElement>('#report-upload-file').value).toBe('');
    await ChooseFile('#report-upload-file', 'retained.RPT');
    await Click('.report-upload-enabled [role="switch"]');
    expect(Element('.report-upload-enabled [role="switch"]').getAttribute('aria-checked')).toBe('true');
    const Count = Rbac.Reports.length;
    await Click('.report-upload-form button[type="submit"]');
    expect(Element('.report-upload-review').textContent).toContain('retained.RPT');
    expect(Rbac.Reports.length).toBe(Count);
    await Click('.report-upload-review .report-upload-secondary-action');
    expect(Element<HTMLInputElement>('#report-upload-name').value).toBe('Editor extraction upload');
    expect(Element<HTMLTextAreaElement>('#report-upload-description').value).toBe('Retained description');
    expect(Element<HTMLSelectElement>('#report-upload-category').value).toBe('FINANCE');
    expect(Element('.report-upload-selected-file').textContent).toContain('retained.RPT');
    await Click('.report-upload-form button[type="submit"]');
    await Click('.report-upload-review .primary-button');
    expect(Element('.report-upload-complete').textContent).toContain('Editor extraction upload');
    expect(Rbac.Reports.length).toBe(Count + 1);
    expect(Rbac.Reports.find(Report => Report.ReportName === 'Editor extraction upload')?.FileName).toBe('retained.RPT');
  });

  for (const Page of ['ReportUpload', 'RptManagement'] as const) {
    it(`preserves controls and creates categories through quick-add in ${Page}`, async () => {
      await Open(Page);
      const IsUpload = Page === 'ReportUpload';
      if (!IsUpload) await Click('.report-row-actions button[title="編輯報表"]');
      const Prefix = IsUpload ? '#report-upload' : '#report-editor';
      const Trigger = IsUpload ? '.report-upload-add-category' : '.report-category-quick-add-trigger';
      const QuickInput = IsUpload ? '#report-upload-category-add' : '#report-category-quick-add-name';
      await Fill(Prefix + '-name', 'Stable editor draft');
      await ChooseFile(Prefix + '-file', 'stable.rpt');
      const NameInput = Element<HTMLInputElement>(Prefix + '-name');
      const FileInput = Element<HTMLInputElement>(Prefix + '-file');
      const Option = Element(Prefix + '-category option[value="FINANCE"]');
      await Click(Trigger);
      await Click('.report-category-quick-add-actions .primary-button');
      expect(Element('.report-category-quick-add .field-error').textContent).toContain('請輸入報表分類名稱。');
      await Fill(QuickInput, '財務');
      expect(Host.querySelector('.report-category-quick-add .field-error')).toBeNull();
      await Click('.report-category-quick-add-actions .primary-button');
      expect(Element('.report-category-quick-add .field-error').textContent).toContain('此報表分類已存在。');
      await Fill(QuickInput, `Quick category ${Page}`);
      const Enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      Zone.run(() => Element(QuickInput).dispatchEvent(Enter));
      await fixture.whenStable();
      expect(Enter.defaultPrevented).toBe(!IsUpload);
      if (IsUpload) await Click('.report-category-quick-add-actions .primary-button');
      const Category = Rbac.GetCategories().find(Item => Item.CategoryName === `Quick category ${Page}`)!;
      expect(Element<HTMLSelectElement>(Prefix + '-category').value).toBe(Category.CategoryId);
      expect(Host.querySelector('.report-category-quick-add')).toBeNull();
      expect(Element(Prefix + '-name')).toBe(NameInput);
      expect(NameInput.value).toBe('Stable editor draft');
      expect(Element(Prefix + '-file')).toBe(FileInput);
      expect(FileInput.files?.item(0)?.name).toBe('stable.rpt');
      expect(Element(Prefix + '-category option[value="FINANCE"]')).toBe(Option);
      expect(TestBed.inject(MockNotificationCenterService).GetNotifications('admin@example.com')
        .some(Item => Item.Summary.includes(Category.CategoryName))).toBeTrue();
      for (let Round = 0; Round < 2; Round++) {
        await Click(Trigger);
        await Fill(QuickInput, 'Cancelled category');
        if (Round === 0) {
          Zone.run(() => Element(QuickInput).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
          await fixture.whenStable();
        } else {
          await Click('.report-category-quick-add-actions .secondary-button');
        }
        expect(Host.querySelector('.report-category-quick-add')).toBeNull();
        expect(Element(Prefix + '-name')).toBe(NameInput);
        expect(Element(Prefix + '-file')).toBe(FileInput);
      }
    });
  }

  it('saves modal edits and restores focus through repeated discard and reopen interactions', async () => {
    await Open('RptManagement');
    const Opener = Element<HTMLButtonElement>('.report-row-actions button[title="編輯報表"]');
    Zone.run(() => Opener.focus());
    await Click('.report-row-actions button[title="編輯報表"]');
    const Key = fixture.componentInstance.EditingReportKey!;
    const FileName = fixture.componentInstance.SelectedReportFileName;
    const Description = Element<HTMLTextAreaElement>('#report-editor-description');
    expect(Description.getAttribute('maxlength')).toBeNull();
    Zone.run(() => {
      const Cancel = Element('.report-editor-actions button[type="button"]');
      Cancel.focus();
      Cancel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    });
    await fixture.whenStable();
    const Close = Element('.report-editor-modal .modal-close-button');
    expect(document.activeElement).toBe(Close);
    Zone.run(() => Close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })));
    await fixture.whenStable();
    expect(document.activeElement).toBe(Element('.report-editor-actions button[type="button"]'));
    await Fill('#report-editor-description', '');
    await Click('.report-editor-form button[type="submit"]');
    expect(Description.getAttribute('aria-invalid')).toBe('true');
    await Fill('#report-editor-description', 'Saved via extracted editor');
    await Click('.report-editor-form button[type="submit"]');
    expect(Rbac.GetReport(Key)?.Description).toBe('Saved via extracted editor');
    expect(Rbac.GetReport(Key)?.FileName).toBe(FileName);
    expect(Host.querySelector('.report-editor-modal')).toBeNull();
    expect(document.activeElement).toBe(Opener);

    for (let Round = 0; Round < 2; Round++) {
      await Click('.report-row-actions button[title="編輯報表"]');
      await Fill('#report-editor-description', `Unsaved ${Round}`);
      const DraftInput = Element<HTMLTextAreaElement>('#report-editor-description');
      const FocusTarget = Element<HTMLButtonElement>('.report-editor-actions button[type="button"]');
      Zone.run(() => {
        FocusTarget.focus();
        FocusTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      await fixture.whenStable();
      expect(Element('.report-editor-modal').hasAttribute('inert')).toBeTrue();
      const Continue = Element('.report-discard-confirmation-modal .secondary-button');
      expect(document.activeElement).toBe(Continue);
      Zone.run(() => {
        const Discard = Element('.report-discard-confirmation-modal .danger-button');
        Discard.focus();
        Discard.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
      });
      await fixture.whenStable();
      expect(document.activeElement).toBe(Continue);
      await Click('.report-discard-confirmation-modal .secondary-button');
      expect(Element('#report-editor-description')).toBe(DraftInput);
      expect(DraftInput.value).toBe(`Unsaved ${Round}`);
      expect(document.activeElement).toBe(FocusTarget);
      await Click('.report-editor-modal .modal-close-button');
      await Click('.report-discard-confirmation-modal .danger-button');
      expect(Host.querySelector('.report-editor-modal')).toBeNull();
      expect(document.activeElement).toBe(Opener);
      expect(Rbac.GetReport(Key)?.Description).toBe('Saved via extracted editor');
    }
  });
});
