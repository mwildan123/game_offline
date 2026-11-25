import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./home/home.module').then(m => m.HomePageModule)
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'games/block-blast',
    loadChildren: () => import('./pages/games/block-blast/block-blast.module').then(m => m.BlockBlastPageModule)
  },
  {
    path: 'games/snake',
    loadChildren: () => import('./pages/games/snake/snake.module').then(m => m.SnakePageModule)
  },
  {
    path: 'games/game-2048',
    loadChildren: () => import('./pages/games/game-2048/game-2048.module').then(m => m.Game2048PageModule)
  },
  {
    path: 'games/tic-tac-toe',
    loadChildren: () => import('./pages/games/tic-tac-toe/tic-tac-toe.module').then(m => m.TicTacToePageModule)
  },
  {
    path: 'games/memory-match',
    loadChildren: () => import('./pages/games/memory-match/memory-match.module').then(m => m.MemoryMatchPageModule)
  },
  {
    path: '**',
    redirectTo: 'home'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
