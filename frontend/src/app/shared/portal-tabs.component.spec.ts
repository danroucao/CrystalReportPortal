import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortalTabsComponent } from './portal-tabs.component';

describe('PortalTabsComponent', () => {
  let fixture: ComponentFixture<PortalTabsComponent>;
  let component: PortalTabsComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PortalTabsComponent] });
    fixture = TestBed.createComponent(PortalTabsComponent);
    component = fixture.componentInstance;
    component.AriaLabel = '測試頁籤';
    component.ActiveTab = 'all';
    component.Tabs = [
      { id: 'all', label: '全部 (13)' },
      { id: 'finance', label: '財務人員 (5)' },
    ];
    fixture.detectChanges();
  });

  it('renders the active tab and emits a selected tab id', () => {
    const emitted: string[] = [];
    component.TabChange.subscribe((id) => emitted.push(id));
    const buttons = fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>;

    expect(buttons).toHaveSize(2);
    expect(buttons[0].getAttribute('aria-selected')).toBe('true');
    buttons[1].click();

    expect(emitted).toEqual(['finance']);
  });

  it('moves selection with arrow keys while skipping disabled tabs', () => {
    component.Tabs = [
      { id: 'all', label: '全部 (13)' },
      { id: 'finance', label: '財務人員 (5)', disabled: true },
      { id: 'procurement', label: '採購人員 (5)' },
    ];
    fixture.detectChanges();
    const emitted: string[] = [];
    component.TabChange.subscribe((id) => emitted.push(id));
    const buttons = fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>;

    buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));

    expect(emitted).toEqual(['procurement']);
  });
});
