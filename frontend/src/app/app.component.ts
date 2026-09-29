import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EMPTY, Subscription, catchError, exhaustMap, filter, timer } from 'rxjs';

import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private sessionValidation?: Subscription;

  ngOnInit(): void {
    this.sessionValidation = timer(0, 30_000).pipe(
      filter(() => this.auth.IsFrontOffice && document.visibilityState === 'visible'),
      exhaustMap(() => this.auth.ValidateSession().pipe(catchError(() => EMPTY))),
    ).subscribe();
  }

  ngOnDestroy(): void {
    this.sessionValidation?.unsubscribe();
  }
}
