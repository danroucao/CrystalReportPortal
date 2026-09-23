import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortalPaginationComponent } from './portal-pagination.component';

describe('PortalPaginationComponent', () => {
  let fixture: ComponentFixture<PortalPaginationComponent>;
  let component: PortalPaginationComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(PortalPaginationComponent);
    component = fixture.componentInstance;
    component.AriaLabel = '清單分頁';
    component.PageNumbers = Array.from({ length: 29 }, (_, index) => index + 1);
  });

  it('keeps the first and last pages while condensing a long page list', () => {
    component.TotalPages = 29;
    component.CurrentPage = 1;

    expect(component.VisiblePageItems).toEqual([1, 2, 3, 4, 5, 'ellipsis', 29]);

    component.CurrentPage = 15;
    expect(component.VisiblePageItems).toEqual([1, 'ellipsis', 14, 15, 16, 'ellipsis', 29]);
  });

  it('renders an ellipsis as non-interactive text', () => {
    component.TotalPages = 29;
    component.CurrentPage = 15;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.list-pagination button')).toHaveSize(8);
    expect(fixture.nativeElement.querySelector('.list-pagination-ellipsis')?.textContent.trim()).toBe('…');
  });

  it('emits the requested page only when it is a valid page number', () => {
    component.TotalPages = 29;
    component.CurrentPage = 1;
    const pageChange = jasmine.createSpy('pageChange');
    component.PageChange.subscribe(pageChange);

    component.SelectPageValue('18');
    component.SelectPageValue('30');
    component.SelectPageValue('1.5');

    expect(pageChange).toHaveBeenCalledOnceWith(18);
  });
});
