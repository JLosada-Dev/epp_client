import {
  Component,
  ViewChild,
  ElementRef,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DetectorService } from '../../../core/services/detector.service';
import { Subscription, interval, Subject } from 'rxjs';
import { Box, DetectResponse } from '../../../core/models/types';
import { ChatComponent } from '../../chat/chat/chat.component';

@Component({
  selector: 'epp-webcam',
  standalone: true,
  imports: [CommonModule, ChatComponent],
  templateUrl: './webcam.component.html',
})
export class WebcamComponent implements OnInit, OnDestroy {
  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chat') chatComponent?: ChatComponent;

  private stream!: MediaStream;
  private timerSub!: Subscription;
  private wsSub!: Subscription;
  private wsSubject!: Subject<any>;

  boxes: Box[] = [];
  missing: string[] = [];
  webcamActive = false;
  error = '';
  verdict = '';
  connecting = false;

  constructor(private det: DetectorService) {}

  ngOnInit() {
    // No iniciamos automáticamente para dar control al usuario
  }

  start() {
    this.error = '';
    this.webcamActive = false;
    this.connecting = true;

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((s) => {
        this.stream = s;
        this.videoEl.nativeElement.srcObject = s;

        // Esperar a que el video esté listo
        this.videoEl.nativeElement.onloadedmetadata = () => {
          this.webcamActive = true;
          this.connecting = false;

          // Iniciar websocket después de tener el stream listo
          this.initWebSocket();
        };
      })
      .catch((err) => {
        this.error =
          'Error al acceder a la cámara: ' +
          (err.message || 'Error desconocido');
        this.connecting = false;
      });
  }

  private initWebSocket() {
    try {
      // 1) Inicializa WebSocket Subject
      this.wsSubject = this.det.webcamStream();
      this.wsSub = this.wsSubject.subscribe({
        next: (res: DetectResponse) => {
          console.log('WebSocket respuesta:', res);

          // Verificar la estructura de la respuesta y manejarla adecuadamente
          if (res) {
            // Actualizar boxes con las detecciones
            this.boxes = res.boxes || [];

            // Actualizar missing con elementos faltantes
            if (res.missing && Array.isArray(res.missing)) {
              this.missing = res.missing;
            } else {
              this.missing = [];
            }

            // Actualizar veredicto
            if (res.verdict) {
              this.verdict = res.verdict;
            } else if (res.ok !== undefined) {
              this.verdict = res.ok
                ? '✅ Cumple con EPP'
                : this.missing.length > 0
                  ? `❌ Falta: ${this.missing.join(', ')}`
                  : '';
            }

            // Actualizar el chat con los elementos faltantes
            if (this.chatComponent && this.missing && this.missing.length > 0) {
              this.chatComponent.setMissing = this.missing;

              // Solo enviar mensaje al cambiar los elementos faltantes
              if (
                JSON.stringify(this.chatComponent.missing) !==
                JSON.stringify(this.missing)
              ) {
                this.chatComponent.addSystemMessage(
                  `Elementos EPP faltantes detectados: ${this.missing.join(', ')}`,
                );
              }
            }

            this.draw();
          }
        },
        error: (err) => {
          this.error =
            'Error en la conexión WebSocket: ' +
            (err.message || 'Error desconocido');
          this.stopStream();
        },
      });

      // 2) Cada 200ms captura y envía frame
      this.timerSub = interval(200).subscribe(() => this.captureFrame());
    } catch (error) {
      this.error =
        'Error al inicializar WebSocket: ' +
        ((error as Error).message || 'Error desconocido');
    }
  }

  stopStream() {
    this.timerSub?.unsubscribe();
    this.wsSub?.unsubscribe();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.webcamActive = false;
    this.boxes = [];
    this.missing = [];
    this.verdict = '';

    // Limpiar el canvas
    const canvas = this.canvasEl?.nativeElement;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  private captureFrame() {
    const video = this.videoEl?.nativeElement;
    const canvas = this.canvasEl?.nativeElement;

    if (!video || !canvas) return;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return; // La cámara aún no está lista
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    // Enviar el frame como un blob o base64, según el backend
    canvas.toBlob(
      (blob) => {
        if (blob && this.wsSubject) {
          try {
            // Enviar el blob directamente
            this.wsSubject.next(blob);
          } catch (error) {
            console.error('Error enviando frame al WebSocket:', error);
          }
        }
      },
      'image/jpeg',
      0.85, // Calidad mejorada para mejor detección
    );
  }

  private draw() {
    const canvas = this.canvasEl?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Asegúrate de que el canvas tenga las dimensiones correctas
    if (canvas.width === 0 || canvas.height === 0) {
      const video = this.videoEl.nativeElement;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // Primero dibujar el frame actual
    const video = this.videoEl.nativeElement;
    ctx.drawImage(video, 0, 0);

    // Luego dibujar los cuadros encima
    this.boxes.forEach((b: Box) => {
      const [x1, y1, x2, y2] = b.xyxy;
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.fillStyle = '#22c55e';
      ctx.font = '14px sans-serif';
      ctx.fillText(b.cls, x1, y1 - 4);
    });

    // Dibuja el veredicto si existe
    if (this.verdict) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillRect(10, 10, 300, 30);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(this.verdict, 15, 30);
    }
  }

  ngOnDestroy() {
    this.stopStream();
  }
}
