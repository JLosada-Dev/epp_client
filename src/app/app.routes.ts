import { Routes } from '@angular/router';
import { UploadComponent } from './features/detect/upload/upload.component';
import { WebcamComponent } from './features/detect/webcam/webcam.component';
import { ChatComponent } from './features/chat/chat/chat.component';

export const routes: Routes = [
  { path: '', component: UploadComponent },
  { path: 'webcam', component: WebcamComponent },
  { path: 'chat', component: ChatComponent },
  { path: '**', redirectTo: '' },
];
