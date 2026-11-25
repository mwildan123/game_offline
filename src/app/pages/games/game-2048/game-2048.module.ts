import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular/lazy';
import { RouterModule, Routes } from '@angular/router';
import { Game2048Page } from './game-2048.page';

const routes: Routes = [
  {
    path: '',
    component: Game2048Page
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class Game2048PageRoutingModule {}

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    Game2048PageRoutingModule
  ],
  declarations: [Game2048Page]
})
export class Game2048PageModule {}
