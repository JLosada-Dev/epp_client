import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, Observable, catchError, throwError } from 'rxjs';
import {
  DetectResponse,
  AnalyseCompleteResponse,
  VideoResponse,
  ChatResponse,
} from '../models/types';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DetectorService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  detectImage(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http
      .post<DetectResponse>(`${this.base}detect/image`, form)
      .pipe(
        catchError((err) => {
          console.error('Error en detección de imagen:', err);
          return throwError(
            () =>
              new Error('No se pudo procesar la imagen. Intente nuevamente.'),
          );
        }),
      );
  }

  detectVideo(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<VideoResponse>(`${this.base}detect/video`, form).pipe(
      catchError((err) => {
        console.error('Error en detección de video:', err);
        return throwError(
          () => new Error('No se pudo procesar el video. Intente nuevamente.'),
        );
      }),
    );
  }

  analyseComplete(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http
      .post<AnalyseCompleteResponse>(`${this.base}analyse/complete`, form)
      .pipe(
        catchError((err) => {
          console.error('Error en análisis completo:', err);
          return throwError(
            () => new Error('No se pudo realizar el análisis completo.'),
          );
        }),
      );
  }

  diagnose(question: string) {
    return this.http
      .post<ChatResponse>(`${this.base}diagnose`, { question })
      .pipe(
        catchError((err) => {
          console.error('Error en diagnóstico:', err);
          return throwError(
            () => new Error('No se pudo realizar el diagnóstico.'),
          );
        }),
      );
  }

  webcamStream(): Subject<any> {
    const subj = new Subject<any>();
    let ws: WebSocket;

    try {
      // Importante: Asegúrate de que la URL termine con '/ws'
      const wsUrl = this.base
        .replace('http://', 'ws://')
        .replace('https://', 'wss://')
        .replace(/\/$/, ''); // Eliminar slash final si existe

      console.log('Conectando WebSocket a:', `${wsUrl}/ws`);
      ws = new WebSocket(`${wsUrl}/ws`);

      ws.onopen = () => {
        console.log('WebSocket connection opened');
        // Enviar mensaje inicial para establecer la conexión
        ws.send(JSON.stringify({ type: 'connect', client: 'angular' }));
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          console.log('WebSocket message received:', data);

          // Transformar la respuesta según su tipo
          if (data.type === 'detection') {
            // Esto es una respuesta de detección
            const detection: DetectResponse = {
              ok: data.ok || false,
              boxes: data.boxes || [],
              missing: data.missing || [],
              verdict: data.ok
                ? '✅ Cumple con EPP'
                : `❌ Falta: ${(data.missing || []).join(', ')}`,
            };
            subj.next(detection);
          } else {
            // Pasar los datos tal como vienen
            subj.next(data);
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      ws.onerror = (e) => {
        console.error('WebSocket error:', e);
        subj.error(new Error('Error en la conexión WebSocket'));
      };

      ws.onclose = (event) => {
        console.log(
          `WebSocket connection closed: code=${event.code}, reason=${event.reason}`,
        );

        // Si el cierre no fue limpio (por ejemplo, por un error), notificar
        if (event.code !== 1000) {
          subj.error(
            new Error(
              `Conexión WebSocket cerrada: ${event.reason || 'Error desconocido'}`,
            ),
          );
        } else {
          subj.complete();
        }
      };

      // Cuando el Subject se complete o haya error, cerramos el WebSocket
      subj.subscribe({
        complete: () => {
          if (ws && ws.readyState === WebSocket.OPEN) ws.close();
        },
        error: () => {
          if (ws && ws.readyState === WebSocket.OPEN) ws.close();
        },
      });

      // Enviamos los datos cuando alguien emite en el Subject
      const originalNext = subj.next;
      subj.next = function (this: Subject<any>, value: any) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(value);
          return originalNext.call(this, value);
        }
      } as any;
    } catch (e) {
      console.error('Error creating WebSocket:', e);
      subj.error(new Error('No se pudo crear la conexión WebSocket'));
    }

    return subj;
  }
}
