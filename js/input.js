// ============================================================
// INPUT  ─  keyboard, mouse, mobile, UI buttons
// ============================================================
'use strict';
import { S, GameState } from './state.js';
import {
    startGame, pauseGame, resumeGame, returnToMenu, gameLoop,
} from './game.js';
import { saveGame, checkSaveGame } from './systems.js';
import { closeNPCDialogue, renderAchievementsScreen } from './ui.js';

export function initInput() {
    // ── Keyboard ──
    document.addEventListener('keydown',(e)=>{
        const k=e.key.length===1?e.key.toLowerCase():e.key; S.keys[k]=true;
        if (e.key==='Escape') {
            if (S.currentState===GameState.PLAYING) pauseGame();
            else if (S.currentState===GameState.PAUSED) {
                document.getElementById('npc-dialog').classList.contains('hidden')?resumeGame():closeNPCDialogue();
            }
        }
        if (e.key===' '&&S.currentState===GameState.PLAYING){ e.preventDefault(); S.player.attack(); }
        if ((e.key==='e'||e.key==='E')&&S.currentState===GameState.PLAYING){ e.preventDefault(); S.player.rangedAttack(); }
        if (e.key==='Shift'&&S.currentState===GameState.PLAYING){ e.preventDefault(); S.player.activateShield(); }
        if ((e.key==='f'||e.key==='F')&&S.currentState===GameState.PLAYING){ e.preventDefault(); /* handled in game loop */ }
        if ((e.key==='f'||e.key==='F')&&S.currentState===GameState.PAUSED&&!document.getElementById('npc-dialog').classList.contains('hidden')) closeNPCDialogue();
    });
    document.addEventListener('keyup',(e)=>{ const k=e.key.length===1?e.key.toLowerCase():e.key; S.keys[k]=false; });
    window.addEventListener('blur',()=>{ for(const k in S.keys) S.keys[k]=false; });
    document.addEventListener('contextmenu',(e)=>{ if(S.currentState!==GameState.MENU) e.preventDefault(); });

    // ── Mouse ──
    S.canvas.addEventListener('mousedown',(e)=>{
        if (S.currentState!==GameState.PLAYING) return;
        if (e.button===0) S.player.attack();
        if (e.button===2) S.player.rangedAttack();
    });

    // ── Mobile ──
    const setupMobileBtn=(id,key)=>{
        const btn=document.getElementById(id); if(!btn) return;
        btn.addEventListener('touchstart',(e)=>{e.preventDefault();S.keys[key]=true;});
        btn.addEventListener('touchend',(e)=>{e.preventDefault();S.keys[key]=false;});
        btn.addEventListener('mousedown',(e)=>{e.preventDefault();S.keys[key]=true;});
        btn.addEventListener('mouseup',(e)=>{e.preventDefault();S.keys[key]=false;});
        btn.addEventListener('mouseleave',()=>S.keys[key]=false);
    };
    setupMobileBtn('btn-up','w'); setupMobileBtn('btn-down','s');
    setupMobileBtn('btn-left','a'); setupMobileBtn('btn-right','d');
    document.getElementById('action-btn').addEventListener('touchstart',(e)=>{e.preventDefault();if(S.currentState===GameState.PLAYING)S.player.attack();});
    document.getElementById('action-btn').addEventListener('mousedown',()=>{if(S.currentState===GameState.PLAYING)S.player.attack();});
    document.getElementById('ranged-btn').addEventListener('touchstart',(e)=>{e.preventDefault();if(S.currentState===GameState.PLAYING)S.player.rangedAttack();});
    document.getElementById('ranged-btn').addEventListener('mousedown',()=>{if(S.currentState===GameState.PLAYING)S.player.rangedAttack();});

    // ── UI buttons ──
    document.getElementById('menu-btn').addEventListener('click',pauseGame);
    document.getElementById('resume-btn').addEventListener('click',resumeGame);
    document.getElementById('save-btn').addEventListener('click',saveGame);
    document.getElementById('quit-btn').addEventListener('click',returnToMenu);
    document.getElementById('restart-btn').addEventListener('click',returnToMenu);
    document.getElementById('npc-dialog-close').addEventListener('click',closeNPCDialogue);

    const showBestiary=()=>document.getElementById('bestiary-screen').classList.remove('hidden');
    const hideBestiary=()=>document.getElementById('bestiary-screen').classList.add('hidden');
    document.getElementById('show-bestiary-btn').addEventListener('click',showBestiary);
    document.getElementById('menu-bestiary-btn').addEventListener('click',showBestiary);
    document.getElementById('close-bestiary-btn').addEventListener('click',hideBestiary);

    document.getElementById('show-lore-btn').addEventListener('click',()=>document.getElementById('lore-screen').classList.remove('hidden'));
    document.getElementById('close-lore-btn').addEventListener('click',()=>document.getElementById('lore-screen').classList.add('hidden'));

    // Achievements screen
    const openAchievements = () => {
        renderAchievementsScreen();
        document.getElementById('achievements-screen').classList.remove('hidden');
    };
    document.getElementById('show-achievements-btn')?.addEventListener('click', openAchievements);
    document.getElementById('menu-achievements-btn')?.addEventListener('click', openAchievements);
    document.getElementById('close-achievements-btn')?.addEventListener('click', () => {
        document.getElementById('achievements-screen').classList.add('hidden');
    });

    // Victory screen restart
    document.getElementById('victory-restart-btn')?.addEventListener('click', returnToMenu);

    // ── Level Up upgrades ──
    document.querySelectorAll('.upgrade-btn').forEach(btn=>{
        btn.addEventListener('click',(e)=>{
            const player = S.player;
            const stat=e.target.dataset.stat;
            if (stat==='maxHp'){player.maxHp+=25;player.hp+=25;}
            else if (stat==='damage') player.damage+=5;
            else if (stat==='speed') player.speed+=10;
            else if (stat==='ability'){
                if(player.classType==='wizard'){player.maxMana+=30;player.mana+=30;player.manaRegen+=2;}
                else if(player.classType==='knight') player.abilityPower+=0.2;
                else player.abilityPower+=0.5;
            }
            // Update HUD via dynamic import to avoid cycle
            import('./ui.js').then(m => m.updateHUD());
            document.getElementById('level-up-screen').classList.add('hidden');
            setTimeout(()=>{
                S.lastTime=performance.now();
                S.currentState=GameState.PLAYING;
                cancelAnimationFrame(S.animationFrameId);
                gameLoop(performance.now());
            },100);
        });
    });

    // ── Class Cards ──
    let selectedClass=null;
    document.querySelectorAll('.class-card').forEach(card=>{
        card.addEventListener('click',()=>{
            document.querySelectorAll('.class-card').forEach(c=>c.style.borderColor='var(--border-color)');
            const type=card.dataset.class;
            card.style.borderColor=type==='human'?'var(--accent-color)':type==='wizard'?'var(--wizard-color)':'var(--beast-color)';
            selectedClass=type;
            document.getElementById('start-new-btn').classList.remove('hidden');
        });
    });
    document.getElementById('start-new-btn').addEventListener('click',()=>{ if(selectedClass) startGame(selectedClass); });
    document.getElementById('load-save-btn').addEventListener('click',()=>{
        try { const raw=localStorage.getItem('endlessChronicles_save'); if(raw) startGame(null,JSON.parse(raw)); }
        catch(e) { console.error('Load error:',e); }
    });

    if (checkSaveGame()) document.getElementById('load-save-btn').classList.remove('hidden');
}
