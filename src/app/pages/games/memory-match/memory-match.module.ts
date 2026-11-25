import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular/lazy';
import { RouterModule, Routes } from '@angular/router';
import { MemoryMatchPage } from './memory-match.page';

const routes: Routes = [
  {
    path: '',
    component: MemoryMatchPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MemoryMatchPageRoutingModule {}

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MemoryMatchPageRoutingModule
  ],
  declarations: [MemoryMatchPage]
})
export class MemoryMatchPageModule {}
