# 🎮 HEIST ARCHITECT - GAME GUIDE FOR BEGINNERS

---

## 🎯 **WHAT IS THIS GAME?**

You are the **MASTERMIND** planning a heist in a high-security building. You command a **crew of 3 thieves** trying to steal valuable items while avoiding **guards and security systems**. The AI controls both your crew and the enemy guards in an intelligent cat-and-mouse game.

---

## 🏆 **HOW TO WIN - STEP BY STEP**

### **OBJECTIVE 1: Plan Your Route** 🗺️
1. **Select each crew member** (Hacker, Thief, Muscle)
2. **Click on the maze** to mark their destination
3. Each agent follows the **green highlighted path** you see on the maze
4. **Avoid guards** (red figures) and **cameras** (pink cones)

### **OBJECTIVE 2: Complete Mission Tasks** 🎯
Your crew must complete **3 green objectives** on the maze:
- **Hack the Server** 💻 - Disable alarms
- **Steal the Loot** 💰 - Get the valuable item
- **Disable the Alarm** 🚨 - Stop security alerts

**You must complete ALL 3 to move forward!**

### **OBJECTIVE 3: Escape the Building** 🚪
Once you've completed all objectives:
1. Head to the **orange extraction point** (exit door)
2. All crew members must reach this point
3. **Everyone must be alive and extracted**

### **YOU WIN WHEN:** ✅
✅ All 3 objectives are completed  
✅ All crew members are at the extraction point  
✅ **No crew members are detected by guards**

### **YOU LOSE WHEN:** ❌
❌ Any crew member is caught by a guard  
❌ Guards discover your route  
❌ Security alarm is triggered (alert level goes RED)

---

## 🛡️ **WHAT YOU NEED TO KNOW ABOUT ENEMIES**

### **Guards (Red Figures)** 👮
- **Walk in patrol routes** around the building
- **Have vision cones** - if they see you, they catch you!
- **Get alerted by sensors** - motion sensors, door sensors, cameras
- **Can communicate** - when one guard spots you, others get notified

### **Security Systems** 🔒
These are your REAL enemies, not just guards:

| System | Color | How It Works |
|--------|-------|--------------|
| **Camera** 📷 | Pink/Red | Detects crew instantly if they're in its vision cone |
| **Motion Sensor** 🔔 | Cyan | Triggers alarm if crew moves near it |
| **Door Sensor** 🚪 | Orange | Alerts guards when you open a door |
| **Sound Sensor** 🔊 | Magenta | Detects loud noise from crew actions |

---

## 🎮 **HOW THE AI WORKS - SIMPLE EXPLANATION**

### **A\* ALGORITHM (For Your Crew - Pathfinding)** 🧭

**What it does:**
- Calculates the **shortest safe path** from current position to destination
- **Avoids walls and obstacles** automatically
- Finds routes that **dodge guards and cameras**

**Think of it like:**
> A GPS that not only knows the fastest route but also avoids areas with police

**How it helps you:**
- Your crew automatically takes the **best route** you plan
- No wasted moves or running into walls

---

### **CBS Algorithm (Conflict-Based Search - Multi-Agent Planning)** 🎬

**What it does:**
- Makes sure **all 3 crew members don't collide** with each other
- Resolves conflicts when paths cross (like traffic control)
- **Coordinates timing** so crew members don't bump into each other

**Think of it like:**
> A choreographer making sure 3 dancers don't crash into each other on stage

**How it helps you:**
- Multiple crew members can move simultaneously
- **No collisions** between your own team members
- Efficient group heist execution

---

### **Bayesian Tracker (For Guards - Prediction)** 🧠

**What it does:**
- **Learns and predicts** where your crew might be
- The Warden (AI Guard Commander) uses sensor data to **guess your position**
- Updates predictions based on:
  - When sensors trigger
  - Where guards saw you last
  - Building layout and escape routes

**Think of it like:**
> A detective who leaves a sensor at each door and predicts where the criminal will go based on which doors are triggered

**How guards use it:**
- If you trigger a **motion sensor**, guards know approximately where you are
- They'll **converge on that area** from multiple directions
- **Silent sensors** (no alarm) still give guards hints

---

### **Minimax Algorithm (Guard Strategy)** ⚔️

**What it does:**
- **Guard commander plans the best defense** strategy
- Calculates moves like chess:
  - "If crew goes left, station guards on left"
  - "If crew goes right, send guards right"
- Tries to **maximize chance of catching you**

**Think of it like:**
> A chess master thinking 5 moves ahead, predicting where you'll go and blocking you

**How guards use it:**
- **Adaptive behavior** - they learn your patterns
- **Block escape routes** if they predict you'll use them
- **Coordinate ambushes** at vulnerable points

---

### **Mini-Agents (Individual Guard AI)** 👮‍♂️

**What each guard does:**
- **Patrol assigned routes** (A* pathfinding for themselves)
- **React to sensor alerts** immediately
- **Chase you if detected** with aggressive pathfinding
- **Communicate with other guards** to corner you

**Think of it like:**
> Each guard is a semi-autonomous soldier following orders but also making decisions

---

## 📊 **GAME STATE MONITORING**

### **Green Zones (Safe)** ✅
- No alerts
- Crew can move freely
- Guards relaxed and on patrol

### **Yellow Zone (Caution)** ⚠️
- Low alert level
- Guards are searching
- Sensors have been triggered but not guards yet

### **Red Zone (Danger)** 🔴
- High alert
- Guards actively hunting
- Might trigger lockdown soon

### **Lockdown (GAME OVER)** 💀
- All exits sealed
- No escape possible
- Automatic loss

---

## 💡 **PRO TIPS TO WIN**

1. **Use the Hacker** 💻
   - Disables security systems
   - Can hack cameras and sensors
   - Best for sneaky routes

2. **Use the Thief** 🦊
   - Fast movement
   - Can pick locks on doors
   - Best for quick escapes

3. **Use the Muscle** 💪
   - Can overpower guards if caught
   - Strong and intimidating
   - Best for direct routes

4. **Avoid Sensors** 🔔
   - Plan around motion sensors
   - Don't trigger door sensors unless necessary
   - Disable cameras before passing

5. **Coordinate Timing** ⏱️
   - Stagger crew movements
   - Don't all move at once
   - Create distractions with one agent while others move

6. **Know Exit Paths** 🚪
   - Always have escape route clear
   - Don't box yourself in
   - Keep extraction point accessible

---

## 🤖 **HOW AI ALGORITHMS COMPETE AGAINST YOU**

```
YOUR CREW          →  A*, CBS        →  SMART PATHFINDING
                        Algorithms          (Finding best routes)
                            ↓
                    
BUILDING LAYOUT    →  Bayesian       →  GUARD PREDICTION
Sensors, Cameras       Tracker            (Guessing your moves)
                            ↓

GUARDS             →  Minimax        →  STRATEGY PLANNING
                        Algorithm       (Planning counter-moves)
                            ↓

RESULT: An intelligent opponent that learns from your moves
```

---

## 📈 **DIFFICULTY PROGRESSION**

| Level | Guards | Sensors | AI Strategy |
|-------|--------|---------|-------------|
| **Easy** | 2-3 | Few | Random patrols |
| **Medium** | 4-5 | Many | Reactive (follow sensors) |
| **Hard** | 6+ | Everywhere | Predictive (predict your moves) |
| **Extreme** | 8+ | Dense coverage | Minimax + Learning |

---

## 🎮 **QUICK START**

1. **Press PLAY**
2. **Select your crew members** by clicking on them
3. **Click destination on maze** for each crew
4. **Watch AI calculate paths** (colored lines appear)
5. **Press START MISSION**
6. **Monitor alert level** at bottom
7. **Complete all green objectives** before extraction
8. **Reach orange extraction point** with entire crew
9. **VICTORY!** 🎉

---

## ❓ **COMMON QUESTIONS**

**Q: Why did my crew get caught?**
- A guard saw them, or they triggered a sensor with too much alert

**Q: What does "CONFLICT" mean?**
- Two crew members trying to be in same place - CBS algorithm is resolving

**Q: Why is there a red cone on screen?**
- That's the guard's vision range - avoid being inside it!

**Q: Can I pause mid-mission?**
- Check game settings (might be turn-based or real-time)

**Q: What's the score system?**
- Faster completion = higher score
- Not getting caught = bonus points
- Completing objectives = base points

---

## 🏅 **ACHIEVEMENTS TO UNLOCK**

⭐ **Ghost** - Complete mission without triggering any sensors  
⭐ **Speedrunner** - Complete in under 5 turns  
⭐ **Perfect Storm** - Complete all objectives without alerts  
⭐ **Mastermind** - Beat mission on hardest difficulty  
⭐ **Flawless** - Win without any crew member getting close to guards

---

**Good luck, Mastermind! Time to plan the perfect heist! 🕵️‍♂️🎯**
