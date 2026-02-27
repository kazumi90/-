// Game canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Upgrade Menu UI
const upgradeMenu = document.getElementById('upgradeMenu');
const upgradeChoices = document.getElementById('upgradeChoices');
const healthBar = document.getElementById('healthBar');
const xpBar = document.getElementById('xpBar');
const xpText = document.getElementById('xpText');
const scoreDisplay = document.getElementById('score');
const gameOverScreen = document.getElementById('gameOver');
const finalScoreDisplay = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');
const helpBtn = document.getElementById('helpBtn');
const instructionsPanel = document.getElementById('instructionsPanel');
const closeInstructions = document.getElementById('closeInstructions');
const waveDisplay = document.getElementById('waveDisplay');

// Game state
let gameRunning = true;
let score = 0;
let frameCount = 0;
let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;

// Player
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 15,
    speed: 4,
    maxHealth: 100,
    health: 100,
    passiveCooldown: 0,
    manualCooldown: 0,
    passiveRate: 25,
    manualRate: 12,
    auraRadius: 150,
    bulletDamage: 1,
    bulletSize: 4,
    multishot: 1
};

// Level & XP system - NEW CENTRALIZED SYSTEM
const xpSystem = {
    currentXP: 0,
    currentLevel: 1,
    xpToNextLevel: 50,
    baseXP: 50,
    xpOrbs: [],
    magnetRange: 60,
    levelFatigue: 0, // Stacking XP requirement increase
    
    // Calculate XP needed for next level using quadratic scaling with wave-based difficulty
    calculateXPRequired(level) {
        let baseRequirement = Math.floor(this.baseXP * Math.pow(level, 1.5));
        
        // Wave-based difficulty scaling (after wave 5)
        const wave = waveManager.currentWave;
        let difficultyMultiplier = 1;
        
        if (wave >= 6 && wave <= 10) {
            difficultyMultiplier = 1.1; // +10% XP requirement
        } else if (wave >= 11 && wave <= 15) {
            difficultyMultiplier = 1.2; // +20% XP requirement
        } else if (wave >= 16) {
            difficultyMultiplier = 1.3; // +30% XP requirement
        }
        
        // Apply level fatigue (stacking during run)
        const fatigueMultiplier = 1 + (this.levelFatigue * 0.05); // +5% per level
        
        return Math.floor(baseRequirement * difficultyMultiplier * fatigueMultiplier);
    },
    
    // Centralized XP addition - only called from orb collection
    addXP(amount) {
        this.currentXP += amount;
        console.log('XP added:', amount, 'total:', this.currentXP);
        this.checkLevelUp();
        this.updateUI();
    },
    
    // Handle level ups with proper overflow and fatigue
    checkLevelUp() {
        while (this.currentXP >= this.xpToNextLevel) {
            this.currentXP -= this.xpToNextLevel;
            this.currentLevel++;
            this.levelFatigue++; // Increase fatigue for next level
            this.xpToNextLevel = this.calculateXPRequired(this.currentLevel);
            console.log('LEVEL UP!', 'now level', this.currentLevel, 'fatigue', this.levelFatigue);
            this.onLevelUp();
        }
    },
    
    // Level up handler
    onLevelUp() {
        gamePaused = true;
        soundManager.playSound('levelup');
        showUpgradeMenu();
    },
    
    // Spawn XP orb when enemy dies
    spawnXPOrb(x, y, value) {
        this.xpOrbs.push({
            x: x,
            y: y,
            value: value,
            lifetime: 600, // 10 seconds at 60fps
            size: Math.min(8, Math.max(3, value / 5)), // Size based on XP value
            collected: false
        });
    },
    
    // Update orb movement and collection
    updateOrbs() {
        this.xpOrbs = this.xpOrbs.filter(orb => {
            orb.lifetime--;
            
            // Remove expired orbs
            if (orb.lifetime <= 0) return false;
            
            // Check if player is in magnet range
            const dx = player.x - orb.x;
            const dy = player.y - orb.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < this.magnetRange) {
                // Move orb toward player
                const speed = 3;
                orb.x += (dx / distance) * speed;
                orb.y += (dy / distance) * speed;
                
                // Collect if touching player
                if (distance < player.radius + orb.size) {
                    this.addXP(orb.value);
                    createParticles(orb.x, orb.y, '#7ab87a', 5);
                    soundManager.playSound('xp');
                    return false;
                }
            }
            
            return true;
        });
    },
    
    // Update UI elements
    updateUI() {
        const xpPercent = (this.currentXP / this.xpToNextLevel) * 100;
        xpBar.style.width = xpPercent + '%';
        xpText.textContent = `Level ${this.currentLevel}`;
    },
    
    // Initialize system
    init() {
        this.currentXP = 0;
        this.currentLevel = 1;
        this.levelFatigue = 0; // Reset fatigue on new run
        this.xpToNextLevel = this.calculateXPRequired(1);
        this.xpOrbs = [];
        this.updateUI();
    }
};

let gamePaused = false;

// Enemy type definitions with XP values
const enemyTypes = {
    basic: {
        xpValue: 10,
        speed: 1,
        health: 1,
        radius: 12,
        color: '#4a2a2a',
        spawnChance: 0.65 // 65% spawn chance
    },
    fast: {
        xpValue: 15,
        speed: 2,
        health: 1,
        radius: 8,
        color: '#6a3a3a',
        spawnChance: 0.2 // 20% spawn chance
    },
    tank: {
        xpValue: 25,
        speed: 0.7,
        health: 3,
        radius: 20,
        color: '#2a1a1a',
        spawnChance: 0.1 // 10% spawn chance
    },
    elite: {
        xpValue: 50,
        speed: 1.2,
        health: 9,
        radius: 16,
        color: '#8a1a1a',
        spawnChance: 0.05 // 5% base spawn chance
    }
};

// Risk-based XP boost system
const riskSystem = {
    killTimer: 0,
    recentKills: 0,
    
    update() {
        // Decay recent kills over time
        if (this.recentKills > 0 && this.killTimer <= 0) {
            this.recentKills = Math.max(0, this.recentKills - 1);
            this.killTimer = 180; // 3 seconds
        }
        this.killTimer--;
    },
    
    onKill() {
        this.recentKills++;
        this.killTimer = 180; // Reset timer
    },
    
    getRiskMultiplier() {
        let multiplier = 1;
        
        // Nearby enemies bonus
        const nearbyEnemies = enemies.filter(enemy => {
            const dx = enemy.x - player.x;
            const dy = enemy.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < 150;
        }).length;
        
        if (nearbyEnemies >= 5) multiplier += 0.2; // +20% XP for high density
        
        // Quick kills bonus
        if (this.recentKills >= 3) multiplier += 0.15; // +15% XP for rapid kills
        
        // Elite cluster bonus
        const nearbyElites = enemies.filter(enemy => {
            if (!enemy.isElite) return false;
            const dx = enemy.x - player.x;
            const dy = enemy.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < 200;
        }).length;
        
        if (nearbyElites >= 2) multiplier += 0.1; // +10% XP for elite clusters
        
        return multiplier;
    }
};

// Pressure system for risk-reward scaling
const pressureSystem = {
    pressure: 0,
    maxPressure: 100,
    
    update() {
        // Count nearby enemies
        const nearbyEnemies = enemies.filter(enemy => {
            const dx = enemy.x - player.x;
            const dy = enemy.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < 150; // 150px detection radius
        }).length;
        
        // Increase pressure based on enemy density
        if (nearbyEnemies >= 5) {
            this.pressure = Math.min(this.maxPressure, this.pressure + 0.5);
        } else if (nearbyEnemies >= 3) {
            this.pressure = Math.min(this.maxPressure, this.pressure + 0.2);
        } else {
            // Decrease pressure when safe
            this.pressure = Math.max(0, this.pressure - 0.3);
        }
        
        // Bonus pressure for quick kills
        if (killCombo > 3) {
            this.pressure = Math.min(this.maxPressure, this.pressure + 0.3);
        }
    },
    
    getXPMultiplier() {
        return 1 + (this.pressure / this.maxPressure) * 0.3; // Up to +30% XP
    },
    
    getEliteChance() {
        const baseChance = enemyTypes.elite.spawnChance;
        const pressureBonus = (this.pressure / this.maxPressure) * 0.1; // Up to +10%
        return baseChance + pressureBonus;
    }
};

// Survival reward scaling system
let survivalTime = 0; // Frames survived
let killCombo = 0; // Consecutive kills without damage
let lastDamageFrame = 0; // Frame when last damage taken
const COMBO_MAX_MULTIPLIER = 2.0; // Cap at 2x XP
const SURVIVAL_BONUS_INTERVAL = 300; // 5 seconds at 60fps

// Calculate XP multiplier based on survival time and combo (for future use)
function getXPMultiplier() {
    // Base multiplier from survival time (logarithmic growth, max 1.5x at 10 min)
    const minutesSurvived = survivalTime / 3600; // 60fps * 60s = 3600 frames/minute
    const timeMultiplier = 1 + Math.min(0.5, Math.log10(1 + minutesSurvived) * 0.3);
    
    // Combo multiplier (linear growth up to cap)
    const comboMultiplier = 1 + Math.min(COMBO_MAX_MULTIPLIER - 1, killCombo * 0.05);
    
    return timeMultiplier * comboMultiplier;
}

// Upgrade definitions with rarity system
const upgradePool = {
    common: [
        {
            id: 'damage',
            name: 'Heavy Bullets',
            description: '+5% bullet damage',
            icon: '💥',
            apply: () => { player.bulletDamage = (player.bulletDamage || 1) * 1.05; }
        },
        {
            id: 'moveSpeed',
            name: 'Swift Boots',
            description: '+5% movement speed',
            icon: '👢',
            apply: () => { player.speed *= 1.05; }
        },
        {
            id: 'fireRate',
            name: 'Quick Trigger',
            description: '+5% fire rate',
            icon: '⚡',
            apply: () => {
                player.passiveRate = Math.max(8, Math.floor(player.passiveRate * 0.95));
                player.manualRate = Math.max(5, Math.floor(player.manualRate * 0.95));
            }
        },
        {
            id: 'maxHealth',
            name: 'Vitality',
            description: '+10 max health',
            icon: '❤️',
            apply: () => { player.maxHealth += 10; player.health = Math.min(player.maxHealth, player.health + 5); updateHealthBar(); }
        },
        {
            id: 'auraRange',
            name: 'Extended Aura',
            description: '+10% aura range',
            icon: '✨',
            apply: () => { player.auraRadius *= 1.1; }
        }
    ],
    rare: [
        {
            id: 'pierce',
            name: 'Piercing Shots',
            description: 'Bullets pierce 1 enemy',
            icon: '🎯',
            apply: () => { player.bulletPierce = (player.bulletPierce || 0) + 1; }
        },
        {
            id: 'projectileSpeed',
            name: 'Velocity Boost',
            description: '+15% projectile speed',
            icon: '🚀',
            apply: () => { player.projectileSpeed = (player.projectileSpeed || 10) * 1.15; }
        },
        {
            id: 'autoFire',
            name: 'Auto-Fire Module',
            description: 'Reduce aura cooldown by 20%',
            icon: '🔫',
            apply: () => { player.passiveRate = Math.max(5, Math.floor(player.passiveRate * 0.8)); }
        },
        {
            id: 'knockback',
            name: 'Force Burst',
            description: 'Push enemies back when hit',
            icon: '💨',
            apply: () => { player.knockback = (player.knockback || 0) + 3; }
        },
        {
            id: 'bulletSize',
            name: 'Mega Bullets',
            description: 'Bullets are 25% larger',
            icon: '🔵',
            apply: () => { player.bulletSize = (player.bulletSize || 4) * 1.25; }
        }
    ],
    epic: [
        {
            id: 'explode',
            name: 'Explosive Rounds',
            description: 'Bullets explode on hit',
            icon: '💣',
            apply: () => { player.bulletExplode = true; }
        },
        {
            id: 'multishot',
            name: 'Double Shot',
            description: 'Fire 2 bullets at once',
            icon: '🔫',
            apply: () => { player.multishot = 2; }
        },
        {
            id: 'orbit',
            name: 'Orbiting Shield',
            description: 'Orbiting damage projectile',
            icon: '🛡️',
            apply: () => { player.orbitingShield = true; }
        },
        {
            id: 'lifeSteal',
            name: 'Vampiric Touch',
            description: 'Heal 1 HP per 10 kills',
            icon: '🩸',
            apply: () => { player.lifeSteal = true; }
        },
        {
            id: 'magnet',
            name: 'XP Magnet',
            description: '+50% XP orb magnet range',
            icon: '🧲',
            apply: () => { xpSystem.magnetRange *= 1.5; }
        }
    ],
    legendary: [
        {
            id: 'chainLightning',
            name: 'Chain Lightning',
            description: 'Bullets chain to nearby enemies',
            icon: '⚡',
            apply: () => { player.chainLightning = true; }
        },
        {
            id: 'tripleDamage',
            name: 'Critical Strike',
            description: 'Every 5th shot deals 3x damage',
            icon: '💀',
            apply: () => { player.criticalStrike = true; }
        },
        {
            id: 'tempInvuln',
            name: 'Second Wind',
            description: 'Temporary invincibility after level up',
            icon: '👑',
            apply: () => { player.levelUpInvuln = true; }
        },
        {
            id: 'timeStop',
            name: 'Time Freeze',
            description: 'Enemies slow for 2s after level up',
            icon: '⏰',
            apply: () => { player.timeStop = true; }
        }
    ]
};

// Get 3 random upgrades with rarity system and wave-based adjustment
function getRandomUpgrades() {
    const upgrades = [];
    const level = xpSystem.currentLevel;
    const wave = waveManager.currentWave;
    
    // Legendary only appears after level 4
    const allowLegendary = level >= 4;
    
    // At least 1 must be Common or Rare
    const guaranteedCommonRare = Math.random() < 0.7;
    
    // Wave-based rarity adjustment (after wave 5)
    const waveAdjustment = wave > 5;
    
    for (let i = 0; i < 3; i++) {
        let rarity = getRandomRarity(allowLegendary, waveAdjustment);
        
        // Ensure at least one Common or Rare
        if (i === 2 && guaranteedCommonRare && (upgrades[0].rarity === 'epic' || upgrades[0].rarity === 'legendary') && (upgrades[1].rarity === 'epic' || upgrades[1].rarity === 'legendary')) {
            rarity = Math.random() < 0.7 ? 'common' : 'rare';
        }
        
        const pool = upgradePool[rarity];
        const upgrade = pool[Math.floor(Math.random() * pool.length)];
        upgrades.push({ ...upgrade, rarity });
    }
    
    return upgrades;
}

function getRandomRarity(allowLegendary, waveAdjustment) {
    const roll = Math.random() * 100;
    
    // Adjust chances after wave 5
    if (waveAdjustment) {
        if (allowLegendary && roll < 3) return 'legendary';      // 3% (unchanged)
        if (roll < 12) return 'epic';                             // 12% (reduced from 15%)
        if (roll < 35) return 'rare';                             // 23% (reduced from 25%)
        return 'common';                                         // 65% (increased from 60%)
    } else {
        // Pre-wave 6: Higher rare chance for early power fantasy
        if (allowLegendary && roll < 3) return 'legendary';      // 3%
        if (roll < 18) return 'epic';                             // 15% (slightly higher)
        if (roll < 43) return 'rare';                             // 25% (slightly higher)
        return 'common';                                         // 57% (slightly lower)
    }
}

// Show upgrade menu with rarity styling
function showUpgradeMenu() {
    gamePaused = true;
    const upgrades = getRandomUpgrades();
    
    upgradeChoices.innerHTML = '';
    upgrades.forEach(upgrade => {
        const card = document.createElement('div');
        card.className = `upgrade-card upgrade-${upgrade.rarity}`;
        
        const rarityColor = {
            common: '#7ab87a',
            rare: '#5a8aff',
            epic: '#9a5aff',
            legendary: '#ffaa00'
        };
        
        card.innerHTML = `
            <div class="upgrade-glow" style="background: ${rarityColor[upgrade.rarity]}"></div>
            <span class="upgrade-icon">${upgrade.icon}</span>
            <h3>${upgrade.name}</h3>
            <p>${upgrade.description}</p>
            <div class="upgrade-rarity">${upgrade.rarity.toUpperCase()}</div>
        `;
        card.addEventListener('click', () => selectUpgrade(upgrade));
        upgradeChoices.appendChild(card);
    });
    
    upgradeMenu.style.display = 'flex';
}

// Upgrade persistence system
const SAVE_KEY = 'survivalShooter_upgrades';

function saveUpgrades() {
    const upgradeData = {
        bulletDamage: player.bulletDamage,
        bulletSize: player.bulletSize,
        multishot: player.multishot,
        knockback: player.knockback,
        speed: player.speed,
        maxHealth: player.maxHealth,
        passiveRate: player.passiveRate,
        manualRate: player.manualRate
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(upgradeData));
}

function loadUpgrades() {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
        const data = JSON.parse(saved);
        player.bulletDamage = data.bulletDamage || 1;
        player.bulletSize = data.bulletSize || 4;
        // Don't load multishot from save - must earn it each run
        player.knockback = data.knockback || 0;
        player.speed = data.speed || 4;
        player.maxHealth = data.maxHealth || 100;
        player.passiveRate = data.passiveRate || 25;
        player.manualRate = data.manualRate || 12;
        return true;
    }
    return false;
}

function clearUpgrades() {
    localStorage.removeItem(SAVE_KEY);
}

// Apply selected upgrade
function selectUpgrade(upgrade) {
    upgrade.apply();
    saveUpgrades(); // Auto-save on upgrade
    upgradeMenu.style.display = 'none';
    gamePaused = false;
}

// Add XP and check for level up
function addXP(amount) {
    xp += amount;
    updateXPBar();
    if (xp >= xpToNextLevel) {
        xp -= xpToNextLevel;
        playerLevel++;
        xpToNextLevel = Math.floor(xpToNextLevel * 1.2);
        updateXPBar();
        showUpgradeMenu();
    }
}

// Track kill for combo system
function trackKill() {
    killCombo++;
}

// Track damage taken (resets combo)
function trackDamage() {
    killCombo = 0;
    lastDamageFrame = frameCount;
}

// Fire bullet function (source can be 'passive' or 'manual')
function fireBullet(source = 'passive') {
    const isManual = source === 'manual';
    let baseAngle;
    
    if (isManual) {
        // Manual aims toward mouse
        baseAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
    } else {
        // Passive aims toward nearest enemy with randomization
        const target = findNearestEnemy();
        if (!target) return false;
        const perfectAngle = Math.atan2(target.y - player.y, target.x - player.x);
        // Add randomness (±0.4 radians / ~23 degrees)
        baseAngle = perfectAngle + (Math.random() - 0.5) * 0.8;
    }
    
    const bulletCount = player.multishot || 1;
    const spreadAngle = bulletCount > 1 ? 0.3 : 0;
    // Manual does 2x damage, passive does 0.5x (balanced)
    const damageMult = isManual ? 2.0 : 0.5;
    const sizeMult = isManual ? 1.0 : 0.7;
    
    for (let i = 0; i < bulletCount; i++) {
        const angleOffset = bulletCount > 1 ? (i - (bulletCount - 1) / 2) * spreadAngle : 0;
        const angle = baseAngle + angleOffset;
        bullets.push({
            x: player.x + Math.cos(angle) * player.radius,
            y: player.y + Math.sin(angle) * player.radius,
            vx: Math.cos(angle) * 10,
            vy: Math.sin(angle) * 10,
            damage: (player.bulletDamage || 1) * damageMult,
            size: (player.bulletSize || 4) * sizeMult,
            source: source
        });
    }
    return true;
}

// Find nearest enemy within aura radius
function findNearestEnemy() {
    let nearest = null;
    let nearestDist = Infinity;
    
    for (const enemy of enemies) {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < player.auraRadius && dist < nearestDist) {
            nearestDist = dist;
            nearest = enemy;
        }
    }
    return nearest;
}

const keys = {};

// Game objects
let bullets = [];
let enemies = [];
let particles = [];

// Screen shake & flash effects
let screenShake = 0;
let hitFlash = 0;

function addScreenShake(amount) {
    screenShake = Math.max(screenShake, amount);
}

function addHitFlash(amount) {
    hitFlash = Math.min(1, hitFlash + amount);
}

// Wave Manager System with Boss Events
const waveManager = {
    currentWave: 1,
    state: 'active', // 'active', 'preparing', 'boss_warning', 'boss_fight'
    enemiesRemaining: 0,
    enemiesToSpawn: 0,
    countdown: 0,
    countdownDuration: 180, // 3 seconds at 60fps
    spawnTimer: 0,
    spawnRate: 60, // Frames between spawns within a wave
    minSpawnRate: 30,
    bossActive: false,
    bossWarningTimer: 0,
    
    startWave() {
        // Check for boss event every 10 waves
        if (this.currentWave % 10 === 0) {
            this.startBossWarning();
            return;
        }
        
        this.state = 'active';
        this.enemiesToSpawn = 5 + (this.currentWave * 3);
        this.enemiesRemaining = this.enemiesToSpawn;
        this.spawnTimer = 0;
        this.spawnRate = Math.max(this.minSpawnRate, 60 - (this.currentWave * 2));
        updateWaveDisplay();
    },
    
    startBossWarning() {
        this.state = 'boss_warning';
        this.bossWarningTimer = 180; // 3 seconds warning
        soundManager.playSound('boss');
        updateWaveDisplay();
    },
    
    startBossFight() {
        this.state = 'boss_fight';
        this.bossActive = true;
        spawnBoss();
        updateWaveDisplay();
    },
    
    startPreparation() {
        this.state = 'preparing';
        this.countdown = this.countdownDuration;
        updateWaveDisplay();
    },
    
    update() {
        if (this.state === 'boss_warning') {
            this.bossWarningTimer--;
            if (this.bossWarningTimer <= 0) {
                this.startBossFight();
            }
            return;
        }
        
        if (this.state === 'preparing') {
            this.countdown--;
            updateWaveDisplay();
            if (this.countdown <= 0) {
                this.currentWave++;
                this.startWave();
            }
            return;
        }
        
        if (this.state === 'boss_fight') {
            // Check if boss is defeated
            const boss = enemies.find(e => e.isBoss);
            if (!boss) {
                this.bossActive = false;
                this.currentWave++;
                this.startPreparation();
            }
            return;
        }
        
        // Active wave - spawn enemies
        if (this.enemiesToSpawn > 0) {
            this.spawnTimer++;
            if (this.spawnTimer >= this.spawnRate) {
                this.spawnTimer = 0;
                spawnEnemy();
                this.enemiesToSpawn--;
            }
        }
        
        // Check wave completion
        if (this.enemiesToSpawn === 0 && enemies.length === 0) {
            this.startPreparation();
        }
    },
    
    enemyDefeated() {
        this.enemiesRemaining--;
    },
    
    reset() {
        this.currentWave = 1;
        this.state = 'active';
        this.enemiesRemaining = 0;
        this.enemiesToSpawn = 0;
        this.countdown = 0;
        this.spawnTimer = 0;
        this.spawnRate = 60;
        this.bossActive = false;
        this.bossWarningTimer = 0;
    }
};

function updateWaveDisplay() {
    if (!waveDisplay) return;
    
    if (waveManager.state === 'preparing') {
        const seconds = Math.ceil(waveManager.countdown / 60);
        waveDisplay.textContent = `Wave ${waveManager.currentWave + 1} in ${seconds}s`;
        waveDisplay.style.color = '#b8a050';
    } else if (waveManager.state === 'boss_warning') {
        const seconds = Math.ceil(waveManager.bossWarningTimer / 60);
        waveDisplay.textContent = `BOSS INCOMING in ${seconds}s`;
        waveDisplay.style.color = '#ff5050';
        waveDisplay.style.animation = 'pulse 0.5s infinite';
    } else if (waveManager.state === 'boss_fight') {
        waveDisplay.textContent = 'BOSS FIGHT';
        waveDisplay.style.color = '#ff3030';
        waveDisplay.style.animation = 'pulse 1s infinite';
    } else {
        waveDisplay.textContent = `Wave ${waveManager.currentWave}`;
        waveDisplay.style.color = '#9a9a8a';
        waveDisplay.style.animation = 'none';
    }
}

// Event listeners
document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

canvas.addEventListener('mousedown', () => {
    if (!gameRunning || gamePaused) return;
    // Manual has independent cooldown - never blocked by passive
    if (player.manualCooldown > 0) return;
    
    fireBullet('manual');
    player.manualCooldown = player.manualRate;
    addScreenShake(3);
    soundManager.playSound('shoot');
});

restartBtn.addEventListener('click', resetGame);

// Sound toggle button
const soundBtn = document.getElementById('soundBtn');
soundBtn.addEventListener('click', () => {
    const enabled = soundManager.toggle();
    soundBtn.textContent = enabled ? '🔊' : '🔇';
});

// Instructions panel toggle
helpBtn.addEventListener('click', () => {
    const isVisible = instructionsPanel.style.display === 'flex';
    instructionsPanel.style.display = isVisible ? 'none' : 'flex';
    gamePaused = !isVisible;
});

closeInstructions.addEventListener('click', () => {
    instructionsPanel.style.display = 'none';
    gamePaused = false;
    localStorage.setItem('survivalShooter_helpSeen', 'true');
});

function resetGame() {
    gameRunning = true;
    gamePaused = false;
    score = 0;
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.health = player.maxHealth;
    console.log('player init', player.health, player.maxHealth); // Debug log
    updateHealthBar(); // Ensure health bar displays correctly immediately
    player.shootCooldown = 0;
    player.passiveCooldown = 0;
    player.manualCooldown = 0;
    player.auraRadius = 150;
    player.multishot = 1;
    bullets = [];
    enemies = [];
    particles = [];
    screenShake = 0;
    hitFlash = 0;
    frameCount = 0;
    survivalTime = 0;
    killCombo = 0;
    lastDamageFrame = 0;
    
    // Initialize new XP system
    xpSystem.init();
    
    waveManager.reset();
    waveManager.startWave();
    upgradeMenu.style.display = 'none';
    gameOverScreen.style.display = 'none';
    updateHealthBar();
    updateScore();
    updateWaveDisplay();
}

function updateHealthBar() {
    const healthPercent = (player.health / player.maxHealth) * 100;
    healthBar.style.width = healthPercent + '%';
    if (healthPercent < 30) {
        healthBar.style.background = 'linear-gradient(90deg, #8a3a3a, #a05050)';
    } else {
        healthBar.style.background = 'linear-gradient(90deg, #5a8a5a, #7ab87a)';
    }
}

function updateScore() {
    scoreDisplay.textContent = `Score: ${score}`;
}

function spawnEnemy() {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    const margin = 30;

    switch(side) {
        case 0: x = Math.random() * canvas.width; y = -margin; break;
        case 1: x = canvas.width + margin; y = Math.random() * canvas.height; break;
        case 2: x = Math.random() * canvas.width; y = canvas.height + margin; break;
        case 3: x = -margin; y = Math.random() * canvas.height; break;
    }

    // Select enemy type based on spawn chances and pressure
    const rand = Math.random();
    let type = 'basic';
    let cumulative = 0;
    
    // Adjust spawn chances based on pressure
    const adjustedChances = {
        basic: enemyTypes.basic.spawnChance - (pressureSystem.pressure / pressureSystem.maxPressure) * 0.1,
        fast: enemyTypes.fast.spawnChance,
        tank: enemyTypes.tank.spawnChance + (pressureSystem.pressure / pressureSystem.maxPressure) * 0.05,
        elite: pressureSystem.getEliteChance()
    };
    
    // Normalize chances
    const totalChance = Object.values(adjustedChances).reduce((a, b) => a + b, 0);
    for (const [enemyType, chance] of Object.entries(adjustedChances)) {
        adjustedChances[enemyType] = chance / totalChance;
    }
    
    for (const [enemyType, chance] of Object.entries(adjustedChances)) {
        cumulative += chance;
        if (rand < cumulative) {
            type = enemyType;
            break;
        }
    }
    
    const enemyData = enemyTypes[type];
    
    const enemy = {
        x: x,
        y: y,
        type: type,
        radius: enemyData.radius + Math.random() * 4,
        speed: enemyData.speed + Math.random() * 0.5 + (waveManager.currentWave * 0.05),
        health: enemyData.health + Math.floor(waveManager.currentWave / 4),
        damage: type === 'elite' ? 20 : 10, // Elites deal 2x damage
        xpValue: enemyData.xpValue,
        dead: false,
        color: enemyData.color,
        isElite: type === 'elite'
    };
    enemies.push(enemy);
}

function spawnBoss() {
    const bossTier = Math.floor(waveManager.currentWave / 10);
    const baseHealth = 60 + (bossTier * 15); // 60, 75, 90+ HP
    
    const boss = {
        x: canvas.width / 2,
        y: 100,
        type: 'boss',
        radius: 30 + (bossTier * 5),
        speed: 0.8 + (bossTier * 0.1),
        health: baseHealth,
        maxHealth: baseHealth,
        damage: 15 + (bossTier * 5),
        xpValue: 100 + (bossTier * 25), // 100, 125, 150+ XP
        dead: false,
        color: '#8a1a1a',
        isBoss: true,
        phase: 1,
        attackTimer: 0,
        attackCooldown: 120 - (bossTier * 10), // Faster attacks at higher tiers
        tier: bossTier
    };
    enemies.push(boss);
    
    // Screen darkening effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    addScreenShake(10);
    console.log(`BOSS TIER ${bossTier} spawned!`);
}

function updateBoss(boss) {
    boss.attackTimer++;
    
    // Phase transitions based on health
    const healthPercent = boss.health / boss.maxHealth;
    if (healthPercent < 0.3 && boss.phase === 2) {
        boss.phase = 3;
        boss.attackCooldown = Math.max(60, boss.attackCooldown - 20);
        boss.speed *= 1.5; // Enrage mode
        console.log('BOSS ENRAGE!');
    } else if (healthPercent < 0.6 && boss.phase === 1) {
        boss.phase = 2;
        boss.attackCooldown = Math.max(80, boss.attackCooldown - 15);
        console.log('BOSS PHASE 2');
    }
    
    // Boss attacks based on tier and phase
    if (boss.attackTimer >= boss.attackCooldown) {
        boss.attackTimer = 0;
        
        if (boss.tier === 0) {
            // Basic boss: charge attacks
            const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
            boss.x += Math.cos(angle) * boss.speed * 3;
            boss.y += Math.sin(angle) * boss.speed * 3;
            addScreenShake(5);
        } else if (boss.tier === 1) {
            // Mid boss: charge + shockwave
            if (boss.phase >= 2) {
                // Shockwave attack
                createParticles(boss.x, boss.y, '#ff5050', 20);
                // Check if player is in shockwave range
                const dx = player.x - boss.x;
                const dy = player.y - boss.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 150) {
                    player.health -= 5;
                    updateHealthBar();
                    addScreenShake(8);
                }
            } else {
                // Regular charge
                const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
                boss.x += Math.cos(angle) * boss.speed * 3;
                boss.y += Math.sin(angle) * boss.speed * 3;
                addScreenShake(5);
            }
        } else {
            // Late boss: all attacks + projectiles
            if (boss.phase >= 2) {
                // Spawn projectiles
                for (let i = 0; i < 3; i++) {
                    const angle = (Math.PI * 2 / 3) * i + Math.random() * 0.5;
                    bullets.push({
                        x: boss.x,
                        y: boss.y,
                        vx: Math.cos(angle) * 4,
                        vy: Math.sin(angle) * 4,
                        damage: 10,
                        size: 6,
                        source: 'boss',
                        color: '#ff3030'
                    });
                }
            }
            // Always charge
            const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
            boss.x += Math.cos(angle) * boss.speed * 3;
            boss.y += Math.sin(angle) * boss.speed * 3;
            addScreenShake(6);
        }
    }
    
    // Regular movement toward player
    const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
    boss.x += Math.cos(angle) * boss.speed;
    boss.y += Math.sin(angle) * boss.speed;
}

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
        const speed = 2 + Math.random() * 3;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 30 + Math.random() * 20,
            color: color,
            size: 2 + Math.random() * 3
        });
    }
}

function update() {
    if (!gameRunning || gamePaused) return;

    // Player movement
    if (keys['w'] || keys['arrowup']) player.y -= player.speed;
    if (keys['s'] || keys['arrowdown']) player.y += player.speed;
    if (keys['a'] || keys['arrowleft']) player.x -= player.speed;
    if (keys['d'] || keys['arrowright']) player.x += player.speed;

    // Keep player in bounds
    player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));

    // Passive aura emission (only when enemies nearby)
    player.passiveCooldown--;
    if (player.passiveCooldown <= 0 && findNearestEnemy()) {
        fireBullet('passive');
        player.passiveCooldown = player.passiveRate;
        soundManager.playSound('shoot');
    }
    
    // Independent manual cooldown
    player.manualCooldown--;
    if (player.manualCooldown < 0) player.manualCooldown = 0;

    // Update bullets
    bullets = bullets.filter(bullet => {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        return bullet.x > 0 && bullet.x < canvas.width && 
               bullet.y > 0 && bullet.y < canvas.height;
    });

    // Apply knockback to enemies and decay hit flash
    enemies.forEach(enemy => {
        if (enemy.knockbackX) {
            enemy.x += enemy.knockbackX;
            enemy.knockbackX *= 0.9;
            if (Math.abs(enemy.knockbackX) < 0.5) enemy.knockbackX = 0;
        }
        if (enemy.knockbackY) {
            enemy.y += enemy.knockbackY;
            enemy.knockbackY *= 0.9;
            if (Math.abs(enemy.knockbackY) < 0.5) enemy.knockbackY = 0;
        }
        // Decay hit flash
        if (enemy.hitFlash) {
            enemy.hitFlash *= 0.85;
            if (enemy.hitFlash < 0.1) enemy.hitFlash = 0;
        }
    });

    // Update wave manager
    waveManager.update();

    // Update enemies
    enemies = enemies.filter(enemy => {
        // Special boss update logic
        if (enemy.isBoss) {
            updateBoss(enemy);
        } else {
            // Regular enemy movement
            const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
            enemy.x += Math.cos(angle) * enemy.speed;
            enemy.y += Math.sin(angle) * enemy.speed;
        }

        // Check collision with player
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < player.radius + enemy.radius) {
            player.health -= enemy.damage;
            trackDamage(); // Reset combo on damage
            addScreenShake(6);
            addHitFlash(0.4);
            createParticles(player.x, player.y, '#8a5a5a', 8);
            updateHealthBar();
            soundManager.playSound('damage');
            if (player.health <= 0) {
                gameOver();
            }
            return false;
        }

        // Check collision with bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            const bdx = bullet.x - enemy.x;
            const bdy = bullet.y - enemy.y;
            const bdist = Math.sqrt(bdx * bdx + bdy * bdy);

            if (bdist < enemy.radius + (bullet.size || 4)) {
            if (bdist < enemy.radius + (bullet.size || 4)) {
                enemy.health -= (bullet.damage || 1);
                bullets.splice(i, 1);
                createParticles(enemy.x, enemy.y, '#6a4a4a', 5);
                
                // Base knockback impulse (small) + upgrade knockback
                const kbAngle = Math.atan2(enemy.y - bullet.y, enemy.x - bullet.x);
                const baseKnockback = 2;
                const upgradeKnockback = player.knockback || 0;
                const totalKnockback = baseKnockback + upgradeKnockback;
                
                enemy.knockbackX = (enemy.knockbackX || 0) + Math.cos(kbAngle) * totalKnockback;
                enemy.knockbackY = (enemy.knockbackY || 0) + Math.sin(kbAngle) * totalKnockback;
                
                // Hit flash effect
                enemy.hitFlash = 1;
                soundManager.playSound('hit');
                
                    if (enemy.health <= 0 && !enemy.dead) {
                        enemy.dead = true; // Prevent duplicate XP
                        score += 10;
                        trackKill(); // Track for combo system
                        riskSystem.onKill(); // Track for risk bonus
                        
                        if (enemy.isBoss) {
                        // Boss death rewards
                        score += 100;
                        player.health = Math.min(player.maxHealth, player.health + Math.floor(player.maxHealth * 0.3)); // 30% heal
                        updateHealthBar();
                        
                        // Massive XP burst
                        const xpValue = Math.floor(enemy.xpValue * pressureSystem.getXPMultiplier() * riskSystem.getRiskMultiplier());
                        xpSystem.spawnXPOrb(enemy.x, enemy.y, xpValue);
                        
                        // Guaranteed Rare+ upgrade
                        // This would need to be handled in the level-up system
                        console.log('BOSS DEFEATED! Massive rewards!');
                        soundManager.playSound('boss');
                    } else {
                        // Regular enemy XP with wave-based reduction and risk bonuses
                        let xpValue = enemy.xpValue;
                        
                        // Reduce basic enemy XP after wave 5
                        if (waveManager.currentWave > 5 && enemy.type === 'basic') {
                            xpValue = Math.floor(xpValue * 0.9); // -10% for basics
                        }
                        
                        // Apply pressure and risk multipliers
                        xpValue = Math.floor(xpValue * pressureSystem.getXPMultiplier() * riskSystem.getRiskMultiplier());
                        xpSystem.spawnXPOrb(enemy.x, enemy.y, xpValue);
                        soundManager.playSound('kill');
                    }
                    
                    waveManager.enemyDefeated();
                    updateScore();
                    createParticles(enemy.x, enemy.y, '#5a4a3a', 15);
                    createParticles(enemy.x, enemy.y, '#6a4a4a', 8);
                    return false;
                }
                break;
            }
            }
        }

        return true;
    });

    // Update particles
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        p.vx *= 0.95;
        p.vy *= 0.95;
        return p.life > 0;
    });

    // Decay effects
    screenShake *= 0.85;
    if (screenShake < 0.5) screenShake = 0;
    hitFlash *= 0.9;
    if (hitFlash < 0.05) hitFlash = 0;
    if (gameRunning && Math.random() < 0.02) {
        score += 1;
        updateScore();
    }

    // Update pressure and risk systems
    pressureSystem.update();
    riskSystem.update();
    
    // Update XP orbs
    xpSystem.updateOrbs();
    
    // Remove survival XP - only kills should give XP
    frameCount++;
    survivalTime++;
}

function gameOver() {
    gameRunning = false;
    finalScoreDisplay.textContent = `Score: ${score}`;
    gameOverScreen.style.display = 'block';
}

function draw() {
    // Calculate shake offset
    const shakeX = (Math.random() - 0.5) * screenShake;
    const shakeY = (Math.random() - 0.5) * screenShake;

    ctx.save();
    ctx.translate(shakeX, shakeY);
    // Dark forest background
    const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width
    );
    gradient.addColorStop(0, '#1a2a1a');
    gradient.addColorStop(1, '#0a1a0a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw subtle grid
    ctx.strokeStyle = 'rgba(40, 60, 40, 0.3)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Draw particles
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 50;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Draw bullets
    ctx.fillStyle = '#9ab89a';
    bullets.forEach(bullet => {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.size || 4, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw enemies
    enemies.forEach(enemy => {
        // Base enemy color based on type
        ctx.fillStyle = enemy.color;
        
        // Special boss rendering
        if (enemy.isBoss) {
            // Boss glow effect
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ff3030';
            
            // Boss health bar
            const barWidth = enemy.radius * 2;
            const barHeight = 6;
            const healthPercent = enemy.health / enemy.maxHealth;
            
            // Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(enemy.x - barWidth/2, enemy.y - enemy.radius - 15, barWidth, barHeight);
            
            // Health bar
            if (healthPercent > 0.6) {
                ctx.fillStyle = '#5a8a5a';
            } else if (healthPercent > 0.3) {
                ctx.fillStyle = '#b8a050';
            } else {
                ctx.fillStyle = '#ff5050';
            }
            ctx.fillRect(enemy.x - barWidth/2, enemy.y - enemy.radius - 15, barWidth * healthPercent, barHeight);
            
            ctx.shadowBlur = 0;
        }
        
        // Apply hit flash (brighten when hit)
        if (enemy.hitFlash > 0) {
            const flashIntensity = enemy.hitFlash * 0.5;
            ctx.fillStyle = `rgba(${74 + flashIntensity * 100}, ${42 + flashIntensity * 80}, ${42 + flashIntensity * 80}, 1)`;
        }
        
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Different border colors for enemy types
        if (enemy.type === 'tank') {
            ctx.strokeStyle = '#4a2a2a';
        } else if (enemy.type === 'fast') {
            ctx.strokeStyle = '#8a4a4a';
        } else if (enemy.type === 'elite') {
            ctx.strokeStyle = '#ffaa00';
        } else if (enemy.isBoss) {
            ctx.strokeStyle = '#ff3030';
            ctx.lineWidth = 3;
        } else {
            ctx.strokeStyle = '#6a3a3a';
            ctx.lineWidth = 2;
        }
        ctx.stroke();

        // Enemy eyes (different colors for types)
        if (enemy.type === 'tank') {
            ctx.fillStyle = '#a03030'; // Red eyes for tanks
        } else if (enemy.type === 'fast') {
            ctx.fillStyle = '#f0a050'; // Orange eyes for fast
        } else if (enemy.type === 'elite') {
            ctx.fillStyle = '#ffaa00'; // Gold eyes for elites
        } else if (enemy.isBoss) {
            ctx.fillStyle = '#ff0000'; // Bright red for boss
        } else {
            ctx.fillStyle = '#a05050'; // Normal red eyes
        }
        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        ctx.beginPath();
        ctx.arc(enemy.x + Math.cos(angle - 0.3) * enemy.radius * 0.4, 
               enemy.y + Math.sin(angle - 0.3) * enemy.radius * 0.4, 2, 0, Math.PI * 2);
        ctx.arc(enemy.x + Math.cos(angle + 0.3) * enemy.radius * 0.4, 
               enemy.y + Math.sin(angle + 0.3) * enemy.radius * 0.4, 2, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw XP orbs
    xpSystem.xpOrbs.forEach(orb => {
        const alpha = Math.min(1, orb.lifetime / 60); // Fade in for first second
        ctx.fillStyle = `rgba(122, 184, 122, ${alpha})`;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#7ab87a';
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Draw player
    ctx.fillStyle = '#5a7a5a';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#7a9a7a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Player direction indicator
    const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
    ctx.strokeStyle = '#9aba9a';
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(
        player.x + Math.cos(angle) * (player.radius + 8),
        player.y + Math.sin(angle) * (player.radius + 8)
    );
    ctx.stroke();

    ctx.restore();

    // Hit flash overlay
    if (hitFlash > 0) {
        ctx.fillStyle = `rgba(180, 80, 80, ${hitFlash * 0.4})`;
        ctx.fillRect(-10, -10, canvas.width + 20, canvas.height + 20);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start game
loadUpgrades(); // Load saved upgrades
player.health = player.maxHealth; // Ensure health matches maxHealth after upgrades are loaded

// Initialize new XP system
xpSystem.init();

waveManager.startWave(); // Start wave 1

// Check first time launch and show instructions
const helpSeen = localStorage.getItem('survivalShooter_helpSeen');
if (!helpSeen) {
    instructionsPanel.style.display = 'flex';
    gamePaused = true;
}

updateHealthBar();
updateScore();
updateWaveDisplay();
gameLoop();
