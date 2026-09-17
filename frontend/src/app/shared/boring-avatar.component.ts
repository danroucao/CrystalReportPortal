import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';

@Component({
  selector: 'ngx-boring-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
  },
  template: `
    <span
      class="avatar"
      [style.width.px]="size"
      [style.height.px]="size"
      [style.font-size.px]="fontSize"
      [style.background]="backgroundColor"
    >
      {{ initials }}
    </span>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        flex: 0 0 auto;
        line-height: 1;
      }

      .avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border-radius: 50%;
        color: #ffffff;
        font-weight: 700;
        user-select: none;
      }
    `,
  ],
})
export class BoringAvatarComponent {
  @Input({ required: true }) name = '';
  @Input() variant: 'beam' = 'beam';
  @Input() size = 40;

  private readonly colors = [
    '#006a70',
    '#26bfb5',
    '#d97706',
    '#7c3aed',
    '#2563eb',
  ];

  get initials(): string {
    const normalizedName = this.name.trim();

    if (!normalizedName) {
      return '?';
    }

    const parts = normalizedName.split(/\s+/);

    if (parts.length > 1) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }

    return normalizedName.slice(0, 2).toUpperCase();
  }

  get fontSize(): number {
    return Math.max(12, Math.round(this.size * 0.36));
  }

  get backgroundColor(): string {
    const hash = Array.from(this.name).reduce(
      (result, character) => result + character.charCodeAt(0),
      0,
    );

    return this.colors[hash % this.colors.length];
  }
}