import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular/lazy';
import { RouterModule, Routes } from '@angular/router';
import { SnakePage } from './snake.page';

const routes: Routes = [
  {
    path: '',
    component: SnakePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SnakePageRoutingModule {}

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SnakePageRoutingModule
  ],
  declarations: [SnakePage]
})
export class SnakePageModule {}
