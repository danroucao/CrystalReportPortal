import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface PortalTwoTabOption {
  readonly Value: string;
  readonly Label: string;
  readonly Disabled?: boolean;
}

@Component({
  selector: 'app-portal-two-tab-segmented-control',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './portal-two-tab-segmented-control.component.html',
  styleUrl: './portal-two-tab-segmented-control.component.scss',
})
export class PortalTwoTabSegmentedControlComponent {
  @Input({ required: true }) Tabs: readonly [PortalTwoTabOption, PortalTwoTabOption] = [
    { Value: '', Label: '' },
    { Value: '', Label: '' },
  ];
  @Input({ required: true }) SelectedValue = '';
  @Input({ required: true }) AriaLabel = '';
  @Output() readonly SelectedValueChange = new EventEmitter<string>();

  Select(Tab: PortalTwoTabOption): void {
    if (Tab.Disabled || Tab.Value === this.SelectedValue) return;
    this.SelectedValueChange.emit(Tab.Value);
  }

  OnTabKeydown(Event: KeyboardEvent, Index: number): void {
    const Direction = Event.key === 'ArrowRight' || Event.key === 'ArrowDown'
      ? 1
      : Event.key === 'ArrowLeft' || Event.key === 'ArrowUp'
        ? -1
        : 0;
    if (!Direction) return;

    Event.preventDefault();
    const EnabledIndexes = this.Tabs
      .map((Tab, TabIndex) => Tab.Disabled ? -1 : TabIndex)
      .filter((TabIndex) => TabIndex >= 0);
    if (!EnabledIndexes.length) return;
    const CurrentEnabledIndex = EnabledIndexes.indexOf(Index);
    const NextIndex = EnabledIndexes[(CurrentEnabledIndex + Direction + EnabledIndexes.length) % EnabledIndexes.length];
    const NextTab = this.Tabs[NextIndex];
    this.Select(NextTab);
    (Event.currentTarget as HTMLElement)
      .closest('.portal-two-tab-segmented-control')
      ?.querySelectorAll<HTMLButtonElement>('button')[NextIndex]
      ?.focus();
  }
}
