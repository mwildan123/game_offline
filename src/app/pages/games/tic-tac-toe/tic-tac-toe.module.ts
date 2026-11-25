import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular/lazy';
import { RouterModule, Routes } from '@angular/router';
import { TicTacToePage } from './tic-tac-toe.page';

const routes: Routes = [
  {
    path: '',
    component: TicTacToePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TicTacToePageRoutingModule {}

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TicTacToePageRoutingModule
  ],
  declarations: [TicTacToePage]
})
export class TicTacToePageModule {}
