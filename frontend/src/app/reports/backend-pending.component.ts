import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { PortalLayoutComponent } from './portal-layout.component';

@Component({
  selector: 'app-backend-pending',
  standalone: true,
  imports: [PortalLayoutComponent],
  template: `<app-portal-layout><main class="pending"><h1>{{ title }}</h1><p>此功能尚未串接後端 API，因此不提供測試資料。</p></main></app-portal-layout>`,
  styles: ['.pending{max-width:900px;margin:0 auto}.pending h1{margin-top:0}'],
})
export class BackendPendingComponent {
  private readonly route = inject(ActivatedRoute);
  readonly title = this.route.snapshot.data['title'] as string;
}
