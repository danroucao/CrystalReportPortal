import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BoringAvatarBeamModule } from 'ngx-boring-avatars';

// ngx-boring-avatars 1.x exposes a separate component for each variant.
@Component({
  selector: 'ngx-boring-avatar',
  standalone: true,
  imports: [BoringAvatarBeamModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <ngx-boring-avatar-beam
      [name]="name"
      [width]="size"
      [colors]="colors"
    />
  `,
  styles: [
    ':host { display: inline-flex; flex: 0 0 auto; overflow: hidden; border-radius: 50%; line-height: 0; }',
  ],
})
export class BoringAvatarComponent {
  @Input({ required: true }) name = '';
  @Input() variant: 'beam' = 'beam';
  @Input() size = 40;

  readonly colors = ['#006a70', '#26bfb5', '#ff9b0b', '#ffdc32', '#e8edb0'];
}
