import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortalTwoTabSegmentedControlComponent } from './portal-two-tab-segmented-control.component';

describe('PortalTwoTabSegmentedControlComponent', () => {
  let component: PortalTwoTabSegmentedControlComponent;
  let fixture: ComponentFixture<PortalTwoTabSegmentedControlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortalTwoTabSegmentedControlComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PortalTwoTabSegmentedControlComponent);
    component = fixture.componentInstance;
    component.Tabs = [
      { Value: 'recent', Label: '最近 180 天' },
      { Value: 'archived', Label: '封存紀錄' },
    ];
    component.SelectedValue = 'recent';
    component.AriaLabel = '操作紀錄檢視模式';
    fixture.detectChanges();
  });

  it('renders two accessible choices and identifies the selected value', () => {
    const tabs = fixture.nativeElement.querySelectorAll<HTMLButtonElement>('[role="radio"]');

    expect(tabs).toHaveSize(2);
    expect(tabs[0].textContent?.trim()).toBe('最近 180 天');
    expect(tabs[0].getAttribute('aria-checked')).toBe('true');
    expect(tabs[1].getAttribute('aria-checked')).toBe('false');
  });

  it('emits a different selection when a tab is clicked', () => {
    const SelectionChange = spyOn(component.SelectedValueChange, 'emit');

    fixture.nativeElement.querySelectorAll<HTMLButtonElement>('[role="radio"]')[1].click();

    expect(SelectionChange).toHaveBeenCalledWith('archived');
  });

  it('supports arrow-key choice switching', () => {
    const SelectionChange = spyOn(component.SelectedValueChange, 'emit');
    const selectedTab = fixture.nativeElement.querySelector<HTMLButtonElement>('[role="radio"]');

    selectedTab?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));

    expect(SelectionChange).toHaveBeenCalledWith('archived');
  });
});
