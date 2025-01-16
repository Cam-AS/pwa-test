import { DomSanitizer } from '@angular/platform-browser';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  OnInit,
  Output,
} from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

import { SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';

export class Image {
  public displayImage?: string | SafeResourceUrl;
  public file?: File;
  public isNew?: boolean;

  public constructor() {
    this.displayImage = '';
    this.file = undefined;
    this.isNew = true;
  }

  public static fromUrl(url: string): Image {
    const image = new Image();
    image.displayImage = url;
    image.isNew = false;
    image.file = undefined;
    return image;
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  title = 'pwa-test';
  public image: Image = new Image();
  @Output() public imageChange: EventEmitter<Image> = new EventEmitter();
  @Output() public change: EventEmitter<Image> = new EventEmitter();

  public size: number = 325;
  public error = '';
  public maxKb: number = 1000;
  public label: string = 'Select an image';

  constructor(
    private swUpdate: SwUpdate,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.subscribe((event) => {
        if (event.type === 'VERSION_READY') {
          this.clearCachesAndReload();
        }
      });
    }
  }

  public onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    const file = input.files![0];
    console.log('Selected file:', file);

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      console.log('Unsupported file type. Please select a JPEG or PNG image.');
      return;
    }

    if (this.maxKb && file.size / 1000 > this.maxKb) {
      console.log(`This image is too large. Max size is ${this.maxKb}KB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const display = this.sanitizer.bypassSecurityTrustResourceUrl(
        e.target.result
      );

      this.image = {
        file: file,
        displayImage: display,
        isNew: true,
      };
      this.imageChange.emit(this.image);
      this.change.emit(this.image);
      this.cdr.detectChanges();
    };

    reader.onerror = (error) => {
      console.log('Error reading the file.');
    };

    reader.readAsDataURL(file);
    event.stopPropagation();
  }

  public getIconSize(): number {
    return Math.max(30, Math.min(this.size, 72)) - 10;
  }

  public clear(): void {
    this.image = new Image();
    this.imageChange.emit(this.image);
    this.change.emit(this.image);
  }

  public async download(): Promise<void> {
    const downloadLink = document.createElement('a');

    try {
      let downloadUrl: string;
      if (this.image.file) {
        downloadUrl = window.URL.createObjectURL(this.image.file);
      } else {
        const response = await fetch(this.image.displayImage!.toString(), {
          headers: new Headers({
            Origin: location.origin,
          }),
          mode: 'cors',
        });
        const imageBlob = await response.blob();
        downloadUrl = window.URL.createObjectURL(imageBlob);
      }

      downloadLink.href = downloadUrl;
      downloadLink.target = '_blank';
      downloadLink.setAttribute('download', 'Image');

      document.body.appendChild(downloadLink);
      downloadLink.click();
    } catch (error) {
      console.log('Error downloading the image.');
    } finally {
      document.body.removeChild(downloadLink);
    }
  }

  private clearCachesAndReload() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
        });
      });
    }

    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
      .then(() => {
        window.location.reload();
      });
  }
}
