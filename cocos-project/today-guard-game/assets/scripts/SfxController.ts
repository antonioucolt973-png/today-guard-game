import { _decorator, AudioClip, AudioSource, Component, Node, resources } from 'cc';
import { getOrAddComponent } from './ComponentLookup';

const { ccclass, property } = _decorator;

type SfxClipMap = Record<string, AudioClip[]>;

@ccclass('SfxController')
export class SfxController extends Component {
    @property(AudioSource)
    public audioSource: AudioSource | null = null;

    @property
    public maxConcurrentSfx = 3;

    @property([AudioClip])
    public attackClips: AudioClip[] = [];

    @property([AudioClip])
    public killClips: AudioClip[] = [];

    @property([AudioClip])
    public hurtClips: AudioClip[] = [];

    @property([AudioClip])
    public waveStartClips: AudioClip[] = [];

    @property([AudioClip])
    public waveStartFastClips: AudioClip[] = [];

    @property([AudioClip])
    public winClips: AudioClip[] = [];

    @property([AudioClip])
    public gameOverClips: AudioClip[] = [];

    @property([AudioClip])
    public monsterIntroNeihaoClips: AudioClip[] = [];

    @property([AudioClip])
    public monsterIntroCuihuoClips: AudioClip[] = [];

    @property([AudioClip])
    public monsterIntroShuaiguoClips: AudioClip[] = [];

    @property([AudioClip])
    public combo3Clips: AudioClip[] = [];

    @property([AudioClip])
    public combo5Clips: AudioClip[] = [];

    @property([AudioClip])
    public combo10Clips: AudioClip[] = [];

    @property([AudioClip])
    public hp100Clips: AudioClip[] = [];

    @property([AudioClip])
    public hp70Clips: AudioClip[] = [];

    @property([AudioClip])
    public hp40Clips: AudioClip[] = [];

    @property([AudioClip])
    public hp20Clips: AudioClip[] = [];

    @property([AudioClip])
    public hp0Clips: AudioClip[] = [];

    private readonly _fallbackClips: SfxClipMap = {};
    private _fallbackLoaded = false;
    private _activeSfxCount = 0;

    protected onLoad(): void {
        this.audioSource = this.audioSource ?? getOrAddComponent(this.node, AudioSource);
        this.loadFallbackClips();
    }

    public static getForNode(node: Node | null): SfxController | null {
        const canvas = SfxController.findAncestorByName(node, 'Canvas') ?? node;
        if (!canvas) {
            return null;
        }

        for (const component of canvas.components) {
            if (component instanceof SfxController) {
                return component;
            }
        }

        return canvas.addComponent(SfxController);
    }

    public static playSfx(node: Node | null, name: string): void {
        SfxController.getForNode(node)?.playSfx(name);
    }

    public playSfx(name: string): void {
        if (!name || this._activeSfxCount >= this.maxConcurrentSfx) {
            return;
        }

        this.audioSource = this.audioSource ?? getOrAddComponent(this.node, AudioSource);
        this.loadFallbackClips();
        const clip = this.pickClip(name);
        if (!this.audioSource || !clip) {
            return;
        }

        this._activeSfxCount += 1;
        this.audioSource.playOneShot(clip, 1);
        this.scheduleOnce(() => {
            this._activeSfxCount = Math.max(0, this._activeSfxCount - 1);
        }, this.getClipDuration(clip));
    }

    private pickClip(name: string): AudioClip | null {
        const clips = this.getConfiguredClips(name);
        if (clips.length > 0) {
            return clips[Math.floor(Math.random() * clips.length)] ?? null;
        }

        const fallback = this._fallbackClips[name] ?? [];
        if (fallback.length > 0) {
            return fallback[Math.floor(Math.random() * fallback.length)] ?? null;
        }

        return null;
    }

    private getConfiguredClips(name: string): AudioClip[] {
        switch (name) {
            case 'attack':
                return this.attackClips;
            case 'kill':
                return this.killClips;
            case 'hurt':
                return this.hurtClips;
            case 'wave_start':
                return this.waveStartClips;
            case 'wave_start_fast':
                return this.waveStartFastClips.length > 0 ? this.waveStartFastClips : this.waveStartClips;
            case 'win':
                return this.winClips;
            case 'gameover':
                return this.gameOverClips;
            case 'monster_intro':
            case 'monster_intro_neihao':
                return this.monsterIntroNeihaoClips;
            case 'monster_intro_cuihuo':
                return this.monsterIntroCuihuoClips;
            case 'monster_intro_shuaiguo':
                return this.monsterIntroShuaiguoClips;
            case 'combo_3':
                return this.combo3Clips;
            case 'combo_5':
                return this.combo5Clips;
            case 'combo_10':
                return this.combo10Clips;
            case 'hp_100':
                return this.hp100Clips;
            case 'hp_70':
                return this.hp70Clips;
            case 'hp_40':
                return this.hp40Clips;
            case 'hp_20':
                return this.hp20Clips;
            case 'hp_0':
                return this.hp0Clips;
            default:
                return [];
        }
    }

    private loadFallbackClips(): void {
        if (this._fallbackLoaded) {
            return;
        }

        this._fallbackLoaded = true;
        this.loadNamedAudioClips();
        this.loadFallbackClip('audio/hit', ['attack', 'kill', 'combo_3', 'combo_5', 'combo_10']);
        this.loadFallbackClip('audio/hurt', ['hurt', 'hp_70', 'hp_40', 'hp_20']);
        this.loadFallbackClip('audio/skill', ['wave_start', 'wave_start_fast', 'monster_intro', 'monster_intro_neihao', 'monster_intro_cuihuo', 'monster_intro_shuaiguo']);
        this.loadFallbackClip('audio/victory', ['win', 'hp_100']);
        this.loadFallbackClip('audio/gameover', ['gameover', 'hp_0']);
    }

    private loadNamedAudioClips(): void {
        this.loadFallbackClip('audio/attack_1', ['attack']);
        this.loadFallbackClip('audio/attack_2', ['attack']);
        this.loadFallbackClip('audio/attack_3', ['attack']);
        this.loadFallbackClip('audio/kill_ok', ['kill']);
        this.loadFallbackClip('audio/kill_okok', ['kill']);
        this.loadFallbackClip('audio/kill_yes', ['kill']);
        this.loadFallbackClip('audio/hurt_ah', ['hurt']);
        this.loadFallbackClip('audio/wave_start', ['wave_start']);
        this.loadFallbackClip('audio/wave_start_fast', ['wave_start_fast']);
        this.loadFallbackClip('audio/win_xiaban', ['win']);
        this.loadFallbackClip('audio/gameover_wanla', ['gameover']);
        this.loadFallbackClip('audio/monster_intro_neihao', ['monster_intro_neihao']);
        this.loadFallbackClip('audio/monster_intro_cuihuo', ['monster_intro_cuihuo']);
        this.loadFallbackClip('audio/monster_intro_shuaiguo', ['monster_intro_shuaiguo']);
        this.loadFallbackClip('audio/combo_3', ['combo_3']);
        this.loadFallbackClip('audio/combo_5', ['combo_5']);
        this.loadFallbackClip('audio/combo_10', ['combo_10']);
        this.loadFallbackClip('audio/hp_100', ['hp_100']);
        this.loadFallbackClip('audio/hp_70', ['hp_70']);
        this.loadFallbackClip('audio/hp_40', ['hp_40']);
        this.loadFallbackClip('audio/hp_20', ['hp_20']);
        this.loadFallbackClip('audio/hp_0', ['hp_0']);
    }

    private loadFallbackClip(path: string, names: string[]): void {
        resources.load(path, AudioClip, (error, clip) => {
            if (error || !clip) {
                return;
            }

            for (const name of names) {
                const clips = this._fallbackClips[name] ?? [];
                clips.push(clip);
                this._fallbackClips[name] = clips;
            }
        });
    }

    private getClipDuration(clip: AudioClip): number {
        const duration = Number((clip as AudioClip & { duration?: number }).duration ?? 0);
        return Math.max(0.2, Math.min(duration || 0.45, 2));
    }

    private static findAncestorByName(node: Node | null, name: string): Node | null {
        let current: Node | null = node;
        while (current) {
            if (current.name === name) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }
}
