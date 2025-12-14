'use client';

import { useEffect, useRef } from 'react';

export default function GamePage() {
  const gameRef = useRef<HTMLDivElement>(null);
  const phaserGameRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !gameRef.current) return;

    // Dynamic import to avoid SSR issues
    Promise.all([
      import('phaser'),
      import('socket.io-client')
    ]).then(([Phaser, { io }]) => {
      
      // Socket.io 연결
      const SOCKET_URL = typeof window !== 'undefined' 
        ? `http://${window.location.hostname}:9001`
        : 'http://localhost:9001';
      const socket = io(SOCKET_URL);

      // Phaser Game Config
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: gameRef.current!,
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
          }
        },
        scene: {
          preload: preload,
          create: create,
          update: update
        },
        backgroundColor: '#2d2d2d'
      };

      let player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null = null;
      let otherPlayers: { [key: string]: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody } = {};
      let cursors: Phaser.Types.Input.Keyboard.CursorKeys;
      let wasd: any;
      let camera: Phaser.Cameras.Scene2D.Camera;
      let scene: Phaser.Scene;

      function preload(this: Phaser.Scene) {
        scene = this;
        
        // 플레이어 캐릭터 생성 (초록색 - 내 캐릭터)
        const graphics = this.add.graphics();
        graphics.fillStyle(0x00ff00, 1);
        graphics.fillRect(0, 0, 32, 32);
        graphics.generateTexture('player', 32, 32);
        graphics.destroy();

        // 다른 플레이어 캐릭터 (파란색)
        const otherGraphics = this.add.graphics();
        otherGraphics.fillStyle(0x0088ff, 1);
        otherGraphics.fillRect(0, 0, 32, 32);
        otherGraphics.generateTexture('otherPlayer', 32, 32);
        otherGraphics.destroy();

        // 타일 맵 생성 (바닥)
        const tileGraphics = this.add.graphics();
        tileGraphics.fillStyle(0x444444, 1);
        tileGraphics.fillRect(0, 0, 64, 64);
        tileGraphics.lineStyle(2, 0x666666, 1);
        tileGraphics.strokeRect(0, 0, 64, 64);
        tileGraphics.generateTexture('tile', 64, 64);
        tileGraphics.destroy();
      }

      function create(this: Phaser.Scene) {
        // 큰 맵 생성 (타일 패턴)
        for (let x = 0; x < 50; x++) {
          for (let y = 0; y < 50; y++) {
            this.add.image(x * 64 + 32, y * 64 + 32, 'tile');
          }
        }

        // 월드 경계 설정
        this.physics.world.setBounds(0, 0, 50 * 64, 50 * 64);

        // 키보드 입력 설정
        cursors = this.input.keyboard!.createCursorKeys();
        wasd = this.input.keyboard!.addKeys({
          up: Phaser.Input.Keyboard.KeyCodes.W,
          down: Phaser.Input.Keyboard.KeyCodes.S,
          left: Phaser.Input.Keyboard.KeyCodes.A,
          right: Phaser.Input.Keyboard.KeyCodes.D
        });

        // Socket.io 이벤트 리스너
        socket.on('connect', () => {
          console.log('✅ 서버 연결됨:', socket.id);
        });
        
        // 현재 접속한 모든 플레이어 받기
        socket.on('currentPlayers', (players: any) => {
          console.log('📋 현재 플레이어들:', players);
          Object.keys(players).forEach((id) => {
            if (id === socket.id) {
              // 내 캐릭터
              console.log('🟢 내 캐릭터 생성:', id);
              addPlayer(scene, players[id], true);
            } else {
              // 다른 플레이어
              console.log('🔵 다른 플레이어 생성:', id);
              addPlayer(scene, players[id], false);
            }
          });
        });

        // 새 플레이어 접속
        socket.on('newPlayer', (playerInfo: any) => {
          console.log('➕ 새 플레이어 접속:', playerInfo.id);
          addPlayer(scene, playerInfo, false);
        });

        // 플레이어 이동
        socket.on('playerMoved', (playerData: any) => {
          if (otherPlayers[playerData.id]) {
            otherPlayers[playerData.id].setPosition(playerData.x, playerData.y);
          }
        });

        // 플레이어 퇴장
        socket.on('playerDisconnected', (playerId: string) => {
          if (otherPlayers[playerId]) {
            otherPlayers[playerId].destroy();
            delete otherPlayers[playerId];
            console.log('➖ 플레이어 퇴장:', playerId);
          }
        });

        socket.on('disconnect', () => {
          console.log('❌ 서버 연결 끊김');
        });
      }

      function addPlayer(scene: Phaser.Scene, playerInfo: any, isSelf: boolean) {
        if (isSelf) {
          // 내 캐릭터
          player = scene.physics.add.sprite(playerInfo.x, playerInfo.y, 'player');
          player.setCollideWorldBounds(false);
          
          // 카메라 설정
          camera = scene.cameras.main;
          camera.setBounds(0, 0, 50 * 64, 50 * 64);
          camera.startFollow(player, true, 0.1, 0.1);
          
          console.log('✨ 내 캐릭터 생성 완료');
        } else {
          // 다른 플레이어
          const otherPlayer = scene.physics.add.sprite(playerInfo.x, playerInfo.y, 'otherPlayer');
          otherPlayers[playerInfo.id] = otherPlayer;
        }
      }

      function update(this: Phaser.Scene) {
        if (!player) return;

        const speed = 200;
        let moved = false;
        const oldX = player.x;
        const oldY = player.y;
        
        player.setVelocity(0);

        // WASD 또는 방향키로 이동
        if (cursors.left.isDown || wasd.left.isDown) {
          player.setVelocityX(-speed);
          moved = true;
        } else if (cursors.right.isDown || wasd.right.isDown) {
          player.setVelocityX(speed);
          moved = true;
        }

        if (cursors.up.isDown || wasd.up.isDown) {
          player.setVelocityY(-speed);
          moved = true;
        } else if (cursors.down.isDown || wasd.down.isDown) {
          player.setVelocityY(speed);
          moved = true;
        }

        // 대각선 이동 시 속도 정규화
        if (player.body.velocity.x !== 0 && player.body.velocity.y !== 0) {
          player.setVelocity(
            player.body.velocity.x * 0.707,
            player.body.velocity.y * 0.707
          );
        }

        // 실제로 위치가 변경되었을 때만 서버로 전송
        if (moved && (Math.abs(player.x - oldX) > 0.1 || Math.abs(player.y - oldY) > 0.1)) {
          socket.emit('playerMovement', {
            x: Math.round(player.x),
            y: Math.round(player.y)
          });
        }
      }

      // Phaser Game 시작
      const game = new Phaser.Game(config);
      phaserGameRef.current = game;
    });

    // Cleanup
    return () => {
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-black p-4 rounded-lg shadow-2xl">
        <div className="mb-4 text-white text-center">
          <h2 className="text-2xl font-bold mb-2">멀티플레이어 게임</h2>
          <p className="text-sm text-gray-400">
            WASD 또는 방향키로 이동 | 🟢 나 | 🔵 다른 플레이어
          </p>
          <p className="text-xs text-gray-500 mt-2">
            F12 눌러서 콘솔 확인 가능
          </p>
        </div>
        <div ref={gameRef} className="rounded overflow-hidden" />
      </div>
    </div>
  );
}
