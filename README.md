# Survival Shooter Game

A browser-based survival shooter game with RPG progression elements, built with vanilla JavaScript and HTML5 Canvas.

## 🎮 Features

### Core Gameplay
- **Wave-based survival**: Fight through increasingly difficult waves of enemies
- **Boss battles**: Every 10 waves, face challenging boss encounters
- **Movement & Combat**: WASD movement + mouse aiming and shooting
- **Enemy variety**: Basic, Fast, Tank, and Elite enemy types with different behaviors

### Progression System
- **XP & Leveling**: Earn XP from kills, level up to gain upgrades
- **Upgrade Rarity Tiers**: Common, Rare, Epic, and Legendary upgrades
- **Risk-Reward Mechanics**: Pressure system rewards aggressive play
- **Post-Wave 5 Scaling**: Difficulty increases naturally after wave 5

### Advanced Systems
- **Pressure System**: Dynamic difficulty based on player aggression
- **Elite Enemies**: Tougher enemies with better rewards
- **Boss Events**: Multi-phase boss fights with unique mechanics
- **Sound Effects**: Procedurally generated audio feedback

## 🚀 Quick Start

1. **Clone or download** this repository
2. **Open `index.html`** in your web browser
3. **No installation required** - runs entirely in the browser

## 🎯 Controls

- **WASD** - Move your character
- **Mouse** - Aim
- **Left Click** - Shoot manually
- **? Button** - Toggle help panel
- **🔊 Button** - Toggle sound on/off

## 📊 Game Mechanics

### Enemy Types
- **Basic** (70%): Standard enemies, 10 XP
- **Fast** (20%): Quick movement, 15 XP  
- **Tank** (10%): High health, 25 XP
- **Elite** (5%+): 3x HP, 2x damage, 50 XP

### Upgrade System
- **🟢 Common** (60%): Small stat increases
- **🔵 Rare** (25%): Noticeable improvements
- **🟣 Epic** (12%): Build-defining upgrades
- **🟡 Legendary** (3%): Game-changing powers

### Difficulty Scaling
- **Waves 1-5**: Fast progression, early power fantasy
- **Waves 6+**: Increased XP requirements, strategic choices
- **Risk System**: Aggressive play = faster leveling

## 🛠️ Technical Details

### Built With
- **HTML5 Canvas** for rendering
- **Vanilla JavaScript** (no frameworks)
- **Web Audio API** for procedural sound generation
- **CSS3** for UI styling

### File Structure
```
gamew/
├── index.html          # Main game page
├── game/
│   ├── game.js         # Core game logic
│   ├── sounds.js       # Sound effects system
│   └── style.css       # Game styling
└── README.md           # This file
```

### Performance
- **60 FPS** target framerate
- **Optimized collision detection**
- **Efficient particle systems**
- **Minimal memory usage**

## 🎨 Game Design

### Core Loop
1. Survive waves of enemies
2. Collect XP orbs from kills
3. Level up and choose upgrades
4. Face boss challenges every 10 waves
5. Progress as long as you can survive

### Balance Philosophy
- **Fair difficulty**: Small incremental changes (10-30%)
- **Player agency**: Risk vs. reward choices
- **Build variety**: Multiple viable upgrade paths
- **Skill expression**: Movement and positioning matter

## 🔧 Development

### Adding New Content
- **Enemies**: Add to `enemyTypes` object in `game.js`
- **Upgrades**: Add to `upgradePool` object in `game.js`
- **Sounds**: Add new sound types to `sounds.js`
- **Styling**: Modify `style.css` for UI changes

### Browser Compatibility
- **Chrome/Edge**: Full support
- **Firefox**: Full support  
- **Safari**: Full support
- **Mobile**: Not optimized (desktop only)

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 🐛 Bug Reports

Please report issues through GitHub Issues with:
- Browser version and OS
- Steps to reproduce
- Expected vs. actual behavior
- Console errors (if any)

---

**Enjoy the game!** 🎮
