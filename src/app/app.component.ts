import { Component, OnInit, inject } from '@angular/core';
import { StorageService } from './services/storage.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  private storageService = inject(StorageService);

  async ngOnInit(): Promise<void> {
    const isDark = await this.storageService.isDarkMode();
    this.applyTheme(isDark);
  }

  private applyTheme(isDark: boolean): void {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('ion-palette-dark', isDark);
    }
  }
}
