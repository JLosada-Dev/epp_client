import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChatResponse } from '../models/types';
import { environment } from '../../../environments/environment';
import { catchError, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  send(
    question: string,
    missing: string[] = [],
    k?: number,
    diagnostics = false,
  ) {
    return this.http
      .post<ChatResponse>(`${this.base}chat/transformer`, {
        question,
        missing,
        k,
        diagnostics,
      })
      .pipe(
        catchError((err) => {
          console.error('Error en servicio de chat:', err);
          return throwError(
            () => new Error('No se pudo procesar la consulta al chat.'),
          );
        }),
      );
  }
}
