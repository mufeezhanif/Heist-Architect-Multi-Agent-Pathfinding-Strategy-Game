# LinkedIn launch kit

A ready-to-paste post plus a scripted capture sequence for a 30-second
demo video.

---

## Post (paste into LinkedIn)

> **Heist Architect — an AI course project I'm genuinely proud of.** 🔐
>
> We built a two-player asymmetric strategy game that turns four textbook
> AI techniques into something you can *see*:
>
> • **A\*** with time-indexed constraints plans each thief's route
> • **Conflict-Based Search (CBS)** resolves collisions between 3 thieves in real time
> • **Bayesian belief tracking** updates the Warden's "best guess" heat-map each turn from camera & motion-sensor readings
> • **Minimax with α-β pruning** drives the guards toward the highest-probability cells
>
> Stack: Python + FastAPI + WebSocket on the backend, React + Phaser 3 on
> the frontend. Four game modes — AI vs AI, Human Mastermind, Human Warden,
> and Hotseat — so you can play the algorithms from either side.
>
> Huge thanks to my teammates Rank 1st and Hassan Mustafa.
>
> #AI #Pathfinding #CBS #BayesianInference #Minimax #GameDev #ReactJS #Phaser #FastAPI

(Attach the 30-second clip or the `screenshot.png` from the repo.)

---

## 30-second capture script

Record at 1080p, 30fps. Use OBS or `simplescreenrecorder`.

1. **[0–3s]** Open http://localhost:5173 on the `AI vs AI` mode, empty
   board, just the map.
2. **[3–5s]** Click **▶ Auto-Run Demo**. Let the CBS plan appear as three
   coloured polylines.
3. **[5–18s]** Let the thieves stream toward the vault. Pause on a moment
   where the heat-map flares red — zoom the camera (in OBS) to 120 %.
4. **[18–25s]** Switch to **Human Warden** mode. Click `Reset`, then click
   a cell near a thief path to intercept. Show the red "capture" tween.
5. **[25–30s]** End card: logo / "Heist Architect — AI course, FAST NUCES
   section 6J / built by Mufeez, Rank 1st, Hassan Mustafa."

---

## Asset checklist

- [ ] `screenshot.png` — already in repo root, 1280×900
- [ ] Architecture diagram — render [docs/ARCHITECTURE.md](ARCHITECTURE.md)
      via GitHub's mermaid preview, or `npx @mermaid-js/mermaid-cli` to SVG
- [ ] 30-second MP4 or GIF (ffmpeg: `ffmpeg -i capture.mp4 -vf scale=960:-1 -r 24 demo.gif`)
