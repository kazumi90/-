// Sound Effects System
class SoundManager {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.enabled = true;
        this.volume = 0.3;
        
        this.initAudioContext();
    }
    
    initAudioContext() {
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        } catch (e) {
            console.warn('Web Audio API not supported');
            this.enabled = false;
        }
    }
    
    // Generate sound effects using Web Audio API
    createSound(type) {
        if (!this.enabled) return null;
        
        const ctx = this.audioContext;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        switch (type) {
            case 'shoot':
                return this.createShootSound(oscillator, gainNode);
            case 'hit':
                return this.createHitSound(oscillator, gainNode);
            case 'kill':
                return this.createKillSound(oscillator, gainNode);
            case 'levelup':
                return this.createLevelUpSound(oscillator, gainNode);
            case 'xp':
                return this.createXPSound(oscillator, gainNode);
            case 'damage':
                return this.createDamageSound(oscillator, gainNode);
            case 'boss':
                return this.createBossSound(oscillator, gainNode);
            default:
                return null;
        }
    }
    
    createShootSound(oscillator, gainNode) {
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(this.volume * 0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
        
        return oscillator;
    }
    
    createHitSound(oscillator, gainNode) {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(this.volume * 0.4, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.2);
        
        return oscillator;
    }
    
    createKillSound(oscillator, gainNode) {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523.25, this.audioContext.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, this.audioContext.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(783.99, this.audioContext.currentTime + 0.2); // G5
        
        gainNode.gain.setValueAtTime(this.volume * 0.5, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.3);
        
        return oscillator;
    }
    
    createLevelUpSound(oscillator, gainNode) {
        oscillator.type = 'triangle';
        
        // Create ascending notes
        const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
        notes.forEach((freq, i) => {
            oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime + i * 0.15);
        });
        
        gainNode.gain.setValueAtTime(this.volume * 0.6, this.audioContext.currentTime);
        gainNode.gain.setValueAtTime(this.volume * 0.6, this.audioContext.currentTime + 0.6);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.8);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.8);
        
        return oscillator;
    }
    
    createXPSound(oscillator, gainNode) {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1200, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1600, this.audioContext.currentTime + 0.05);
        
        gainNode.gain.setValueAtTime(this.volume * 0.2, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
        
        return oscillator;
    }
    
    createDamageSound(oscillator, gainNode) {
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(30, this.audioContext.currentTime + 0.3);
        
        gainNode.gain.setValueAtTime(this.volume * 0.7, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.3);
        
        return oscillator;
    }
    
    createBossSound(oscillator, gainNode) {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(60, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(30, this.audioContext.currentTime + 0.5);
        
        gainNode.gain.setValueAtTime(this.volume * 0.8, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.5);
        
        return oscillator;
    }
    
    playSound(type) {
        if (!this.enabled) return;
        
        // Resume audio context if suspended (browser requirement)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.createSound(type);
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }
    
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

// Initialize sound manager
const soundManager = new SoundManager();
