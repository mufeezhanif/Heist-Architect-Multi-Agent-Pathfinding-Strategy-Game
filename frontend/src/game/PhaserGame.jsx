import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { MainScene, BOARD } from './MainScene.js';

export default function PhaserGame({ state, onCellClick, astarPreview }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const sceneRef = useRef(null);
  const readyRef = useRef(false);
  const clickHandlerRef = useRef(onCellClick);
  const pendingStateRef = useRef(state);
  const pendingAStarRef = useRef(astarPreview);

  useEffect(() => { clickHandlerRef.current = onCellClick; }, [onCellClick]);

  useEffect(() => {
    // Subclass MainScene so we can hook `create()` to mark readiness after
    // super.create() completes — avoids touching scene.events before Phaser
    // has wired it up.
    class BoundScene extends MainScene {
      create() {
        super.create();
        this.setClickHandler((r, c) => {
          if (clickHandlerRef.current) clickHandlerRef.current(r, c);
        });
        readyRef.current = true;
        if (pendingStateRef.current) this.setState(pendingStateRef.current);
        if (pendingAStarRef.current) this.setAStarPreview(pendingAStarRef.current);
      }
    }
    const scene = new BoundScene();
    sceneRef.current = scene;

    const config = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: BOARD,
      height: BOARD,
      backgroundColor: '#0b0d14',
      scene,
      render: { antialias: true, pixelArt: false },
    };
    gameRef.current = new Phaser.Game(config);

    return () => {
      readyRef.current = false;
      gameRef.current?.destroy(true);
    };
  }, []);

  useEffect(() => {
    pendingStateRef.current = state;
    if (readyRef.current && sceneRef.current && state) {
      sceneRef.current.setState(state);
    }
  }, [state]);

  useEffect(() => {
    pendingAStarRef.current = astarPreview;
    if (readyRef.current && sceneRef.current) {
      sceneRef.current.setAStarPreview(astarPreview);
    }
  }, [astarPreview]);

  return <div ref={containerRef} />;
}
