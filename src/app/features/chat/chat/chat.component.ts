import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../../core/services/chat.service';
import { ChatResponse } from '../../../core/models/types';

@Component({
  selector: 'epp-chat',
  templateUrl: './chat.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class ChatComponent {
  msg = '';
  log: { role: 'user' | 'bot' | 'system'; text: string }[] = [];
  missing: string[] = [];
  isLoading = false;

  @Input() set setMissing(m: string[]) {
    if (!m) return;

    // Solo actualizamos si hay cambios
    if (JSON.stringify(this.missing) !== JSON.stringify(m)) {
      this.missing = m;
      // Podríamos añadir un mensaje automático cuando cambian los elementos faltantes
      if (m && m.length > 0) {
        this.addSystemMessage(
          `Se han detectado elementos EPP faltantes: ${m.join(', ')}`,
        );
      }
    }
  }

  constructor(private chat: ChatService) {
    // Mensaje inicial
    this.log.push({
      role: 'bot',
      text: '¡Hola! Soy tu asistente de seguridad EPP. Puedo ayudarte con preguntas sobre equipos de protección personal y normativas. Por ejemplo, puedes preguntar sobre las consecuencias de no usar un casco o por qué es importante usar guantes en ciertos trabajos.',
    });
  }

  send() {
    const q = this.msg.trim();
    if (!q || this.isLoading) return;

    this.log.push({ role: 'user', text: q });
    this.msg = '';
    this.isLoading = true;

    // Mostrar indicador de escritura
    const loadingIndex = this.log.length;
    this.log.push({ role: 'bot', text: '...' });

    this.chat.send(q, this.missing).subscribe({
      next: (res: ChatResponse) => {
        console.log('Respuesta del chat:', res);

        // Reemplazar el indicador de escritura con la respuesta real
        if (loadingIndex < this.log.length) {
          this.log[loadingIndex] = { role: 'bot', text: res.answer };
        } else {
          this.log.push({ role: 'bot', text: res.answer });
        }

        this.isLoading = false;

        // Si tenemos fuentes, las mostramos
        if (res.sources && res.sources.length > 0) {
          const sourcesText = `Fuentes: ${res.sources.join(', ')}`;
          this.log.push({ role: 'system', text: sourcesText });
        }

        // Scroll al final
        this.scrollToBottom();
      },
      error: (err) => {
        console.error('Error en chat:', err);

        // Reemplazar el indicador de escritura con un mensaje de error
        if (loadingIndex < this.log.length) {
          this.log[loadingIndex] = {
            role: 'system',
            text: 'Error al procesar tu pregunta. Por favor, intenta de nuevo.',
          };
        } else {
          this.log.push({
            role: 'system',
            text: 'Error al procesar tu pregunta. Por favor, intenta de nuevo.',
          });
        }

        this.isLoading = false;
      },
    });
  }

  // Método para simular una pregunta del usuario (útil para preguntas automáticas)
  simulateQuestion(question: string) {
    this.msg = question;
    this.send();
  }

  // Método para agregar mensajes de sistema (útil para mostrar resultados de detección)
  addSystemMessage(text: string) {
    this.log.push({ role: 'system', text });
    // Mantener el chat en un tamaño razonable
    if (this.log.length > 50) {
      this.log = this.log.slice(-50);
    }

    this.scrollToBottom();
  }

  // Método para hacer scroll al final del chat
  private scrollToBottom() {
    setTimeout(() => {
      const chatContainer = document.getElementById('chat-messages');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 100);
  }
}
