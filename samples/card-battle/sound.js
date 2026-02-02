// カードバトルゲーム - 効果音エンジン [V3]

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
    }

    _getCtx() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
    }

    toggle() {
        this.muted = !this.muted;
        return this.muted;
    }

    play(type) {
        if (this.muted) return;
        try {
            const ctx = this._getCtx();
            const now = ctx.currentTime;
            switch (type) {
                case 'cardSelect': this._rect(ctx, now, 80, 0.05, 0.15); break;
                case 'cardPlay': this._noise(ctx, now, 0.1, 800, 2000, 0.15); break;
                case 'clash': this._sine(ctx, now, 60, 0.15, 0.3); this._noise(ctx, now, 0.1, 200, 600, 0.2); break;
                case 'win': this._arp(ctx, now, [262, 330, 392], 0.1, 0.15); break;
                case 'lose': this._arp(ctx, now, [196, 131], 0.15, 0.15); break;
                case 'elementBonus': this._sine(ctx, now, 880, 0.08, 0.12); this._sine(ctx, now + 0.08, 1100, 0.08, 0.1); break;
                case 'flip': this._noise(ctx, now, 0.05, 1000, 3000, 0.1); break;
            }
        } catch (e) { /* ignore audio errors */ }
    }

    _sine(ctx, time, freq, dur, vol) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(time); osc.stop(time + dur);
    }

    _rect(ctx, time, freq, dur, vol) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square'; osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(time); osc.stop(time + dur);
    }

    _noise(ctx, time, dur, lo, hi, vol) {
        const bufferSize = ctx.sampleRate * dur;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = (lo + hi) / 2; bp.Q.value = 1;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
        src.connect(bp); bp.connect(gain); gain.connect(ctx.destination);
        src.start(time); src.stop(time + dur);
    }

    _arp(ctx, time, freqs, spacing, vol) {
        freqs.forEach((f, i) => this._sine(ctx, time + i * spacing, f, spacing * 1.5, vol));
    }
}

const soundEngine = new SoundEngine();
