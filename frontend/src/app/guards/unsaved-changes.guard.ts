import { CanDeactivateFn } from '@angular/router';
import { Observable } from 'rxjs';

export interface UnsavedChangesAware {
  CanLeavePage(): boolean | Observable<boolean>;
}

export const unsavedChangesGuard: CanDeactivateFn<UnsavedChangesAware> = (component) =>
  component.CanLeavePage();
