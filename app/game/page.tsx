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
      
      // Socket.io 연결 - EC2 퍼블릭 IP 또는 도메인으로 변경하세요
      const SOCKET_URL = 'http://3.36.66.226:9001';  // EC2 IP
      
      console.log('🔌 소켓 서버 연결 시도:', SOCKET_URL);
      const socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      });

      // 모든 수신 이벤트 모니터링
      socket.onAny((eventName, ...args) => {
        console.log(`🎧 [수신] 이벤트: ${eventName}`, args);
      });

      // 모든 발신 이벤트 모니터링
      socket.onAnyOutgoing((eventName, ...args) => {
        console.log(`📤 [발신] 이벤트: ${eventName}`, args);
      });

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
      let mySocketId: string = '';

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
        console.log('🎮 Phaser 게임 생성 시작');
        
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
          mySocketId = socket.id || '';
          console.log('✅ 서버 연결 성공:', mySocketId);
        });

        socket.on('connect_error', (error) => {
          console.error('❌ 연결 에러:', error);
        });

        socket.on('reconnect', (attemptNumber) => {
          console.log('🔄 재연결 성공:', attemptNumber);
        });
        
        // 현재 접속한 모든 플레이어 받기
        socket.on('currentPlayers', (players: any) => {
          console.log('='.repeat(50));
          console.log('📋 currentPlayers 수신:', Object.keys(players).length, '명');
          console.log('플레이어 목록:', players);
          console.log('내 ID:', socket.id);
          
          Object.keys(players).forEach((id) => {
            if (id === socket.id) {
              // 내 캐릭터
              console.log('🟢 내 캐릭터 생성:', id.substring(0, 8), `위치: (${players[id].x}, ${players[id].y})`);
              addPlayer(scene, players[id], true);
            } else {
              // 다른 플레이어
              console.log('🔵 다른 플레이어 생성:', id.substring(0, 8), `위치: (${players[id].x}, ${players[id].y})`);
              addPlayer(scene, players[id], false);
            }
          });
          console.log('='.repeat(50));
        });

        // 새 플레이어 접속
        socket.on('newPlayer', (playerInfo: any) => {
          console.log('='.repeat(50));
          console.log('➕ newPlayer 수신:', playerInfo.id.substring(0, 8));
          console.log('플레이어 정보:', playerInfo);
          addPlayer(scene, playerInfo, false);
          console.log('='.repeat(50));
        });

        // 플레이어 이동
        socket.on('playerMoved', (playerData: any) => {
          const shortId = playerData.id.substring(0, 8);
          console.log('='.repeat(50));
          console.log(`👉 playerMoved 이벤트 수신!!!`);
          console.log(`   플레이어 ID: ${shortId} (전체: ${playerData.id})`);
          console.log(`   새 위치: (${playerData.x}, ${playerData.y})`);
          console.log(`   현재 otherPlayers 키:`, Object.keys(otherPlayers));
          console.log(`   playerData.id가 otherPlayers에 있나?`, playerData.id in otherPlayers);
          
          if (otherPlayers[playerData.id]) {
            const beforeX = otherPlayers[playerData.id].x;
            const beforeY = otherPlayers[playerData.id].y;
            otherPlayers[playerData.id].setPosition(playerData.x, playerData.y);
            console.log(`   ✅ 위치 업데이트: (${beforeX}, ${beforeY}) -> (${playerData.x}, ${playerData.y})`);
          } else {
            console.warn(`   ⚠️ ${shortId}가 otherPlayers에 없음! 임시 생성 시도...`);
            if (scene && scene.physics) {
              const tempPlayer = scene.physics.add.sprite(playerData.x, playerData.y, 'otherPlayer');
              otherPlayers[playerData.id] = tempPlayer;
              console.log(`   ✅ ${shortId} 임시 생성 완료`);
            } else {
              console.error(`   ❌ Scene이 준비되지 않음`);
            }
          }
          console.log('='.repeat(50));
        });

        // 플레이어 퇴장
        socket.on('playerDisconnected', (playerId: string) => {
          console.log('='.repeat(50));
          console.log('➖ playerDisconnected 수신:', playerId.substring(0, 8));
          
          if (otherPlayers[playerId]) {
            otherPlayers[playerId].destroy();
            delete otherPlayers[playerId];
            console.log('✅ 플레이어 제거 완료');
          } else {
            console.log('⚠️ 해당 플레이어가 목록에 없음');
          }
          console.log('='.repeat(50));
        });

        socket.on('disconnect', (reason) => {
          console.log('❌ 서버 연결 끊김:', reason);
        });

        socket.on('error', (error) => {
          console.error('❌ 소켓 에러:', error);
        });
      }

      function addPlayer(scene: Phaser.Scene, playerInfo: any, isSelf: boolean) {
        console.log(`🎭 addPlayer 호출: ${playerInfo.id.substring(0, 8)}, isSelf: ${isSelf}`);
        
        if (isSelf) {
          // 내 캐릭터
          if (player) {
            console.log('⚠️ 플레이어가 이미 존재함, 기존 플레이어 제거');
            player.destroy();
          }
          
          player = scene.physics.add.sprite(playerInfo.x, playerInfo.y, 'player');
          player.setCollideWorldBounds(false);
          
          // 카메라 설정
          camera = scene.cameras.main;
          camera.setBounds(0, 0, 50 * 64, 50 * 64);
          camera.startFollow(player, true, 0.1, 0.1);
          
          console.log('✨ 내 캐릭터 생성 완료:', playerInfo.id.substring(0, 8));
        } else {
          // 다른 플레이어
          if (otherPlayers[playerInfo.id]) {
            console.log('⚠️ 해당 플레이어가 이미 존재함, 위치만 업데이트');
            otherPlayers[playerInfo.id].setPosition(playerInfo.x, playerInfo.y);
            return;
          }
          
          try {
            const otherPlayer = scene.physics.add.sprite(playerInfo.x, playerInfo.y, 'otherPlayer');
            otherPlayers[playerInfo.id] = otherPlayer;
            
            console.log('👥 otherPlayers에 추가:', playerInfo.id.substring(0, 8));
            console.log('   전체 ID:', playerInfo.id);
            console.log('   현재 otherPlayers 갯수:', Object.keys(otherPlayers).length);
            console.log('   otherPlayers 키 목록:', Object.keys(otherPlayers));
          } catch (error) {
            console.error('❌ 플레이어 생성 실패:', error);
          }
        }
      }

      let lastEmitTime = 0;
      const EMIT_INTERVAL = 50; // 50ms마다 한 번씩만 전송

      function update(this: Phaser.Scene) {
        if (!player) return;

        const speed = 200;
        let moved = false;
        
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

        // 움직임이 있을 때 서버로 전송 (throttle 적용)
        const now = Date.now();
        if (moved && (now - lastEmitTime > EMIT_INTERVAL)) {
          const position = {
            x: Math.round(player.x),
            y: Math.round(player.y)
          };
          
          socket.emit('playerMovement', position);
          lastEmitTime = now;
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
            F12 눌러서 콘솔 확인 - 상세 디버깅 로그 확인 가능
          </p>
          <p className="text-xs text-yellow-400 mt-1 font-semibold">
            ⚠️ 게임 화면을 클릭한 후 키보드로 이동하세요!
          </p>
        </div>
        <div ref={gameRef} className="rounded overflow-hidden" />
      </div>
    </div>
  );
}
