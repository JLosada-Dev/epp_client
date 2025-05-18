import { Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { DetectorService } from '../../../core/services/detector.service';
import { DetectResponse, Box, VideoResponse } from '../../../core/models/types';
import { CommonModule } from '@angular/common';
import { OverlayComponent } from '../overlay/overlay.component';
import { ChatComponent } from '../../chat/chat/chat.component';

@Component({
  selector: 'epp-upload',
  standalone: true,
  imports: [CommonModule, OverlayComponent, ChatComponent],
  templateUrl: './upload.component.html',
})
export class UploadComponent implements OnDestroy {
  verdict = '';
  boxes: Box[] = [];
  preview = '';
  dims: [number, number] = [0, 0];
  videoUrl: string | null = null;
  missingItems: string[] = [];
  loading = false;
  error = '';

  // Para overlay en video
  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('chat') chatComponent?: ChatComponent;
  animationId: number | null = null;
  detectionsPorFrame: { boxes: Box[]; verdict: string }[] = [];
  currentBoxes: Box[] = [];
  currentDims: [number, number] = [0, 0];
  currentVerdict: string = '';

  @ViewChild('imgEl') imgEl!: ElementRef<HTMLImageElement>;
  constructor(private det: DetectorService) {}

  ngOnDestroy() {
    this.clearVideoResources();
  }

  onFile(e: Event, type: 'img' | 'vid') {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    this.loading = true;
    this.error = '';

    if (type === 'img') {
      // Limpiamos estado anterior
      this.clearVideoResources();
      this.videoUrl = null;
      this.preview = '';
      this.verdict = '';
      this.boxes = [];

      this.det.detectImage(file).subscribe({
        next: (r) => {
          console.log('Respuesta de detección de imagen:', r);
          this.handle(r);
          // Enviamos datos al chat
          if (this.chatComponent && r.missing) {
            this.missingItems = r.missing;
            this.chatComponent.setMissing = r.missing;

            // Generar pregunta automática para el chat
            if (r.missing.length > 0) {
              // Mostrar mensaje de carga en el chat
              if (this.chatComponent) {
                this.chatComponent.addSystemMessage(
                  'Analizando normativas relacionadas con los EPP faltantes...',
                );
              }

              this.det.analyseComplete(file).subscribe({
                next: (completeResponse) => {
                  console.log(
                    'Respuesta de análisis completo:',
                    completeResponse,
                  );
                  // Actualizar chat con la respuesta completa
                  if (this.chatComponent) {
                    this.chatComponent.addSystemMessage(
                      `Análisis: ${completeResponse.chat_response}`,
                    );

                    if (
                      completeResponse.sources &&
                      completeResponse.sources.length > 0
                    ) {
                      this.chatComponent.addSystemMessage(
                        `Fuentes: ${completeResponse.sources.join(', ')}`,
                      );
                    }

                    // Sugerir una pregunta al usuario
                    const missingItems = r.missing.join(', ');
                    this.chatComponent.addSystemMessage(
                      `Puedes preguntar más sobre "${missingItems}" usando el chat a continuación.`,
                    );
                  }
                },
                error: (err) => {
                  console.error('Error en análisis completo:', err);
                  if (this.chatComponent) {
                    this.chatComponent.addSystemMessage(
                      'No se pudo completar el análisis normativo. Por favor, intenta hacer una pregunta específica al chat.',
                    );
                  }
                },
              });
            }
          }
          this.loading = false;
        },
        error: (err) => {
          this.error =
            'Error al procesar la imagen: ' +
            (err.message || 'Error desconocido');
          this.loading = false;
        },
      });
    } else {
      // Limpiamos estado anterior
      this.clearVideoResources();
      this.preview = '';
      this.verdict = '';
      this.boxes = [];

      this.videoUrl = URL.createObjectURL(file);

      this.det.detectVideo(file).subscribe({
        next: (response: VideoResponse) => {
          console.log('Respuesta de detección de video:', response);

          // Convertir el formato de la respuesta al formato que necesitamos
          if (response.frames) {
            // Si el backend devuelve frames procesados, usamos esos
            this.detectionsPorFrame = response.frames;
          } else {
            // Si no, convertimos los sample_results
            this.detectionsPorFrame = response.sample_results.map((result) => ({
              boxes: result.boxes || [],
              verdict: result.ok
                ? '✅ Cumple con EPP'
                : `❌ Falta: ${result.missing.join(', ')}`,
            }));
          }

          this.missingItems = response.missing_global || [];

          // Enviamos datos al chat
          if (this.chatComponent) {
            this.chatComponent.setMissing = this.missingItems;

            // Agregar mensaje de sistema sobre elementos faltantes
            if (this.missingItems.length > 0) {
              this.chatComponent.addSystemMessage(
                `Elementos EPP faltantes en el video: ${this.missingItems.join(', ')}`,
              );

              // Enviar consulta automática al chat sobre los elementos faltantes
              const question = `¿Qué consecuencias tiene trabajar sin ${this.missingItems.join(', ')}?`;
              this.chatComponent.simulateQuestion(question);
            } else {
              this.chatComponent.addSystemMessage(
                `El trabajador cumple con todos los elementos EPP requeridos.`,
              );
            }
          }
          this.loading = false;
        },
        error: (err) => {
          this.error =
            'Error al procesar el video: ' +
            (err.message || 'Error desconocido');
          this.loading = false;
        },
      });
    }
  }

  private handle(r: DetectResponse) {
    this.verdict = r.verdict || '';
    this.boxes = r.boxes || [];
    this.missingItems = r.missing || [];
    if (r.image_b64) {
      this.preview = 'data:image/jpeg;base64,' + r.image_b64;
    }
  }

  setDims(img: HTMLImageElement) {
    this.dims = [img.naturalWidth, img.naturalHeight];
  }

  // --- Lógica para overlay en video ---
  onPlay() {
    this.animateOverlay();
  }

  onPause() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  animateOverlay() {
    const video = this.videoEl?.nativeElement;
    if (!video || video.paused || video.ended) return;

    // Ajusta esto según los FPS de tu backend
    const FRAMES_POR_SEGUNDO = 5; // El backend procesa cada 5 frames
    const frameIdx = Math.min(
      Math.floor((video.currentTime * FRAMES_POR_SEGUNDO) / 5),
      this.detectionsPorFrame.length - 1,
    );

    if (frameIdx >= 0 && this.detectionsPorFrame.length > 0) {
      const detection = this.detectionsPorFrame[frameIdx] || {
        boxes: [],
        verdict: '',
      };
      this.currentBoxes = detection.boxes || [];
      this.currentVerdict = detection.verdict || '';
      this.currentDims = [video.videoWidth, video.videoHeight];
    } else {
      this.currentBoxes = [];
      this.currentVerdict = '';
      this.currentDims = [video.videoWidth, video.videoHeight];
    }

    this.animationId = requestAnimationFrame(() => this.animateOverlay());
  }

  private clearVideoResources() {
    if (this.videoUrl) {
      URL.revokeObjectURL(this.videoUrl);
    }

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}
