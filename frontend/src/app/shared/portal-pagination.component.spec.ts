import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortalPaginationComponent } from './portal-pagination.component';

describe('PortalPaginationComponent', () => {
  let component: PortalPaginationComponent;
  let fixture: ComponentFixture<PortalPaginationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortalPaginationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PortalPaginationComponent);
    component = fixture.componentInstance;
    component.CurrentPage = 2;
    component.TotalPages = 5;
    component.PageNumbers = [1, 2, 3, 4, 5];
    fixture.detectChanges();
  });

  it('renders the shared pagination controls with the current page marked', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('.list-pagination__page')).toHaveSize(5);
    expect(host.querySelector('.list-pagination__page.is-active')?.getAttribute('aria-current')).toBe('page');
    expect(host.querySelector('.list-pagination__jump input')).not.toBeNull();
  });

  it('emits a valid page when the direct page control is submitted', () => {
    const pageChange = spyOn(component.PageChange, 'emit');
    component.JumpPage = 5;

    component.GoToRequestedPage();

    expect(pageChange).toHaveBeenCalledWith(5);
  });

  it('clamps an out-of-range direct page value before emitting it', () => {
    const pageChange = spyOn(component.PageChange, 'emit');
    component.JumpPage = 100;

    component.GoToRequestedPage();

    expect(component.JumpPage).toBe(5);
    expect(pageChange).toHaveBeenCalledWith(5);
  });
});
