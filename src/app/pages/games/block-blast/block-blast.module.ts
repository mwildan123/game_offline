import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular/lazy';
import { RouterModule, Routes } from '@angular/router';
import { BlockBlastPage } from './block-blast.page';

const routes: Routes = [
  {
    path: '',
    component: BlockBlastPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BlockBlastPageRoutingModule {}

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BlockBlastPageRoutingModule
  ],
  declarations: [BlockBlastPage]
})
export class BlockBlastPageModule {}
