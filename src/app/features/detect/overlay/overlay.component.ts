import {
  Component,
  Input,
  OnChanges,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { NgIf } from '@angular/common';

export interface Box {
  xyxy: [number, number, number, number];
  cls: string;
}

@Component({
  selector: 'epp-overlay',
  template: `
    <div class="absolute inset-0 pointer-events-none w-full h-full">
      <canvas
        #c
        class="absolute inset-0 pointer-events-none w-full h-full block"
      ></canvas>
      <div
        class="absolute top-2 left-2 bg-slate-800 bg-opacity-90 px-3 py-1 rounded text-xs font-semibold text-teal-400 shadow-md border border-slate-600"
        *ngIf="verdict"
      >
        {{ verdict }}
      </div>
    </div>
  `,
  standalone: true,
  imports: [NgIf],
})
export class OverlayComponent implements OnChanges {
  @Input() boxes: Box[] = [];
  @Input() dims: [number, number] = [0, 0];
  @Input() verdict: string = '';
  @ViewChild('c', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;

  ngOnChanges() {
    this.draw();
  }

  private draw(): void {
    const [w, h] = this.dims ?? [0, 0];
    if (!w || !h || !this.canvas) return;

    const c = this.canvas.nativeElement;
    c.width = w;
    c.height = h;

    const ctx = c.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#14b8a6'; // teal-500
    ctx.lineWidth = 2;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#14b8a6';

    (this.boxes ?? []).forEach((b: Box) => {
      const [x1, y1, x2, y2] = b.xyxy;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.fillText(b.cls, x1, y1 - 6);
    });
  }
}
