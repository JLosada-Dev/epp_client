import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, catchError, throwError } from 'rxjs';
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

  webcamStream(): Subject<any> {
    const subj = new Subject<any>();
    let ws: WebSocket;

    try {
      // Construye la URL WS (ws:// o wss://) sin slash final
      const wsUrl = this.base
        .replace('http://', 'ws://')
        .replace('https://', 'wss://')
        .replace(/\/$/, '');
      ws = new WebSocket(`${wsUrl}/ws`);

      ws.onopen = () => {
        console.log('WebSocket conectado, esperando frames de cámara...');
        // NO enviamos JSON ni handshake de texto
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          // Convertimos la respuesta del backend en DetectResponse
          const detection: DetectResponse = {
            ok: data.ok || false,
            boxes: data.boxes || [],
            missing: data.missing || [],
            verdict: data.ok
              ? '✅ Cumple con EPP'
              : `❌ Falta: ${(data.missing || []).join(', ')}`,
          };
          subj.next(detection);
        } catch (e) {
          console.error('Error parseando mensaje WS:', e);
        }
      };

      ws.onerror = (e) => {
        console.error('WS error:', e);
        subj.error(new Error('Error en la conexión WebSocket'));
      };

      ws.onclose = (event) => {
        console.log(
          `WebSocket cerrado: code=${event.code}, reason=${event.reason}`,
        );
        if (event.code !== 1000) {
          subj.error(
            new Error(
              `Conexión WebSocket cerrada inesperadamente: ${
                event.reason || 'sin razón'
              }`,
            ),
          );
        } else {
          subj.complete();
        }
      };

      // Asegura cierre de WS cuando el Subject complete o falle
      subj.subscribe({
        complete: () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        },
        error: () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        },
      });

      // Sobrescribe next PARA SOLO ENVIAR Blob (JPEG) como binario
      const originalNext = subj.next.bind(subj);
      subj.next = (value: any) => {
        if (ws.readyState === WebSocket.OPEN && value instanceof Blob) {
          ws.send(value);
        }
        return originalNext(value);
      };
    } catch (e) {
      console.error('No se pudo crear WebSocket:', e);
      subj.error(new Error('No se pudo crear la conexión WebSocket'));
    }

    return subj;
  }
}
