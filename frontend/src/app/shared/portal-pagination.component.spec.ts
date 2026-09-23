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

    expect(fixture.nativeElement.querySelectorAll('.list-pagination button')).toHaveSize(7);
    expect(fixture.nativeElement.querySelector('.list-pagination-ellipsis')?.textContent.trim()).toBe('…');
  });
});
