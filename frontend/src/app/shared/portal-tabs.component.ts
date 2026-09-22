import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  QueryList,
  ViewChildren,
} from '@angular/core';

export interface PortalTab {
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
}

@Component({
  selector: 'app-portal-tabs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './portal-tabs.component.html',
  styleUrl: './portal-tabs.component.scss',
})
export class PortalTabsComponent {
  @Input({ required: true }) Tabs: readonly PortalTab[] = [];
  @Input({ required: true }) ActiveTab = '';
  @Input({ required: true }) AriaLabel = '';
  @Output() readonly TabChange = new EventEmitter<string>();
  @ViewChildren('tabButton') private readonly tabButtons?: QueryList<ElementRef<HTMLButtonElement>>;

  select(Tab: PortalTab): void {
    if (Tab.disabled || Tab.id === this.ActiveTab) return;
    this.TabChange.emit(Tab.id);
  }

  trackTab(_: number, Tab: PortalTab): string {
    return Tab.id;
  }

  onKeydown(Event: KeyboardEvent, Index: number): void {
    const TargetIndex = this.getTargetIndex(Event.key, Index);
    if (TargetIndex === null) return;
    Event.preventDefault();
    const Tab = this.Tabs[TargetIndex];
    this.select(Tab);
    this.tabButtons?.get(TargetIndex)?.nativeElement.focus();
  }

  private getTargetIndex(Key: string, CurrentIndex: number): number | null {
    const EnabledIndexes = this.Tabs
      .map((Tab, Index) => Tab.disabled ? -1 : Index)
      .filter((Index) => Index >= 0);
    if (!EnabledIndexes.length) return null;
    if (Key === 'Home') return EnabledIndexes[0];
    if (Key === 'End') return EnabledIndexes[EnabledIndexes.length - 1];
    const Direction = Key === 'ArrowRight' || Key === 'ArrowDown'
      ? 1
      : Key === 'ArrowLeft' || Key === 'ArrowUp'
        ? -1
        : 0;
    if (!Direction) return null;
    const Position = EnabledIndexes.indexOf(CurrentIndex);
    const NormalizedPosition = Position < 0 ? 0 : Position;
    return EnabledIndexes[
      (NormalizedPosition + Direction + EnabledIndexes.length) % EnabledIndexes.length
    ];
  }
}
